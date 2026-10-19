import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { answerAll, call, resetDb, seed } from "@worker/test-helpers.ts";

beforeEach(resetDb);

const lookup = (firstName: string, lastName: string) =>
  call("/api/rsvp/lookup", { body: { firstName, lastName } });

describe("POST /api/rsvp/lookup", () => {
  it("finds a sent invitation by exact name, ignoring case and accents", async () => {
    await seed({
      label: "Smith household",
      guests: [
        { first: "José", last: "Smith" },
        { first: "Ann", last: "Smith" },
      ],
    });
    const response = await lookup("jose", "SMITH");
    expect(response.status).toBe(200);
    const body = await response.json<{
      found: true;
      invitation: { label: string; guests: unknown[] };
    }>();
    expect(body.found).toBe(true);
    expect(body.invitation.label).toBe("Smith household");
    expect(body.invitation.guests).toHaveLength(2);
  });

  it("tolerates a small typo in a long name", async () => {
    await seed({ label: "Parkhill", guests: [{ first: "Margaret", last: "Parkhill" }] });
    const body = await (await lookup("Margret", "Parkhill")).json<{ found: boolean }>();
    expect(body.found).toBe(true);
  });

  it("answers a held invitation exactly like a stranger", async () => {
    await seed({
      label: "Wave two",
      wave: 2,
      status: "held",
      guests: [{ first: "Held", last: "Guest" }],
    });
    const held = await lookup("Held", "Guest");
    const stranger = await lookup("Nobody", "Atall");
    expect(held.status).toBe(stranger.status);
    expect(await held.text()).toBe(await stranger.text());
  });

  it("never reveals the wave", async () => {
    await seed({ label: "Later household", wave: 2, guests: [{ first: "Sent", last: "Later" }] });
    const body = await (
      await lookup("Sent", "Later")
    ).json<{ invitation: Record<string, unknown> }>();
    expect(Object.keys(body.invitation).toSorted()).toEqual([
      "closed",
      "guests",
      "id",
      "label",
      "respondBy",
      "responded",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/"(wave|priority|status|sent_at)"/);
  });

  it("ignores held guests when matching, so they can't block a sent guest's typo match", async () => {
    await seed({
      label: "Held",
      status: "held",
      wave: 2,
      guests: [{ first: "Katherine", last: "Jones" }],
    });
    await seed({ label: "Sent", guests: [{ first: "Katherina", last: "Jones" }] });
    const body = await (
      await lookup("Katherinx", "Jones")
    ).json<{ invitation?: { label: string } }>();
    expect(body.invitation?.label).toBe("Sent");
  });

  it("never returns the invite email from the guest list", async () => {
    await seed({
      label: "Private",
      guests: [{ first: "Quinn", last: "Private", email: "quinn@example.com" }],
    });
    const text = await (await lookup("Quinn", "Private")).text();
    expect(text).toContain("Quinn");
    expect(text).not.toContain("quinn@example.com");
  });

  it("rejects an empty name", async () => {
    expect((await lookup("", "Smith")).status).toBe(400);
  });

  it("rejects a body that isn't JSON", async () => {
    expect((await call("/api/rsvp/lookup", { body: "not json" })).status).toBe(400);
  });

  it("refuses lookups while RSVPs are closed site-wide", async () => {
    await env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'rsvp_open'").run();
    expect((await lookup("Any", "One")).status).toBe(403);
  });

  it("returns no match when two invitations are equally close", async () => {
    await seed({ label: "A", guests: [{ first: "Katherine", last: "Jones" }] });
    await seed({ label: "B", guests: [{ first: "Katherina", last: "Jones" }] });
    const body = await (await lookup("Katherinx", "Jones")).json<{ found: boolean }>();
    expect(body.found).toBe(false);
  });
});

describe("POST /api/rsvp/:id", () => {
  it("records answers, the plus-one, and the audit event", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Lee",
      guests: [
        { first: "Sam", last: "Lee", plusOne: true },
        { first: "Kim", last: "Lee" },
      ],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: {
        guests: [
          { id: guestIds[0], attending: true, dietary: "vegetarian" },
          { id: guestIds[1], attending: false, dietary: "ignored" },
        ],
        plusOne: { hostId: guestIds[0], firstName: "Pat", lastName: "Doe", dietary: "" },
        email: "sam@example.com",
        songRequest: "September",
        note: "",
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attending: 2, declining: 1, respondBy: null });

    const { results } = await env.DB.prepare(
      "SELECT first_name, attending, dietary, plus_one_of FROM guests WHERE invitation_id = ? ORDER BY sort",
    )
      .bind(invitationId)
      .all();
    expect(results).toEqual([
      { first_name: "Sam", attending: 1, dietary: "vegetarian", plus_one_of: null },
      { first_name: "Kim", attending: 0, dietary: null, plus_one_of: null },
      { first_name: "Pat", attending: 1, dietary: null, plus_one_of: guestIds[0] },
    ]);
    const invitation = await env.DB.prepare(
      "SELECT email, song_request, note, responded_at FROM invitations WHERE id = ?",
    )
      .bind(invitationId)
      .first<{
        email: string;
        song_request: string;
        note: string | null;
        responded_at: string | null;
      }>();
    expect(invitation).toMatchObject({
      email: "sam@example.com",
      song_request: "September",
      note: null,
    });
    expect(invitation?.responded_at).not.toBeNull();
    const events = await env.DB.prepare("SELECT COUNT(*) AS n FROM rsvp_events").first<{
      n: number;
    }>();
    expect(events?.n).toBe(1);
  });

  it("refuses a second response", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Once",
      guests: [{ first: "One", last: "Time" }],
    });
    expect(
      (await call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, true) })).status,
    ).toBe(200);
    expect(
      (await call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, false) })).status,
    ).toBe(409);
  });

  it("accepts exactly one of two simultaneous first responses", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Race",
      guests: [{ first: "Fast", last: "Finger" }],
    });
    const [a, b] = await Promise.all([
      call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, true) }),
      call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, false) }),
    ]);
    expect([a.status, b.status].toSorted()).toEqual([200, 409]);
    const events = await env.DB.prepare("SELECT COUNT(*) AS n FROM rsvp_events").first<{
      n: number;
    }>();
    expect(events?.n).toBe(1);
  });
});

