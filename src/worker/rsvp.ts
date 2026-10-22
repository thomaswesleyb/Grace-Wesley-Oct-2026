import { Hono, type Context } from "hono";
import {
  rsvpSubmission,
  unlockRequest,
  type ParsedRsvpSubmission,
  type RsvpResult,
} from "@shared/schemas.ts";
import { getSetting, insertRsvp } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sendAlert } from "@worker/notify.ts";

export const rsvp = new Hono<{ Bindings: Env }>();

rsvp.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RSVP_LIMITER.limit({ key: ip });
  if (!success)
    return c.json({ error: "Too many tries. Please wait a minute and try again." }, 429);
  return next();
});

/** Ignores letter case, spaces, dashes, slashes and dots, so "10/23/2027" matches "10232027". */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s./-]/g, "").toLowerCase();
}

const sha256 = async (text: string) =>
  new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

/**
 * Compares fixed-length digests byte by byte without stopping early, so response timing
 * doesn't reveal how much of a guess was right.
 */
async function sameCode(typed: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(typed), sha256(expected)]);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0;
}

/** The reply refusing this code, or null when RSVPs are open and the code is right. */
async function refusal(c: Context<{ Bindings: Env }>, code: string): Promise<Response | null> {
  if ((await getSetting(c.env.DB, "rsvp_open")) !== "1") {
    return c.json({ error: "RSVPs aren't open right now." }, 403);
  }
  const expected = normalizeCode(c.env.RSVP_CODE ?? "");
  if (expected === "") {
    console.error("RSVP refused: the RSVP_CODE secret isn't set (wrangler secret put RSVP_CODE).");
    return c.json({ error: "RSVPs aren't open yet." }, 503);
  }
  if (!(await sameCode(normalizeCode(code), expected))) {
    return c.json({ error: "That code doesn't match. Please check it and try again." }, 403);
  }
  return null;
}

rsvp.post("/unlock", async (c) => {
  const parsed = unlockRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Please enter your RSVP code." }, 400);
  return (await refusal(c, parsed.data.code)) ?? c.json({ ok: true as const });
});

function tally(body: ParsedRsvpSubmission): RsvpResult {
  const attending = body.people.filter((p) => p.attending).length;
  return { attending, declining: body.people.length - attending };
}

function alertLines(body: ParsedRsvpSubmission): string[] {
  const people = body.people.map((p) => {
    const answer = p.attending ? `attending${p.dietary ? ` · ${p.dietary}` : ""}` : "declining";
    return `${p.firstName} ${p.lastName}: ${answer}`;
  });
  return [
    ...people,
    "",
    `Email: ${body.email}`,
    `Song request: ${body.songRequest ?? "-"}`,
    `Note: ${body.note ?? "-"}`,
  ];
}

rsvp.post("/", async (c) => {
  const parsed = rsvpSubmission.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Some answers are missing or too long. Please check the form." }, 400);
  }
  const body = parsed.data;
  const refused = await refusal(c, body.code);
  if (refused !== null) return refused;

  await insertRsvp(c.env.DB, body, new Date().toISOString());
  const result = tally(body);
  const [first] = body.people;
  const subject = `RSVP: ${first?.firstName} ${first?.lastName} (${result.attending} attending, ${result.declining} declining)`;
  c.executionCtx.waitUntil(sendAlert(c.env, subject, alertLines(body)));
  return c.json(result);
});
