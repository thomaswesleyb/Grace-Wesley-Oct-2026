import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signStripePayload, verifyStripeSignature } from "@worker/stripe.ts";
import { call, resetDb, seedItem } from "@worker/test-helpers.ts";

beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());

const STRIPE = { STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_WEBHOOK_SECRET: "whsec_test" };

const checkout = (body: unknown, withStripe = true) =>
  call("/api/registry/checkout", { body, env: withStripe ? STRIPE : {} });

describe("GET /api/registry", () => {
  it("lists items with only paid gifts counted", async () => {
    await seedItem("espresso", 70000, [5000, 2500]);
    await env.DB.prepare(
      `INSERT INTO contributions (id, item_id, stripe_session_id, amount_cents, name, status, created_at)
       VALUES ('x', 'espresso', 'cs_pending', 9900, 'Not paid', 'open', '2026-10-20')`,
    ).run();
    const body = await (
      await call("/api/registry")
    ).json<{ items: { raisedCents: number }[]; acceptingGifts: boolean }>();
    expect(body.items[0]?.raisedCents).toBe(7500);
    expect(body.acceptingGifts).toBe(false);
  });

  it("reports gifts open once Stripe is configured", async () => {
    const body = await (
      await call("/api/registry", { env: STRIPE })
    ).json<{ acceptingGifts: boolean }>();
    expect(body.acceptingGifts).toBe(true);
  });
});

describe("POST /api/registry/checkout", () => {
  it("is closed until Stripe is configured", async () => {
    await seedItem("espresso", 70000);
    const response = await checkout({ itemId: "espresso", amountCents: 5000, name: "Ann" }, false);
    expect(response.status).toBe(503);
  });

  it("creates a Checkout session carrying the gift details", async () => {
    await seedItem("espresso", 70000);
    const stripe = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        Response.json({ id: "cs_test_1", url: "https://checkout.stripe.com/c/pay/cs_test_1" }),
      );
    const response = await checkout({
      itemId: "espresso",
      amountCents: 5000,
      name: "Ann",
      note: "Enjoy!",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });

    const [url, init] = stripe.mock.calls[0]!;
    expect(String(url)).toBe("https://api.stripe.com/v1/checkout/sessions");
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("line_items[0][price_data][unit_amount]")).toBe("5000");
    expect(form.get("metadata[item_id]")).toBe("espresso");
    expect(form.get("metadata[giver_name]")).toBe("Ann");
    expect(form.get("metadata[note]")).toBe("Enjoy!");
    expect(form.get("success_url")).toBe("https://wedding.test/registry?thanks=1");
  });

  it("enforces the minimum, the remaining balance, and fully funded items", async () => {
    await seedItem("espresso", 70000, [65000]);
    await seedItem("luggage", 1000, [1000]);
    expect((await checkout({ itemId: "espresso", amountCents: 999, name: "Ann" })).status).toBe(
      400,
    );
    expect((await checkout({ itemId: "espresso", amountCents: 5001, name: "Ann" })).status).toBe(
      400,
    );
    expect((await checkout({ itemId: "luggage", amountCents: 1000, name: "Ann" })).status).toBe(
      400,
    );
  });

  it("lets an open fund keep taking gifts with no goal", async () => {
    await seedItem("honeymoon", null, [2_000_000]);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ id: "cs_test_2", url: "https://checkout.stripe.com/c/pay/cs_test_2" }),
    );
    const ok = await checkout({ itemId: "honeymoon", amountCents: 250_000, name: "Ann" });
    expect(ok.status).toBe(200);
    const tooBig = await checkout({ itemId: "honeymoon", amountCents: 10_000_001, name: "Ann" });
    expect(tooBig.status).toBe(400);
    const tooSmall = await checkout({ itemId: "honeymoon", amountCents: 999, name: "Ann" });
    expect(tooSmall.status).toBe(400);
  });

  it("rejects unknown items and incomplete requests", async () => {
    expect((await checkout({ itemId: "nope", amountCents: 5000, name: "Ann" })).status).toBe(404);
    expect((await checkout({ itemId: "nope", amountCents: 5000, name: "" })).status).toBe(400);
    expect((await checkout("not json")).status).toBe(400);
  });

  it("reports a Stripe failure as a server error", async () => {
    await seedItem("espresso", 70000);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ error: { message: "Invalid API Key" } }, { status: 401 }),
    );
    expect((await checkout({ itemId: "espresso", amountCents: 5000, name: "Ann" })).status).toBe(
      500,
    );
  });
});

