import { Hono, type Context } from "hono";
import { sniffPhotoType } from "@shared/photos.ts";
import {
  cleanRetailerLink,
  contributionProblem,
  formatDollars,
  MAX_REGISTRY_IMAGE_BYTES,
} from "@shared/registry.ts";
import { checkoutRequest, registryItemFields, type RegistryResponse } from "@shared/schemas.ts";
import { requireAccess } from "@worker/admin.ts";
import {
  deleteRegistryItem,
  getRegistryItem,
  insertRegistryItem,
  listRegistryItems,
  registryImageInUse,
  setRegistryImage,
  updateRegistryItem,
  type RegistryText,
} from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sendAlert } from "@worker/notify.ts";
import { serveObject } from "@worker/photos.ts";
import { createCheckoutSession, verifyStripeSignature } from "@worker/stripe.ts";

export const registry = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

const registryList = async (c: AppContext) =>
  c.json({
    items: await listRegistryItems(c.env.DB),
    acceptingGifts: Boolean(c.env.STRIPE_SECRET_KEY),
  } satisfies RegistryResponse);

registry.get("/", registryList);

registry.post("/checkout", async (c) => {
  const secretKey = c.env.STRIPE_SECRET_KEY;
  if (!secretKey) return c.json({ error: "Gifts aren't open yet. Please check back soon." }, 503);

  const parsed = checkoutRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Please add your name and an amount." }, 400);
  const body = parsed.data;
  const item = await getRegistryItem(c.env.DB, body.itemId);
  if (item === null) return c.json({ error: "We couldn't find that gift." }, 404);
  const problem = contributionProblem(body.amountCents, item.priceCents, item.raisedCents);
  if (problem !== null) return c.json({ error: problem }, 400);

  const origin = new URL(c.req.url).origin;
  const session = await createCheckoutSession(secretKey, {
    itemId: item.id,
    itemName: item.name,
    amountCents: body.amountCents,
    giverName: body.name,
    note: body.note,
    successUrl: `${origin}/registry?thanks=1`,
    cancelUrl: `${origin}/registry`,
  });
  return c.json({ url: session.url });
});

interface PaidSession {
  id: string;
  payment_status: string;
  amount_total: number | null;
  metadata?: Record<string, string>;
  customer_details?: { email?: string | null } | null;
}

const RECORDED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

interface Gift {
  sessionId: string;
  itemId: string;
  amountCents: number;
  name: string;
  note: string | null;
  email: string | null;
}

/** Reads the gift out of a paid Checkout session, failing loudly if our metadata is missing. */
function giftFrom(session: PaidSession): Gift {
  const metadata = session.metadata ?? {};
  const itemId = metadata["item_id"];
  if (!itemId || session.amount_total === null) {
    throw new Error(
      `Stripe session ${session.id} has no item_id metadata or amount; cannot record it.`,
    );
  }
  return {
    sessionId: session.id,
    itemId,
    amountCents: session.amount_total,
    name: metadata["giver_name"] || "Anonymous",
    note: metadata["note"] || null,
    email: session.customer_details?.email ?? null,
  };
}

