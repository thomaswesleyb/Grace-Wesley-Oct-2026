import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_PARTY } from "@shared/schemas.ts";
import { normalizeCode } from "@worker/rsvp.ts";
import { CODE, call, resetDb, rsvpBody } from "@worker/test-helpers.ts";

beforeEach(resetDb);

const unlock = (code: unknown, options: Parameters<typeof call>[1] = {}) =>
  call("/api/rsvp/unlock", { ...options, body: { code } });

async function countRows(): Promise<{ rsvps: number; people: number }> {
  const row = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM rsvps) AS rsvps, (SELECT COUNT(*) FROM rsvp_people) AS people",
  ).first<{ rsvps: number; people: number }>();
  return row ?? { rsvps: -1, people: -1 };
}

describe("normalizeCode", () => {
  it("ignores case, spaces, dashes, slashes and dots", () => {
    expect(normalizeCode(" 10/23/2027 ")).toBe("10232027");
    expect(normalizeCode("10-23-2027")).toBe("10232027");
    expect(normalizeCode("10.23.2027")).toBe("10232027");
    expect(normalizeCode("AbC")).toBe("abc");
  });
});

describe("POST /api/rsvp/unlock", () => {
  it.each([CODE, "10/23/2027", " 10-23-2027 "])("accepts %j", async (code) => {
    const response = await unlock(code);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it.each(["10232026", "1023", `${CODE}0`, ""])(
    "rejects %j without revealing the real code",
    async (code) => {
      const response = await unlock(code);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain(CODE);
    },
  );

  it("fails closed when RSVP_CODE is unset or blank", async () => {
    expect((await unlock(CODE, { env: { RSVP_CODE: "" } })).status).toBe(503);
    expect((await unlock("", { env: { RSVP_CODE: "  " } })).status).toBe(503);
  });

  it("refuses every code while RSVPs are closed", async () => {
    await env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'rsvp_open'").run();
    expect((await unlock(CODE)).status).toBe(403);
  });

  it("rejects a malformed request", async () => {
    expect((await call("/api/rsvp/unlock", { body: "not json" })).status).toBe(400);
    expect((await unlock(12345678)).status).toBe(400);
    expect((await unlock("x".repeat(41))).status).toBe(400);
  });

  it("limits tries from one address", async () => {
    const headers = { "cf-connecting-ip": "203.0.113.7" };
    const tries = await Promise.all(Array.from({ length: 12 }, () => unlock("wrong", { headers })));
    expect(tries.map((r) => r.status)).toContain(429);
    expect((await unlock(CODE, { headers })).status).toBe(429);
  });
});

describe("POST /api/rsvp", () => {
  it("saves everyone on the form and reports the tally", async () => {
    const response = await call("/api/rsvp", {
      body: rsvpBody({
        people: [
          { firstName: "Sam", lastName: "Lee", attending: true, dietary: "vegetarian" },
          { firstName: "Kim", lastName: "Lee", attending: false, dietary: "ignored" },
          { firstName: "Pat", lastName: "Doe", attending: true, dietary: "" },
        ],
        songRequest: "September",
        note: "",
      }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ attending: 2, declining: 1 });

    const rsvp = await env.DB.prepare("SELECT * FROM rsvps").first();
    expect(rsvp).toMatchObject({
      email: "guest@example.com",
      song_request: "September",
      note: null,
    });
    const { results } = await env.DB.prepare(
      "SELECT first_name, attending, dietary FROM rsvp_people ORDER BY sort",
    ).all();
    expect(results).toEqual([
      { first_name: "Sam", attending: 1, dietary: "vegetarian" },
      { first_name: "Kim", attending: 0, dietary: null },
      { first_name: "Pat", attending: 1, dietary: null },
    ]);
  });

  it("keeps every submission, even from the same household", async () => {
    expect((await call("/api/rsvp", { body: rsvpBody() })).status).toBe(200);
    expect((await call("/api/rsvp", { body: rsvpBody() })).status).toBe(200);
    expect(await countRows()).toEqual({ rsvps: 2, people: 2 });
  });

  it("saves nothing when the code is wrong", async () => {
    const response = await call("/api/rsvp", { body: rsvpBody({ code: "00000000" }) });
    expect(response.status).toBe(403);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });

  it("saves nothing when RSVP_CODE is unset", async () => {
    const response = await call("/api/rsvp", { body: rsvpBody(), env: { RSVP_CODE: "" } });
    expect(response.status).toBe(503);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });

  it("saves nothing while RSVPs are closed", async () => {
    await env.DB.prepare("UPDATE settings SET value = '0' WHERE key = 'rsvp_open'").run();
    expect((await call("/api/rsvp", { body: rsvpBody() })).status).toBe(403);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });
});

describe("POST /api/rsvp rejects", () => {
  const person = { firstName: "A", lastName: "B", attending: true, dietary: "" };

  it.each([
    ["no people", { people: [] }],
    [
      `more than ${MAX_PARTY} people`,
      { people: Array.from({ length: MAX_PARTY + 1 }, () => person) },
    ],
    ["a blank name", { people: [{ ...person, firstName: "  " }] }],
    ["a missing answer", { people: [{ firstName: "A", lastName: "B" }] }],
    ["an invalid email", { email: "nope" }],
    ["an over-long note", { note: "x".repeat(1001) }],
    ["a missing code", { code: undefined }],
  ])("%s", async (_name, overrides) => {
    const response = await call("/api/rsvp", { body: rsvpBody(overrides) });
    expect(response.status).toBe(400);
    expect(await countRows()).toEqual({ rsvps: 0, people: 0 });
  });

  it("accepts exactly the maximum party size", async () => {
    const people = Array.from({ length: MAX_PARTY }, () => person);
    expect((await call("/api/rsvp", { body: rsvpBody({ people }) })).status).toBe(200);
  });
});