function paidEvent(sessionId: string, overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_status: "paid",
        amount_total: 5000,
        metadata: { item_id: "espresso", giver_name: "Ann", note: "Enjoy!" },
        customer_details: { email: "ann@example.com" },
        ...overrides,
      },
    },
  });
}

async function sendWebhook(
  payload: string,
  options: { secret?: string; ageSeconds?: number } = {},
) {
  const timestamp = Math.floor(Date.now() / 1000) - (options.ageSeconds ?? 0);
  const signature = await signStripePayload(
    payload,
    timestamp,
    options.secret ?? STRIPE.STRIPE_WEBHOOK_SECRET,
  );
  return call("/api/stripe/webhook", {
    body: payload,
    headers: { "stripe-signature": `t=${timestamp},v1=${signature}` },
    env: STRIPE,
  });
}

const giftRows = () =>
  env.DB.prepare("SELECT amount_cents, name, note, email, status FROM contributions").all();

describe("POST /api/stripe/webhook", () => {
  it("records a paid gift exactly once, even when Stripe retries", async () => {
    await seedItem("espresso", 70000);
    expect((await sendWebhook(paidEvent("cs_1"))).status).toBe(200);
    expect((await sendWebhook(paidEvent("cs_1"))).status).toBe(200);
    const { results } = await giftRows();
    expect(results).toEqual([
      { amount_cents: 5000, name: "Ann", note: "Enjoy!", email: "ann@example.com", status: "paid" },
    ]);
    const body = await (await call("/api/registry")).json<{ items: { raisedCents: number }[] }>();
    expect(body.items[0]?.raisedCents).toBe(5000);
  });

  it("rejects a wrong signature, a stale timestamp, and a missing header", async () => {
    await seedItem("espresso", 70000);
    expect((await sendWebhook(paidEvent("cs_2"), { secret: "whsec_wrong" })).status).toBe(400);
    expect((await sendWebhook(paidEvent("cs_3"), { ageSeconds: 600 })).status).toBe(400);
    expect(
      (await call("/api/stripe/webhook", { body: paidEvent("cs_4"), env: STRIPE })).status,
    ).toBe(400);
    expect((await giftRows()).results).toHaveLength(0);
  });

  it("ignores unpaid sessions and unrelated events", async () => {
    await seedItem("espresso", 70000);
    await sendWebhook(paidEvent("cs_5", { payment_status: "unpaid" }));
    await sendWebhook(
      JSON.stringify({ type: "customer.created", data: { object: { id: "cus_1" } } }),
    );
    expect((await giftRows()).results).toHaveLength(0);
  });

  it("fails loudly when a paid session lacks our metadata, so Stripe retries", async () => {
    expect((await sendWebhook(paidEvent("cs_6", { metadata: {} }))).status).toBe(500);
  });

  it("refuses to run without a signing secret", async () => {
    const response = await call("/api/stripe/webhook", {
      body: "{}",
      env: { STRIPE_WEBHOOK_SECRET: "" },
    });
    expect(response.status).toBe(503);
  });
});

describe("verifyStripeSignature", () => {
  it("accepts any matching v1 signature among several", async () => {
    const signature = await signStripePayload("{}", 1000, "whsec");
    expect(
      await verifyStripeSignature("{}", `t=1000,v1=deadbeef,v1=${signature}`, "whsec", 1000),
    ).toBe(true);
    expect(await verifyStripeSignature("{}", "t=1000", "whsec", 1000)).toBe(false);
    expect(await verifyStripeSignature("{}", "garbage", "whsec", 1000)).toBe(false);
  });
});

const asAdmin = { origin: "http://localhost:5173", env: { ADMIN_DEV_BYPASS: "1" } };
const noAccess = { env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } };

const ITEM = {
  name: "Espresso Machine",
  description: "For slow Saturday mornings.",
  priceCents: 70000,
  link: "https://www.example.com/espresso?variant=2&utm_source=google&gclid=abc",
};

