import { describe, expect, it } from "vitest";
import { formatDuration } from "@client/labyrinth/leaderboard.ts";

describe("formatDuration", () => {
  it.each([
    [1, "0:00.0"],
    [99, "0:00.0"],
    [100, "0:00.1"],
    [9_999, "0:09.9"],
    [59_999, "0:59.9"],
    [60_000, "1:00.0"],
    [83_456, "1:23.4"],
    [3_600_000, "60:00.0"],
  ])("shows %i ms as %s", (ms, shown) => {
    expect(formatDuration(ms)).toBe(shown);
  });
});
