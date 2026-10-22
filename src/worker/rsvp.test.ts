import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { lookupResponse, MAX_PARTY } from "@shared/schemas.ts";
import { call, resetDb, rsvpBody, seedGuest } from "@worker/test-helpers.ts";

beforeEach(async () => {
  await resetDb();
  await seedGuest("sam", "Sam", "Lee", 1);
  await seedGuest("margaret", "Margaret", "Parkhill", 2, ["peggy parkhill"]);
  await seedGuest("robert", "Robert", "Hughes", MAX_PARTY);
  await seedGuest("absent", "Dana", "Whitfield", 0);
});

const lookup = (firstName: unknown, lastName: unknown, options: Parameters<typeof call>[1] = {}) =>
  call("/api/rsvp/lookup", { ...options, body: { firstName, lastName } });

async function countRows(): Promise<{ rsvps: number; people: number }> {
  const row = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM rsvps) AS rsvps, (SELECT COUNT(*) FROM rsvp_people) AS people",
  ).first<{ rsvps: number; people: number }>();
  return row ?? { rsvps: -1, people: -1 };
}

const closeRsvps = () =>
  env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'rsvp_open'").run();

const person = (firstName: string, attending = true, dietary = "") => ({
  firstName,
  lastName: "Parkhill",
  attending,
  dietary,
});