const asciiBytes = (text: string) => [...text].map((ch) => ch.charCodeAt(0));
const webpFile = (tag = 0) =>
  new File(
    [new Uint8Array([...asciiBytes("RIFF"), 0, 0, 0, 0, ...asciiBytes("WEBP"), tag])],
    "p.webp",
    {
      type: "image/webp",
    },
  );

function pictureForm(file: File): FormData {
  const form = new FormData();
  form.set("image", file);
  return form;
}

async function addItem(overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await call("/api/admin/registry", {
    ...asAdmin,
    body: { ...ITEM, ...overrides },
  });
  expect(response.status).toBe(200);
  return (await response.json<{ id: string }>()).id;
}

async function publicItems() {
  return (await (await call("/api/registry")).json<{ items: Record<string, unknown>[] }>()).items;
}

const patchPrice = (id: string, priceCents: number | null) =>
  call(`/api/admin/registry/${id}`, { ...asAdmin, method: "PATCH", body: { ...ITEM, priceCents } });

const upload = (id: string, file: File) =>
  call(`/api/admin/registry/${id}/image`, { ...asAdmin, body: pictureForm(file) });

const errorOf = async (response: Response) => (await response.json<{ error: string }>()).error;

describe("admin registry routes", () => {
  it("fail closed without Cloudflare Access", async () => {
    await seedItem("espresso", 70000);
    expect((await call("/api/admin/registry", noAccess)).status).toBe(503);
    expect((await call("/api/admin/registry", { ...noAccess, body: ITEM })).status).toBe(503);
    const patched = await call("/api/admin/registry/espresso", {
      ...noAccess,
      method: "PATCH",
      body: ITEM,
    });
    expect(patched.status).toBe(503);
    const deleted = await call("/api/admin/registry/espresso", { ...noAccess, method: "DELETE" });
    expect(deleted.status).toBe(503);
    const pictured = await call("/api/admin/registry/espresso/image", {
      ...noAccess,
      body: pictureForm(webpFile()),
    });
    expect(pictured.status).toBe(503);
    expect(await publicItems()).toHaveLength(1);
  });
});

