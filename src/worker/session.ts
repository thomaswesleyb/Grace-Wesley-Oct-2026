import { type Context, Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { SessionResponse } from "@shared/schemas.ts";
import { deleteSession, getSessionGuest, insertSession, type GuestRow } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";

type AppContext = Context<{ Bindings: Env }>;

/** Sent as `__Host-session`; the prefix makes browsers insist on Secure, Path=/ and no Domain. */
const COOKIE = "session";
/** The longest cookie lifetime browsers allow, which lasts past the wedding for early RSVPs. */
const SESSION_DAYS = 400;

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function hashToken(token: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

/** Gives the browser a new session for `guestId`, replacing any session it had. */
export async function startSession(c: AppContext, guestId: string): Promise<void> {
  const token = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await insertSession(c.env.DB, {
    tokenHash: await hashToken(token),
    guestId,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  setCookie(c, COOKIE, token, {
    prefix: "host",
    httpOnly: true,
    secure: true,
    path: "/",
    sameSite: "Lax",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

/** The guest whose session cookie came with this request, or null. */
export async function sessionGuest(c: AppContext): Promise<GuestRow | null> {
  const token = getCookie(c, COOKIE, "host");
  if (token === undefined) return null;
  return getSessionGuest(c.env.DB, await hashToken(token), new Date().toISOString());
}

/** Who the visitor is at /api/session, and signing out of this browser. */
export const session = new Hono<{ Bindings: Env }>();

session.get("/", async (c) => {
  const guest = await sessionGuest(c);
  return c.json({
    guest: guest === null ? null : { firstName: guest.first_name, lastName: guest.last_name },
  } satisfies SessionResponse);
});

session.delete("/", async (c) => {
  const token = getCookie(c, COOKIE, "host");
  if (token !== undefined) await deleteSession(c.env.DB, await hashToken(token));
  deleteCookie(c, COOKIE, { prefix: "host", secure: true, path: "/" });
  return c.json({ ok: true as const });
});