describe("POST /api/rsvp/lookup", () => {
  it.each([
    ["the listed name", "Margaret", "Parkhill", true],
    ["any letter case and spacing", "  margaret ", "PARKHILL", true],
    ["an alias", "Peggy", "Parkhill", true],
    ["a typo, to confirm", "Margret", "Parkhil", false],
  ])("finds a guest by %s", async (_how, first, last, exact) => {
    const response = await lookup(first, last);
    expect(response.status).toBe(200);
    expect(lookupResponse.parse(await response.json())).toEqual({
      found: true,
      guest: { id: "margaret", firstName: "Margaret", lastName: "Parkhill", spots: 2 },
      exact,
      answered: false,
    });
  });

  it("finds a guest by a common nickname, to confirm", async () => {
    const body = lookupResponse.parse(await (await lookup("Bob", "Hughes")).json());
    expect(body).toMatchObject({ found: true, guest: { id: "robert" }, exact: false });
  });

  it("gives a stranger, a guest with no places, and an ambiguous name the same reply", async () => {
    await seedGuest("twin-a", "Jane", "Parker", 1);
    await seedGuest("twin-b", "Jane", "Porter", 1);
    const replies = await Promise.all([
      lookup("Someone", "Else"),
      lookup("Dana", "Whitfield"),
      lookup("Jane", "Parter"),
    ]);
    const bodies = await Promise.all(replies.map((r) => r.text()));
    expect(replies.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(new Set(bodies)).toEqual(new Set([JSON.stringify({ found: false })]));
  });

  it("says when the guest has already answered", async () => {
    await call("/api/rsvp", { body: rsvpBody() });
    const body = lookupResponse.parse(await (await lookup("Sam", "Lee")).json());
    expect(body).toMatchObject({ found: true, answered: true });
  });

  it("rejects a missing name", async () => {
    expect((await lookup("Sam", "")).status).toBe(400);
    expect((await lookup("Sam", undefined)).status).toBe(400);
    expect((await call("/api/rsvp/lookup", { body: "not json" })).status).toBe(400);
  });

  it("refuses lookups while RSVPs are closed", async () => {
    await closeRsvps();
    expect((await lookup("Sam", "Lee")).status).toBe(403);
  });

  it("limits tries from one address", async () => {
    const headers = { "cf-connecting-ip": "203.0.113.7" };
    const tries = await Promise.all(
      Array.from({ length: 12 }, () => lookup("No", "One", { headers })),
    );
    expect(tries.map((r) => r.status)).toContain(429);
    expect((await lookup("Sam", "Lee", { headers })).status).toBe(429);
  });
});

describe("POST /api/rsvp", () => {
  it("saves everyone on the form and reports the tally", async () => {
    const response = await call("/api/rsvp", {
      body: rsvpBody({
        guestId: "margaret",
        people: [person("Margaret", true, "vegetarian"), person("Tom", false, "ignored")],
        songRequest: "September",
        note: "",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attending: 1, declining: 1 });

    const rsvp = await env.DB.prepare("SELECT * FROM rsvps").first();
    expect(rsvp).toMatchObject({
      guest_id: "margaret",
      email: "guest@example.com",
      song_request: "September",
      note: null,
      replaced_at: null,
    });
    const { results } = await env.DB.prepare(
      "SELECT first_name, attending, dietary FROM rsvp_people ORDER BY sort",
    ).all();
    expect(results).toEqual([
      { first_name: "Margaret", attending: 1, dietary: "vegetarian" },
      { first_name: "Tom", attending: 0, dietary: null },
    ]);
  });

  it("saves the guest under their listed name, whatever was sent", async () => {
    const people = [{ firstName: "Imposter", lastName: "X", attending: true, dietary: "" }];
    await call("/api/rsvp", { body: rsvpBody({ people }) });
    const row = await env.DB.prepare("SELECT first_name, last_name FROM rsvp_people").first();
    expect(row).toEqual({ first_name: "Sam", last_name: "Lee" });
  });

  it("lets anyone on the invitation attend when the listed guest declines", async () => {
    const people = [person("Margaret", false), person("Tom", true)];
    const response = await call("/api/rsvp", { body: rsvpBody({ guestId: "margaret", people }) });
    expect(await response.json()).toEqual({ attending: 1, declining: 1 });
  });

  it("replaces the guest's earlier RSVP and keeps it as history", async () => {
    expect((await call("/api/rsvp", { body: rsvpBody() })).status).toBe(200);
    const people = [{ ...rsvpBody().people[0], attending: false }];
    expect((await call("/api/rsvp", { body: rsvpBody({ people }) })).status).toBe(200);

    const { results } = await env.DB.prepare(
      `SELECT r.replaced_at IS NULL AS current, p.attending
       FROM rsvps r JOIN rsvp_people p ON p.rsvp_id = r.id ORDER BY r.created_at, r.rowid`,
    ).all();
    expect(results).toEqual([
      { current: 0, attending: 1 },
      { current: 1, attending: 0 },
    ]);
  });

  it("keeps exactly one current RSVP when a guest sends several at once", async () => {
    const sends = Array.from({ length: 4 }, () => call("/api/rsvp", { body: rsvpBody() }));
    expect((await Promise.all(sends)).map((r) => r.status)).toEqual([200, 200, 200, 200]);
    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM rsvps WHERE guest_id = 'sam' AND replaced_at IS NULL",
    ).first<{ n: number }>();
    expect(row?.n).toBe(1);
  });

  it("saves nothing while RSVPs are closed", async () => {
    await closeRsvps();
    expect((await call("/api/rsvp", { body: rsvpBody() })).status).toBe(403);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });
});

describe("POST /api/rsvp rejects", () => {
  const one = { firstName: "A", lastName: "B", attending: true, dietary: "" };

  it.each([
    ["an unknown guest", { guestId: "nobody" }],
    ["a guest with no places", { guestId: "absent" }],
    ["more people than the guest's places", { people: [one, one] }],
    ["no guest id", { guestId: undefined }],
    ["no people", { people: [] }],
    [
      `more than ${MAX_PARTY} people`,
      { guestId: "robert", people: Array.from({ length: MAX_PARTY + 1 }, () => one) },
    ],
    ["a blank name", { people: [{ ...one, firstName: "  " }] }],
    ["a missing answer", { people: [{ firstName: "A", lastName: "B" }] }],
    ["an invalid email", { email: "nope" }],
    ["an over-long note", { note: "x".repeat(1001) }],
  ])("%s", async (_name, overrides) => {
    const response = await call("/api/rsvp", { body: rsvpBody(overrides) });
    expect(response.status).toBe(400);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });

  it("accepts exactly the guest's number of places", async () => {
    const people = Array.from({ length: MAX_PARTY }, () => one);
    const response = await call("/api/rsvp", { body: rsvpBody({ guestId: "robert", people }) });
    expect(response.status).toBe(200);
  });
});
