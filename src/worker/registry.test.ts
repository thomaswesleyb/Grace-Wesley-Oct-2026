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
