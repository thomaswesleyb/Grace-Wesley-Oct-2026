import { Hono } from "hono";
import { contributionProblem, formatDollars } from "@shared/registry.ts";
import { checkoutRequest, type RegistryResponse } from "@shared/schemas.ts";
import { getRegistryItem, listRegistryItems } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sendAlert } from "@worker/notify.ts";
import { createCheckoutSession, verifyStripeSignature } from "@worker/stripe.ts";

export const registry = new Hono<{ Bindings: Env }>();

registry.get("/", async (c) => {
  const items = await listRegistryItems(c.env.DB);
  return c.json({
    items,
    acceptingGifts: Boolean(c.env.STRIPE_SECRET_KEY),
  } satisfies RegistryResponse);
});

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
