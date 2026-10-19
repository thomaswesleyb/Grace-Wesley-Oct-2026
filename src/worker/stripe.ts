const STRIPE_API = "https://api.stripe.com/v1";
/** Stripe's default tolerance for webhook timestamps, in seconds. */
const SIGNATURE_TOLERANCE_S = 300;

export interface CheckoutParams {
  itemId: string;
  itemName: string;
  amountCents: number;
  giverName: string;
  note: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
}

/** Creates a hosted Checkout session for one gift. Card data never touches this worker. */
export async function createCheckoutSession(
  secretKey: string,
  p: CheckoutParams,
): Promise<CheckoutSession> {
  const form = new URLSearchParams({
    mode: "payment",
    success_url: p.successUrl,
    cancel_url: p.cancelUrl,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(p.amountCents),
    "line_items[0][price_data][product_data][name]": `Gift toward: ${p.itemName}`,
    "metadata[item_id]": p.itemId,
    "metadata[giver_name]": p.giverName,
    "metadata[note]": p.note ?? "",
  });
  const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  return parseSession(response);
}

async function parseSession(response: Response): Promise<CheckoutSession> {
  const body = (await response.json().catch(() => null)) as {
    id?: string;
    url?: string;
    error?: { message?: string };
  } | null;
  if (response.ok && body?.id && body.url) return { id: body.id, url: body.url };
  const detail = body?.error?.message ?? "no details";
  throw new Error(`Stripe checkout session failed (${response.status}): ${detail}`);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** HMAC-SHA256 hex signature in Stripe's `t.payload` scheme. Exported for tests. */
export async function signStripePayload(
  payload: string,
  timestamp: number,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)),
  );
}

/**
 * Checks a `Stripe-Signature` header (`t=…,v1=…`) against the raw body.
 * Rejects stale timestamps so a captured request can't be replayed later.
 */
export async function verifyStripeSignature(
  payload: string,
  header: string | undefined,
  secret: string,
  nowSeconds: number,
): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string | undefined]);
  const timestamp = Number(parts.find(([k]) => k === "t")?.[1]);
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_S) return false;
  const expected = await signStripePayload(payload, timestamp, secret);
  return signatures.some((signature) => timingSafeEqual(signature, expected));
}