/** Inserts a paid gift once; replays of the same session change nothing. Returns true if new. */
async function recordGift(db: D1Database, gift: Gift): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO contributions (id, item_id, stripe_session_id, amount_cents, name, note, email, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?) ON CONFLICT (stripe_session_id) DO NOTHING`,
    )
    .bind(
      crypto.randomUUID(),
      gift.itemId,
      gift.sessionId,
      gift.amountCents,
      gift.name,
      gift.note,
      gift.email,
      new Date().toISOString(),
    )
    .run();
  return result.meta.changes === 1;
}

function alertForGift(env: Env, gift: Gift): Promise<void> {
  const amount = formatDollars(gift.amountCents);
  return sendAlert(env, `Gift: ${amount} from ${gift.name}`, [
    `From: ${gift.name}`,
    `Amount: ${amount}`,
    `Item: ${gift.itemId}`,
    `Note: ${gift.note ?? "-"}`,
    `Email: ${gift.email ?? "-"}`,
  ]);
}

/** The paid session in a signed event we record, or null for events we ignore. */
function paidSession(payload: string): PaidSession | null {
  const event = JSON.parse(payload) as { type: string; data: { object: PaidSession } };
  const session = event.data.object;
  return RECORDED_EVENTS.has(event.type) && session.payment_status === "paid" ? session : null;
}

export const stripeWebhook = new Hono<{ Bindings: Env }>();

stripeWebhook.post("/webhook", async (c) => {
  const secret = c.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook refused: STRIPE_WEBHOOK_SECRET is not set.");
    return c.json({ error: "Webhook not configured." }, 503);
  }
  const payload = await c.req.text();
  const signature = c.req.header("stripe-signature");
  if (!(await verifyStripeSignature(payload, signature, secret, Date.now() / 1000))) {
    return c.json({ error: "Bad signature." }, 400);
  }
  const session = paidSession(payload);
  if (session === null) return c.json({ received: true });
  const gift = giftFrom(session);
  if (await recordGift(c.env.DB, gift)) c.executionCtx.waitUntil(alertForGift(c.env, gift));
  return c.json({ received: true });
});

const imageKey = (imageId: string) => `registry/${imageId}`;

/** Item pictures, at /media/registry/<image id>. A new picture gets a new id, so it caches. */
export const registryMedia = new Hono<{ Bindings: Env }>();

registryMedia.get("/:imageId", async (c) => {
  const imageId = c.req.param("imageId");
  if (!(await registryImageInUse(c.env.DB, imageId))) return c.json({ error: "Not found." }, 404);
  return serveObject(c, imageKey(imageId), "public, max-age=604800, immutable");
});

/** Adding and editing registry items at /api/admin/registry, behind Cloudflare Access. */
export const adminRegistry = new Hono<{ Bindings: Env }>();
adminRegistry.use("*", requireAccess);

const ITEM_NOT_FOUND = "That item doesn't exist. It may have been deleted.";

/** The item text in the request, with its link cleaned of tracking parameters, or an error. */
async function readItemText(c: AppContext): Promise<RegistryText | string> {
  const parsed = registryItemFields.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return "Please give the item a name and a short description. A cost must be in dollars, and a link must be a web link (https://…).";
  }
  const { link } = parsed.data;
  return { ...parsed.data, link: link === null ? null : cleanRetailerLink(link) };
}

adminRegistry.get("/", registryList);

adminRegistry.post("/", async (c) => {
  const item = await readItemText(c);
  if (typeof item === "string") return c.json({ error: item }, 400);
  const id = crypto.randomUUID();
  await insertRegistryItem(c.env.DB, id, item);
  console.log(`Admin added registry item ${id}.`);
  return c.json({ id });
});

adminRegistry.patch("/:id", async (c) => {
  const item = await readItemText(c);
  if (typeof item === "string") return c.json({ error: item }, 400);
  const current = await getRegistryItem(c.env.DB, c.req.param("id"));
  if (current === null) return c.json({ error: ITEM_NOT_FOUND }, 404);
  if (item.priceCents !== null && item.priceCents < current.raisedCents) {
    const raised = formatDollars(current.raisedCents);
    return c.json(
      { error: `Guests have already given ${raised}, so the price can't be lower.` },
      400,
    );
  }
  if (!(await updateRegistryItem(c.env.DB, current.id, item))) {
    return c.json({ error: ITEM_NOT_FOUND }, 404);
  }
  return c.json({ ok: true as const });
});

adminRegistry.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const result = await deleteRegistryItem(c.env.DB, id);
  if (!result.deleted && result.reason === "missing") return c.json({ error: ITEM_NOT_FOUND }, 404);
  if (!result.deleted) {
    return c.json(
      { error: "Guests have given toward this item, so it can't be deleted. Their gifts stay." },
      409,
    );
  }
  if (result.imageId !== null) await c.env.PHOTOS.delete(imageKey(result.imageId));
  console.log(`Admin deleted registry item ${id}.`);
  return c.json({ ok: true as const });
});

/** Reads the `image` file of a multipart upload: a WebP or JPEG the browser already resized. */
async function readImage(c: AppContext): Promise<{ bytes: ArrayBuffer; type: string } | string> {
  const body = await c.req.parseBody().catch(() => null);
  const file = body?.["image"];
  if (!(file instanceof File)) return "Please send the picture as a form upload named image.";
  if (file.size > MAX_REGISTRY_IMAGE_BYTES) {
    return `The picture is over ${MAX_REGISTRY_IMAGE_BYTES / 1024 / 1024} MB. Please try a smaller one.`;
  }
  const bytes = await file.arrayBuffer();
  const type = sniffPhotoType(new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)));
  return type === null ? "The picture isn't a WebP or JPEG image." : { bytes, type };
}

/** Stores a new picture first, then points the item at it and deletes the one it replaced. */
adminRegistry.post("/:id/image", async (c) => {
  const image = await readImage(c);
  if (typeof image === "string") return c.json({ error: image }, 400);
  const imageId = crypto.randomUUID();
  await c.env.PHOTOS.put(imageKey(imageId), image.bytes, {
    httpMetadata: { contentType: image.type },
  });
  const replaced = await setRegistryImage(c.env.DB, c.req.param("id"), imageId);
  if (replaced === undefined) {
    await c.env.PHOTOS.delete(imageKey(imageId));
    return c.json({ error: ITEM_NOT_FOUND }, 404);
  }
  if (replaced !== null) await c.env.PHOTOS.delete(imageKey(replaced));
  return c.json({ ok: true as const });
});

adminRegistry.delete("/:id/image", async (c) => {
  const replaced = await setRegistryImage(c.env.DB, c.req.param("id"), null);
  if (replaced === undefined) return c.json({ error: ITEM_NOT_FOUND }, 404);
  if (replaced !== null) await c.env.PHOTOS.delete(imageKey(replaced));
  return c.json({ ok: true as const });
});