describe("adding registry items", () => {
  it("shows a new item on the Registry page, in the order added, without tracking links", async () => {
    const first = await addItem();
    const second = await addItem({ name: "Luggage", priceCents: 113000 });
    expect(await publicItems()).toEqual([
      {
        id: first,
        name: "Espresso Machine",
        description: "For slow Saturday mornings.",
        image: null,
        link: "https://www.example.com/espresso?variant=2",
        priceCents: 70000,
        raisedCents: 0,
      },
      expect.objectContaining({ id: second, name: "Luggage" }),
    ]);
  });

  it("adds an open fund with no link when the cost and link are left out", async () => {
    const id = await addItem({ name: "Honeymoon fund", priceCents: null, link: null });
    expect(await publicItems()).toEqual([
      expect.objectContaining({ id, priceCents: null, link: null, raisedCents: 0 }),
    ]);
  });

  it("refuses missing fields, a zero price and links that aren't web links", async () => {
    const bad = [
      { name: "" },
      { description: " " },
      { priceCents: 0 },
      { priceCents: 12.5 },
      { link: "" },
      { link: "javascript:alert(1)" },
      { link: "ftp://example.com/x" },
      { link: "https://localhost/x" },
    ];
    const responses = await Promise.all(
      bad.map((overrides) =>
        call("/api/admin/registry", { ...asAdmin, body: { ...ITEM, ...overrides } }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(bad.map(() => 400));
    expect(await publicItems()).toEqual([]);
  });
});

describe("editing registry items", () => {
  it("saves new text", async () => {
    const id = await addItem();
    const response = await call(`/api/admin/registry/${id}`, {
      ...asAdmin,
      method: "PATCH",
      body: { ...ITEM, name: "Grinder", priceCents: 25000 },
    });
    expect(response.status).toBe(200);
    expect(await publicItems()).toEqual([
      expect.objectContaining({ name: "Grinder", priceCents: 25000 }),
    ]);
  });

  it("won't lower the price below what guests have given", async () => {
    await seedItem("espresso", 70000, [30000]);
    const lowered = await patchPrice("espresso", 29999);
    expect(lowered.status).toBe(400);
    expect(await errorOf(lowered)).toMatch(/\$300/);
    expect((await patchPrice("espresso", 30000)).status).toBe(200);
  });

  it("turns an item with gifts into an open fund, and back into a goal", async () => {
    await seedItem("espresso", 70000, [30000]);
    expect((await patchPrice("espresso", null)).status).toBe(200);
    expect((await publicItems())[0]).toMatchObject({ priceCents: null, raisedCents: 30000 });
    expect((await patchPrice("espresso", 40000)).status).toBe(200);
    expect((await publicItems())[0]).toMatchObject({ priceCents: 40000 });
  });

  it("removes a link", async () => {
    const id = await addItem();
    const response = await call(`/api/admin/registry/${id}`, {
      ...asAdmin,
      method: "PATCH",
      body: { ...ITEM, link: null },
    });
    expect(response.status).toBe(200);
    expect((await publicItems())[0]).toMatchObject({ link: null });
  });

  it("says when the item is gone", async () => {
    const response = await call("/api/admin/registry/nope", {
      ...asAdmin,
      method: "PATCH",
      body: ITEM,
    });
    expect(response.status).toBe(404);
  });
});

describe("deleting registry items", () => {
  it("removes an item no one has given toward, and its picture", async () => {
    const id = await addItem();
    await call(`/api/admin/registry/${id}/image`, { ...asAdmin, body: pictureForm(webpFile()) });
    const response = await call(`/api/admin/registry/${id}`, { ...asAdmin, method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await publicItems()).toEqual([]);
    expect((await env.PHOTOS.list({ prefix: "registry/" })).objects).toEqual([]);
  });

  it("keeps an item guests have given toward", async () => {
    await seedItem("espresso", 70000, [5000]);
    const response = await call("/api/admin/registry/espresso", { ...asAdmin, method: "DELETE" });
    expect(response.status).toBe(409);
    expect(await publicItems()).toHaveLength(1);
  });

  it("says when the item is already gone", async () => {
    const response = await call("/api/admin/registry/nope", { ...asAdmin, method: "DELETE" });
    expect(response.status).toBe(404);
  });
});

describe("registry pictures", () => {
  it("serves the picture publicly and replaces the old file on a new upload", async () => {
    const id = await addItem();
    expect((await upload(id, webpFile(1))).status).toBe(200);
    const [firstSrc] = (await publicItems()).map((item) => String(item["image"]));
    const served = await call(firstSrc!);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");

    expect((await upload(id, webpFile(2))).status).toBe(200);
    const [secondSrc] = (await publicItems()).map((item) => String(item["image"]));
    expect(secondSrc).not.toBe(firstSrc);
    expect((await call(firstSrc!)).status).toBe(404);
    expect((await env.PHOTOS.list({ prefix: "registry/" })).objects).toHaveLength(1);
  });

  it("removes a picture", async () => {
    const id = await addItem();
    await upload(id, webpFile());
    const [src] = (await publicItems()).map((item) => String(item["image"]));
    const response = await call(`/api/admin/registry/${id}/image`, {
      ...asAdmin,
      method: "DELETE",
    });
    expect(response.status).toBe(200);
    expect((await publicItems())[0]?.["image"]).toBeNull();
    expect((await call(src!)).status).toBe(404);
    expect((await env.PHOTOS.list({ prefix: "registry/" })).objects).toEqual([]);
  });

  it("refuses files that aren't WebP or JPEG, and items that don't exist", async () => {
    const id = await addItem();
    const text = new File(["<svg onload=alert(1)>"], "x.svg", { type: "image/svg+xml" });
    expect((await upload(id, text)).status).toBe(400);
    expect((await upload("nope", webpFile())).status).toBe(404);
    expect((await env.PHOTOS.list({ prefix: "registry/" })).objects).toEqual([]);
  });

  it("doesn't serve bucket files that no item shows", async () => {
    await env.PHOTOS.put("registry/stray", new Uint8Array([1, 2, 3]));
    expect((await call("/media/registry/stray")).status).toBe(404);
  });
});
