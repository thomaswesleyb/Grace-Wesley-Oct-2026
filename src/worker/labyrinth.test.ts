import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { LEADERBOARD_SIZE, leaderboardResponse } from "@shared/schemas.ts";
import { call, resetDb, rsvpBody, seedGuest } from "@worker/test-helpers.ts";

beforeEach(async () => {
  await resetDb();
  await seedGuest("sam", "Sam", "Lee", 1);
});

/** Adds runs straight to the database: one per time, for guest `guestId`. */
async function seedRuns(guestId: string, ...durations: number[]) {
  await env.DB.batch(
    durations.map((ms) =>
      env.DB.prepare(
        `INSERT INTO labyrinth_runs (id, guest_id, animal, duration_ms, finished_at)
         VALUES (?, ?, 'fox', ?, '2026-10-22T00:00:00.000Z')`,
      ).bind(crypto.randomUUID(), guestId, ms),
    ),
  );
}

async function samsCookie(): Promise<string> {
  const response = await call("/api/rsvp", { body: rsvpBody() });
  const token = /__Host-session=([0-9a-f]{64})/.exec(response.headers.get("set-cookie") ?? "");
  expect(token).not.toBeNull();
  return `__Host-session=${token?.[1]}`;
}

async function leaderboard(cookie?: string) {
  const options = cookie === undefined ? {} : { headers: { cookie } };
  const response = await call("/api/labyrinth/leaderboard", options);
  expect(response.status).toBe(200);
  return leaderboardResponse.parse(await response.json());
}

describe("GET /api/labyrinth/leaderboard", () => {
  it("is empty before anyone finishes", async () => {
    expect(await leaderboard()).toEqual({ entries: [], you: null });
  });

  it("ranks each guest's best time, with first name and last initial only", async () => {
    await seedGuest("kim", "Kim", "Moss", 1);
    await seedRuns("sam", 90_000, 61_000);
    await seedRuns("kim", 75_000);
    expect((await leaderboard()).entries).toEqual([
      { rank: 1, name: "Sam L.", durationMs: 61_000, you: false },
      { rank: 2, name: "Kim M.", durationMs: 75_000, you: false },
    ]);
  });

  it("gives equal times the same rank and skips the places they share", async () => {
    await seedGuest("kim", "Kim", "Moss", 1);
    await seedGuest("ada", "Ada", "Ray", 1);
    await seedRuns("sam", 50_000);
    await seedRuns("kim", 50_000);
    await seedRuns("ada", 70_000);
    const ranks = (await leaderboard()).entries.map((e) => [e.name, e.rank]);
    expect(ranks).toEqual([
      ["Kim M.", 1],
      ["Sam L.", 1],
      ["Ada R.", 3],
    ]);
  });

  it(`shows the top ${LEADERBOARD_SIZE}, and the visitor's own place below them`, async () => {
    const fast = Array.from({ length: LEADERBOARD_SIZE }, (_, n) => n);
    const letters = "abcdefghijklmnopqrstuvwxyz";
    await Promise.all(fast.map((n) => seedGuest(`fast-${n}`, `Runner${letters[n]}`, "Fast", 1)));
    await Promise.all(fast.map((n) => seedRuns(`fast-${n}`, 10_000 + n)));
    await seedRuns("sam", 99_000);
    const board = await leaderboard(await samsCookie());
    expect(board.entries).toHaveLength(LEADERBOARD_SIZE);
    expect(board.entries.some((e) => e.you)).toBe(false);
    expect(board.you).toEqual({
      rank: LEADERBOARD_SIZE + 1,
      name: "Sam L.",
      durationMs: 99_000,
      you: true,
    });
  });

  it("marks the visitor's entry in the list", async () => {
    await seedRuns("sam", 42_000);
    const board = await leaderboard(await samsCookie());
    expect(board.entries).toEqual([{ rank: 1, name: "Sam L.", durationMs: 42_000, you: true }]);
    expect(board.you).toEqual(board.entries[0]);
    expect((await leaderboard()).you).toBeNull();
  });

  it("leaves out guests who no longer have places", async () => {
    await seedRuns("sam", 42_000);
    await env.DB.prepare("UPDATE guests SET spots = 0 WHERE id = 'sam'").run();
    expect((await leaderboard()).entries).toEqual([]);
  });
});