describe("POST /api/rsvp/:id rejects", () => {
  it("requires an answer for everyone on the invitation", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Pair",
      guests: [
        { first: "A", last: "Pair" },
        { first: "B", last: "Pair" },
      ],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: answerAll(guestIds.slice(0, 1), true),
    });
    expect(response.status).toBe(400);
  });

  it("rejects guests from another invitation", async () => {
    const mine = await seed({ label: "Mine", guests: [{ first: "Me", last: "Mine" }] });
    const theirs = await seed({ label: "Theirs", guests: [{ first: "You", last: "Theirs" }] });
    const response = await call(`/api/rsvp/${mine.invitationId}`, {
      body: answerAll(theirs.guestIds, true),
    });
    expect(response.status).toBe(400);
  });

  it("rejects a plus-one the invitation doesn't allow", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Solo",
      guests: [{ first: "No", last: "Guest" }],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: {
        ...answerAll(guestIds, true),
        plusOne: { hostId: guestIds[0], firstName: "Extra", lastName: "Person" },
      },
    });
    expect(response.status).toBe(400);
  });

  it("rejects a plus-one whose host is declining", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Host",
      guests: [{ first: "Home", last: "Body", plusOne: true }],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: {
        ...answerAll(guestIds, false),
        plusOne: { hostId: guestIds[0], firstName: "Lonely", lastName: "Guest" },
      },
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for a held invitation", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Held",
      status: "held",
      guests: [{ first: "Not", last: "Yet" }],
    });
    expect(
      (await call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, true) })).status,
    ).toBe(404);
  });

  it("closes after the wave deadline", async () => {
    await env.DB.prepare("UPDATE waves SET respond_by = '2020-01-01' WHERE wave = 1").run();
    const { invitationId, guestIds } = await seed({
      label: "Late",
      guests: [{ first: "Too", last: "Late" }],
    });
    expect(
      (await call(`/api/rsvp/${invitationId}`, { body: answerAll(guestIds, true) })).status,
    ).toBe(409);
    const body = await (await lookup("Too", "Late")).json<{ invitation: { closed: boolean } }>();
    expect(body.invitation.closed).toBe(true);
  });

  it("rejects an invalid email", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Mail",
      guests: [{ first: "Bad", last: "Mail" }],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: { ...answerAll(guestIds, true), email: "nope" },
    });
    expect(response.status).toBe(400);
  });

  it("rejects an over-long note", async () => {
    const { invitationId, guestIds } = await seed({
      label: "Long",
      guests: [{ first: "Long", last: "Note" }],
    });
    const response = await call(`/api/rsvp/${invitationId}`, {
      body: { ...answerAll(guestIds, true), note: "x".repeat(1001) },
    });
    expect(response.status).toBe(400);
  });
});
