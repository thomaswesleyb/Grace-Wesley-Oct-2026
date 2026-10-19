import { Hono } from "hono";
import { matchInvitation, nameKey } from "@shared/names.ts";
import {
  lookupRequest,
  rsvpSubmission,
  type LookupResponse,
  type ParsedRsvpSubmission,
  type RsvpResult,
} from "@shared/schemas.ts";
import {
  getGuests,
  getInvitationView,
  getSentInvitation,
  getSetting,
  isClosed,
  sentNameCandidates,
  type GuestRow,
} from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sendAlert } from "@worker/notify.ts";

export const rsvp = new Hono<{ Bindings: Env }>();

const NOT_FOUND: LookupResponse = { found: false };

rsvp.post("/lookup", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const { success } = await c.env.LOOKUP_LIMITER.limit({ key: ip });
  if (!success)
    return c.json({ error: "Too many tries. Please wait a minute and try again." }, 429);

  const parsed = lookupRequest.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Please enter your first and last name." }, 400);
  if ((await getSetting(c.env.DB, "rsvp_open")) !== "1") {
    return c.json({ error: "RSVPs aren't open yet." }, 403);
  }

  const typed = nameKey(parsed.data.firstName, parsed.data.lastName);
  const invitationId = matchInvitation(typed, await sentNameCandidates(c.env.DB));
  if (invitationId === null) return c.json(NOT_FOUND);
  const invitation = await getInvitationView(c.env.DB, invitationId, new Date());
  if (invitation === null) return c.json(NOT_FOUND);
  return c.json({ found: true, invitation } satisfies LookupResponse);
});

const ANSWER_EVERYONE = "Please answer for everyone on the invitation.";

function plusOneProblem(body: ParsedRsvpSubmission, invited: GuestRow[]): string | null {
  if (body.plusOne === null) return null;
  const hostId = body.plusOne.hostId;
  const host = invited.find((g) => g.id === hostId);
  if (host === undefined || host.plus_one_allowed !== 1)
    return "This invitation doesn't include a guest.";
  const hostAnswer = body.guests.find((g) => g.id === hostId);
  if (hostAnswer?.attending !== true)
    return "A guest can only come along with someone who is attending.";
  return null;
}

/** Returns an error message when the submission doesn't fit the invitation, else null. */
export function validateAgainstGuests(
  body: ParsedRsvpSubmission,
  guests: GuestRow[],
): string | null {
  const invited = guests.filter((g) => g.plus_one_of === null);
  const invitedIds = new Set(invited.map((g) => g.id));
  const answered = new Set(body.guests.map((g) => g.id));
  const exactlyEveryone =
    answered.size === body.guests.length &&
    answered.size === invitedIds.size &&
    [...answered].every((id) => invitedIds.has(id));
  if (!exactlyEveryone) return ANSWER_EVERYONE;
  return plusOneProblem(body, invited);
}

function buildStatements(
  db: D1Database,
  invitationId: string,
  body: ParsedRsvpSubmission,
  now: string,
) {
  const guard = "(SELECT responded_at FROM invitations WHERE id = ?) IS NULL";
  const statements = body.guests.map((g) =>
    db
      .prepare(
        `UPDATE guests SET attending = ?, dietary = ? WHERE id = ? AND invitation_id = ? AND ${guard}`,
      )
      .bind(g.attending ? 1 : 0, g.attending ? g.dietary : null, g.id, invitationId, invitationId),
  );
  if (body.plusOne !== null) {
    const p = body.plusOne;
    statements.push(
      db
        .prepare(
          `INSERT INTO guests (id, invitation_id, first_name, last_name, name_key, plus_one_allowed,
             plus_one_of, attending, dietary, sort)
           SELECT ?, ?, ?, ?, ?, 0, ?, 1, ?, 1000 WHERE ${guard}`,
        )
        .bind(
          crypto.randomUUID(),
          invitationId,
          p.firstName,
          p.lastName,
          nameKey(p.firstName, p.lastName),
          p.hostId,
          p.dietary,
          invitationId,
        ),
    );
  }
  statements.push(
    db
      .prepare(
        `INSERT INTO rsvp_events (id, invitation_id, payload_json, created_at) SELECT ?, ?, ?, ? WHERE ${guard}`,
      )
      .bind(crypto.randomUUID(), invitationId, JSON.stringify(body), now, invitationId),
    db
      .prepare(
        `UPDATE invitations SET email = ?, note = ?, song_request = ?, responded_at = ?, updated_at = ?
         WHERE id = ? AND responded_at IS NULL`,
      )
      .bind(body.email, body.note, body.songRequest, now, now, invitationId),
  );
  return statements;
}

const ALREADY_RESPONDED = "We already have your RSVP. To change it, please contact us directly.";

/** Why this invitation can't take a first response right now, or null if it can. */
function closedReason(invitation: {
  respond_by: string | null;
  responded_at: string | null;
}): string | null {
  if (isClosed(invitation.respond_by, new Date())) {
    return "RSVPs for this invitation have closed. Please contact us directly.";
  }
  return invitation.responded_at === null ? null : ALREADY_RESPONDED;
}

function alertLines(
  label: string,
  body: ParsedRsvpSubmission,
  attending: number,
  declining: number,
) {
  return [
    `Invitation: ${label}`,
    `Attending: ${attending}, declining: ${declining}`,
    `Email: ${body.email}`,
    `Song request: ${body.songRequest ?? "-"}`,
    `Note: ${body.note ?? "-"}`,
  ];
}

function tally(body: ParsedRsvpSubmission): { attending: number; declining: number } {
  const attending = body.guests.filter((g) => g.attending).length + (body.plusOne === null ? 0 : 1);
  return { attending, declining: body.guests.filter((g) => !g.attending).length };
}

rsvp.post("/:id", async (c) => {
  const invitationId = c.req.param("id");
  const invitation = await getSentInvitation(c.env.DB, invitationId);
  if (invitation === null) return c.json({ error: "We couldn't find that invitation." }, 404);
  const reason = closedReason(invitation);
  if (reason !== null) return c.json({ error: reason }, 409);

  const parsed = rsvpSubmission.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Some answers are missing or too long. Please check the form." }, 400);
  }
  const body = parsed.data;
  const problem = validateAgainstGuests(body, await getGuests(c.env.DB, invitationId));
  if (problem !== null) return c.json({ error: problem }, 400);

  const now = new Date().toISOString();
  const results = await c.env.DB.batch(buildStatements(c.env.DB, invitationId, body, now));
  if (results.at(-1)?.meta.changes !== 1) return c.json({ error: ALREADY_RESPONDED }, 409);

  const { attending, declining } = tally(body);
  const subject = `RSVP: ${invitation.label} (${attending} attending, ${declining} declining)`;
  c.executionCtx.waitUntil(
    sendAlert(c.env, subject, alertLines(invitation.label, body, attending, declining)),
  );
  return c.json({ attending, declining, respondBy: invitation.respond_by } satisfies RsvpResult);
});
