import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { env } from "cloudflare:workers";
import { nameKey } from "@shared/names.ts";
import app from "@worker/index.ts";
import type { Env } from "@worker/env.ts";

export interface SeedGuest {
  first: string;
  last: string;
  plusOne?: boolean;
  email?: string;
}

export interface SeedSpec {
  label: string;
  wave?: number;
  status?: "held" | "sent";
  guests: SeedGuest[];
}

export interface Seeded {
  invitationId: string;
  guestIds: string[];
}

export async function resetDb(): Promise<void> {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM contributions"),
    env.DB.prepare("DELETE FROM registry_items"),
    env.DB.prepare("DELETE FROM rsvp_events"),
    env.DB.prepare("DELETE FROM guests"),
    env.DB.prepare("DELETE FROM invitations"),
    env.DB.prepare("UPDATE waves SET respond_by = NULL"),
    env.DB.prepare("UPDATE settings SET value = '1' WHERE key = 'rsvp_open'"),
  ]);
}

export async function seed(spec: SeedSpec): Promise<Seeded> {
  const invitationId = crypto.randomUUID();
  const guestIds = spec.guests.map(() => crypto.randomUUID());
  const status = spec.status ?? "sent";
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO invitations (id, label, wave, priority, status, sent_at) VALUES (?, ?, ?, 1, ?, ?)",
    ).bind(
      invitationId,
      spec.label,
      spec.wave ?? 1,
      status,
      status === "sent" ? "2026-10-23T00:00:00Z" : null,
    ),
    ...spec.guests.map((g, i) =>
      env.DB.prepare(
        `INSERT INTO guests (id, invitation_id, first_name, last_name, name_key, plus_one_allowed, email, sort)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        guestIds[i]!,
        invitationId,
        g.first,
        g.last,
        nameKey(g.first, g.last),
        g.plusOne ? 1 : 0,
        g.email ?? null,
        i,
      ),
    ),
  ]);
  return { invitationId, guestIds };
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
  } = {},
): Promise<Response> {
  ipCounter += 1;
  const init: RequestInit = {
    method: options.body === undefined ? "GET" : "POST",
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

export function answerAll(guestIds: string[], attending: boolean) {
  return {
    guests: guestIds.map((id) => ({ id, attending, dietary: "" })),
    email: "guest@example.com",
  };
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
