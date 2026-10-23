import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { nameKey } from "@shared/names.ts";
import app from "@worker/index.ts";
import type { Env } from "@worker/env.ts";

export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM photos"),
    env.DB.prepare("DELETE FROM sessions"),
    env.DB.prepare("DELETE FROM labyrinth_runs"),
    env.DB.prepare("DELETE FROM questions"),
    env.DB.prepare("DELETE FROM contributions"),
    env.DB.prepare("DELETE FROM registry_items"),
    env.DB.prepare("DELETE FROM rsvp_people"),
    env.DB.prepare("DELETE FROM rsvps"),
    env.DB.prepare("DELETE FROM guest_aliases"),
    env.DB.prepare("DELETE FROM guests"),
    env.DB.prepare("UPDATE settings SET value = '1' WHERE key = 'rsvp_open'"),
    env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'photo_uploads_open'"),
  ]);
  const { objects } = await env.PHOTOS.list();
  if (objects.length > 0) await env.PHOTOS.delete(objects.map((o) => o.key));
}

/** Adds one guest to the guest list, with optional alias keys. */
export async function seedGuest(
  id: string,
  first: string,
  last: string,
  spots: number,
  aliasKeys: string[] = [],
): Promise<void> {
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO guests (id, first_name, last_name, name_key, spots, sort) VALUES (?, ?, ?, ?, ?, 0)",
    ).bind(id, first, last, nameKey(first, last), spots),
    ...aliasKeys.map((key) =>
      env.DB.prepare("INSERT INTO guest_aliases (guest_id, name_key) VALUES (?, ?)").bind(id, key),
    ),
  ]);
}

/** A valid RSVP from guest "sam" (see `seedGuest`) attending alone; spread overrides on top. */
export function rsvpBody(overrides: Record<string, unknown> = {}) {
  return {
    guestId: "sam",
    people: [{ firstName: "Sam", lastName: "Lee", attending: true, dietary: "" }],
    email: "guest@example.com",
    ...overrides,
  };
}

let ipCounter = 0;

/** A FormData or string body is sent as is; anything else as JSON. */
function encodeBody(body: unknown): { body?: BodyInit; headers: Record<string, string> } {
  if (body === undefined) return { headers: { "content-type": "application/json" } };
  if (body instanceof FormData) return { body, headers: {} };
  const json = typeof body === "string" ? body : JSON.stringify(body);
  return { body: json, headers: { "content-type": "application/json" } };
}

/** Calls the API with a fresh client IP each time so tests don't share a rate-limit bucket. */
export async function call(
  path: string,
  options: {
    /** A FormData body is sent as multipart; anything else as JSON. */
    body?: unknown;
    headers?: Record<string, string>;
    env?: Partial<Env>;
    origin?: string;
    /** Defaults to POST with a body, GET without. */
    method?: string;
  } = {},
): Promise<Response> {
  ipCounter += 1;
  const encoded = encodeBody(options.body);
  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "cf-connecting-ip": `10.0.0.${ipCounter % 250}`,
      ...encoded.headers,
      ...options.headers,
    },
  };
  if (encoded.body !== undefined) init.body = encoded.body;
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
