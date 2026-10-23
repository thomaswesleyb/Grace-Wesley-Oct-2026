import { Hono } from "hono";
import {
  LEADERBOARD_SIZE,
  labyrinthRun,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "@shared/schemas.ts";
import { type BestRunRow, insertLabyrinthRun, listBestRuns } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";
import { sessionGuest } from "@worker/session.ts";

/**
 * Saves finished walks at /api/labyrinth/runs for guests with a session, and ranks each guest's
 * best at /api/labyrinth/leaderboard.
 */
export const labyrinth = new Hono<{ Bindings: Env }>();

labyrinth.post("/runs", async (c) => {
  const guest = await sessionGuest(c);
  if (guest === null) return c.json({ error: "RSVP first to save your time." }, 401);
  if (!(await c.env.LABYRINTH_LIMITER.limit({ key: guest.id })).success) {
    return c.json({ error: "That's a lot of walks at once! Please wait a minute." }, 429);
  }
  const parsed = labyrinthRun.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Send the animal and a time in milliseconds." }, 400);
  await insertLabyrinthRun(c.env.DB, {
    id: crypto.randomUUID(),
    guestId: guest.id,
    animal: parsed.data.animal,
    durationMs: parsed.data.durationMs,
    finishedAt: new Date().toISOString(),
  });
  return c.json({ ok: true as const });
});

/** "Sam L.", so the full guest list isn't shown to everyone. */
const shortName = (row: BestRunRow) => `${row.first_name} ${row.last_name.slice(0, 1)}.`;

/** Ranks rows sorted fastest first; equal times share the rank of the first of them. */
function rank(rows: BestRunRow[], youId: string | null): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  for (const [index, row] of rows.entries()) {
    const previous = entries[index - 1];
    const tied = previous !== undefined && previous.durationMs === row.duration_ms;
    entries.push({
      rank: tied ? previous.rank : index + 1,
      name: shortName(row),
      durationMs: row.duration_ms,
      you: row.guest_id === youId,
    });
  }
  return entries;
}

labyrinth.get("/leaderboard", async (c) => {
  const [rows, guest] = await Promise.all([listBestRuns(c.env.DB), sessionGuest(c)]);
  const entries = rank(rows, guest?.id ?? null);
  return c.json({
    entries: entries.slice(0, LEADERBOARD_SIZE),
    you: entries.find((e) => e.you) ?? null,
  } satisfies LeaderboardResponse);
});
