import { Hono } from "hono";
import { matchGuest, typedKeys } from "@shared/names.ts";
import {
  lookupRequest,
  rsvpSubmission,
  type LookupResponse,
  type ParsedRsvpSubmission,
  type RsvpResult,
} from "@shared/schemas.ts";
import {
  getGuest,
  getSetting,
  hasCurrentRsvp,
  insertRsvp,
  nameCandidates,
  type GuestRow,
} from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sendAlert } from "@worker/notify.ts";

export const rsvp = new Hono<{ Bindings: Env }>();

rsvp.use("*", async (c, next) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.RSVP_LIMITER.limit({ key: ip });
  if (!success)
    return c.json({ error: "Too many tries. Please wait a minute and try again." }, 429);
  if ((await getSetting(c.env.DB, "rsvp_open")) !== "1") {
    return c.json({ error: "RSVPs aren't open right now." }, 403);
  }
  return next();
});

/** The same reply for a stranger, an ambiguous name, and a guest with no places. */
const NOT_FOUND: LookupResponse = { found: false };

rsvp.post("/lookup", async (c) => {
  const parsed = lookupRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Please enter your first and last name." }, 400);

  const typed = typedKeys(parsed.data.firstName, parsed.data.lastName);
  const match = matchGuest(typed, await nameCandidates(c.env.DB));
  const guest = match === null ? null : await getGuest(c.env.DB, match.guestId);
  if (match === null || guest === null || guest.spots === 0) return c.json(NOT_FOUND);
  return c.json({
    found: true,
    guest: {
      id: guest.id,
      firstName: guest.first_name,
      lastName: guest.last_name,
      spots: guest.spots,
    },
    exact: match.exact,
    answered: await hasCurrentRsvp(c.env.DB, guest.id),
  } satisfies LookupResponse);
});

const NO_INVITATION = "We couldn't find your invitation. Please look up your name again.";

function tooMany(spots: number): string {
  const places = spots === 1 ? "1 place" : `${spots} places`;
  return `Your invitation has ${places}. Please remove the extra people.`;
}

function tally(body: ParsedRsvpSubmission): RsvpResult {
  const attending = body.people.filter((p) => p.attending).length;
  return { attending, declining: body.people.length - attending };
}

function alertLines(guest: GuestRow, body: ParsedRsvpSubmission): string[] {
  const people = body.people.map((p) => {
    const answer = p.attending ? `attending${p.dietary ? ` · ${p.dietary}` : ""}` : "declining";
    return `${p.firstName} ${p.lastName}: ${answer}`;
  });
  return [
    ...people,
    "",
    `Places on the invitation: ${guest.spots}`,
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
  const guest = await getGuest(c.env.DB, parsed.data.guestId);
  if (guest === null || guest.spots === 0) return c.json({ error: NO_INVITATION }, 400);
  if (parsed.data.people.length > guest.spots) return c.json({ error: tooMany(guest.spots) }, 400);

  const [, ...others] = parsed.data.people;
  const self = {
    ...parsed.data.people[0]!,
    firstName: guest.first_name,
    lastName: guest.last_name,
  };
  const body = { ...parsed.data, people: [self, ...others] };

  const { replaced } = await insertRsvp(c.env.DB, guest.id, body, new Date().toISOString());
  const result = tally(body);
  const changed = replaced ? " (changed)" : "";
  const subject = `RSVP${changed}: ${guest.first_name} ${guest.last_name} (${result.attending} attending, ${result.declining} declining)`;
  c.executionCtx.waitUntil(sendAlert(c.env, subject, alertLines(guest, body)));
  return c.json(result);
});
