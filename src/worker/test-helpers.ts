import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import app from "@worker/index.ts";
import type { Env } from "@worker/env.ts";

/** Matches the RSVP_CODE binding in vitest.config.ts. */
export const CODE = "10232027";

export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM contributions"),
    env.DB.prepare("DELETE FROM registry_items"),
    env.DB.prepare("DELETE FROM rsvp_people"),
    env.DB.prepare("DELETE FROM rsvps"),
    env.DB.prepare("UPDATE settings SET value = '1' WHERE key = 'rsvp_open'"),
  ]);
}

/** A valid RSVP from one attending guest; spread overrides on top. */
export function rsvpBody(overrides: Record<string, unknown> = {}) {
  return {
    code: CODE,
    people: [{ firstName: "Sam", lastName: "Lee", attending: true, dietary: "" }],
    email: "guest@example.com",
    ...overrides,
  };
}

let ipCounter = 0;

/** Calls the API with a fresh client IP each time so tests don't share a rate-limit bucket. */
export async function call(
  path: string,
  options: {
    body?: unknown;
    headers?: Record<string, string>;
    env?: Partial<Env>;
    origin?: string;
    /** Defaults to POST with a body, GET without. */
    method?: string;
  } = {},
): Promise<Response> {
  ipCounter += 1;
  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "cf-connecting-ip": `10.0.0.${ipCounter % 250}`,
      "content-type": "application/json",
      ...options.headers,
    },
  };
  if (options.body !== undefined)
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  const ctx = createExecutionContext();
  const response = await app.request(
    `${options.origin ?? "https://wedding.test"}${path}`,
    init,
    { ...env, ...options.env },
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

export async function seedItem(
  id: string,
  priceCents: number,
  paidCents: number[] = [],
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO registry_items (id, name, price_cents, sort) VALUES (?, ?, ?, 0)",
    ).bind(id, `Item ${id}`, priceCents),
    ...paidCents.map((amount, i) =>
      env.DB.prepare(
        `INSERT INTO contributions (id, item_id, stripe_session_id, amount_cents, name, status, created_at)
         VALUES (?, ?, ?, ?, 'Seed', 'paid', '2026-10-20T00:00:00Z')`,
      ).bind(crypto.randomUUID(), id, `cs_seed_${id}_${i}`, amount),
    ),
  ]);
}
