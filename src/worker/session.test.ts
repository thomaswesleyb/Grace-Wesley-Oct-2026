import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { MAX_RUN_MS, photoUploadResult, sessionResponse } from "@shared/schemas.ts";
import { call, resetDb, rsvpBody, seedGuest } from "@worker/test-helpers.ts";

beforeEach(async () => {
  await resetDb();
  await seedGuest("sam", "Sam", "Lee", 2);
  await seedGuest("kim", "Kim", "Moss", 1);
});

const SESSION_COOKIE = /__Host-session=([0-9a-f]{64})/;

/** Sends sam's RSVP and returns the session cookie it set, as a Cookie header value. */
async function rsvpAndGetCookie(): Promise<string> {
  const response = await call("/api/rsvp", { body: rsvpBody() });
  expect(response.status).toBe(200);
  const token = SESSION_COOKIE.exec(response.headers.get("set-cookie") ?? "")?.[1];
  expect(token).toBeDefined();
  return `__Host-session=${token}`;
}

const withCookie = (cookie: string) => ({ headers: { cookie } });

async function whoAmI(cookie?: string) {
  const response = await call("/api/session", cookie === undefined ? {} : withCookie(cookie));
  expect(response.status).toBe(200);
  return sessionResponse.parse(await response.json()).guest;
}

describe("sessions", () => {
  it("start when a guest sends an RSVP, in a cookie scripts can't read", async () => {
    const response = await call("/api/rsvp", { body: rsvpBody() });
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toMatch(SESSION_COOKIE);
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/Secure/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\//);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("know the guest on later visits", async () => {
    const cookie = await rsvpAndGetCookie();
    expect(await whoAmI(cookie)).toEqual({ firstName: "Sam", lastName: "Lee" });
  });

  it("store only a hash of the token", async () => {
    const cookie = await rsvpAndGetCookie();
    const token = cookie.split("=")[1];
    const { results } = await env.DB.prepare("SELECT token_hash FROM sessions").all<{
      token_hash: string;
    }>();
    expect(results).toHaveLength(1);
    expect(results[0]?.token_hash).not.toBe(token);
  });

  it("aren't started by a refused RSVP", async () => {
    const people = [1, 2, 3].map((n) => ({
      firstName: `P${n}`,
      lastName: "Lee",
      attending: true,
      dietary: "",
    }));
    const response = await call("/api/rsvp", { body: rsvpBody({ people }) });
    expect(response.status).toBe(400);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it.each([
    ["no cookie", undefined],
    ["an unknown token", `__Host-session=${"0".repeat(64)}`],
    ["a cookie without the __Host- prefix", "session=abc"],
  ])("say no one is signed in with %s", async (_how, cookie) => {
    expect(await whoAmI(cookie)).toBeNull();
  });

  it("end when they expire", async () => {
    const cookie = await rsvpAndGetCookie();
    await env.DB.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect(await whoAmI(cookie)).toBeNull();
  });

  it("end when the guest no longer has places", async () => {
    const cookie = await rsvpAndGetCookie();
    await env.DB.prepare("UPDATE guests SET spots = 0 WHERE id = 'sam'").run();
    expect(await whoAmI(cookie)).toBeNull();
  });

  it("end on sign-out, which clears the cookie", async () => {
    const cookie = await rsvpAndGetCookie();
    const response = await call("/api/session", { ...withCookie(cookie), method: "DELETE" });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/__Host-session=;.*Max-Age=0/i);
    expect(await whoAmI(cookie)).toBeNull();
  });
});

const run = (body: unknown, cookie?: string) =>
  call("/api/labyrinth/runs", { body, ...(cookie === undefined ? {} : withCookie(cookie)) });

describe("POST /api/labyrinth/runs", () => {
  it("saves a finished walk under the session's guest", async () => {
    const cookie = await rsvpAndGetCookie();
    const response = await run({ animal: "fox", durationMs: 42_317 }, cookie);
    expect(response.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT guest_id, animal, duration_ms FROM labyrinth_runs",
    ).first();
    expect(row).toEqual({ guest_id: "sam", animal: "fox", duration_ms: 42_317 });
  });

  it("refuses a visitor without a session", async () => {
    expect((await run({ animal: "fox", durationMs: 42_317 })).status).toBe(401);
    expect((await run({ animal: "fox", durationMs: 1 }, "__Host-session=bad")).status).toBe(401);
  });

  it.each([
    ["a zero time", { animal: "fox", durationMs: 0 }],
    ["a fractional time", { animal: "fox", durationMs: 1.5 }],
    ["a time over a day", { animal: "deer", durationMs: MAX_RUN_MS + 1 }],
    ["an unknown animal", { animal: "owl", durationMs: 1000 }],
    ["a missing time", { animal: "deer" }],
    ["a body that isn't JSON", "not json"],
  ])("refuses %s", async (_what, body) => {
    const cookie = await rsvpAndGetCookie();
    expect((await run(body, cookie)).status).toBe(400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM labyrinth_runs").first("n");
    expect(count).toBe(0);
  });
});

const ascii = (text: string) => [...text].map((ch) => ch.charCodeAt(0));
const webp = () => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), 1]);

function form(names: Record<string, string> = {}): FormData {
  const body = new FormData();
  body.set("large", new File([webp()], "large.webp", { type: "image/webp" }));
  body.set("width", "800");
  body.set("height", "600");
  for (const [key, value] of Object.entries(names)) body.set(key, value);
  return body;
}

async function uploader(body: FormData, cookie?: string) {
  const response = await call("/api/photos", {
    body,
    ...(cookie === undefined ? {} : withCookie(cookie)),
  });
  expect(response.status).toBe(200);
  const { id } = photoUploadResult.parse(await response.json());
  return env.DB.prepare("SELECT guest_id, credit FROM photos WHERE id = ?").bind(id).first();
}

describe("guest photo uploads with a session", () => {
  beforeEach(async () => {
    await env.DB.prepare("UPDATE settings SET value = '1' WHERE key = 'photo_uploads_open'").run();
  });

  it("credit the session's guest without a typed name", async () => {
    const cookie = await rsvpAndGetCookie();
    expect(await uploader(form(), cookie)).toEqual({ guest_id: "sam", credit: "Sam Lee" });
  });

  it("credit the session's guest over a typed name", async () => {
    const cookie = await rsvpAndGetCookie();
    const typed = form({ firstName: "Kim", lastName: "Moss" });
    expect(await uploader(typed, cookie)).toEqual({ guest_id: "sam", credit: "Sam Lee" });
  });

  it("fall back to the typed name without a session", async () => {
    const typed = form({ firstName: "Kim", lastName: "Moss" });
    expect(await uploader(typed)).toEqual({ guest_id: "kim", credit: "Kim Moss" });
  });

  it("refuse a visitor with neither a session nor a name", async () => {
    expect((await call("/api/photos", { body: form() })).status).toBe(403);
  });
});
