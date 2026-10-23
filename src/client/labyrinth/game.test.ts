import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Game, startGame, walk } from "@client/labyrinth/game.ts";
import { CENTER, RINGS, cellAt, cellCenter, locate, route } from "@client/labyrinth/maze.ts";

const START = 1_000_000;

/** Walks cell by cell along the maze's own route, toward each next cell's center. */
function walkRoute(game: Game, to: number, now = START): Game {
  const from = cellAt(game.maze, game.position) ?? game.maze.entrance;
  let current = game;
  for (const cell of route(game.maze.links, from, to).slice(1)) {
    for (let tries = 0; tries < 10 && cellAt(current.maze, current.position) !== cell; tries++) {
      current = walk(current, cellCenter(current.maze, cell), now);
      if (current.won) return current;
    }
  }
  return current;
}

describe("walk", () => {
  it("keeps the gate shut until the player has the ring", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const game = walkRoute(startGame("fox", seed, START), CENTER);
        expect(game.won).toBe(false);
        expect(game.hasRing).toBe(false);
        expect(cellAt(game.maze, game.position)).not.toBe(CENTER);
        expect(game.message).toBe("The gate is shut. Find the ring first.");
      }),
      { numRuns: 15 },
    );
  });

  it("picks up the ring in its dead end and then wins in the center", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const game = startGame("deer", seed, START);
        const atRing = walkRoute(game, game.maze.weddingRing);
        expect(atRing.hasRing).toBe(true);
        expect(atRing.finishedAt).toBeNull();
        expect(atRing.message).toBe("You found the ring. Now take it to the fox.");
        const done = walkRoute(atRing, CENTER, START + 42_000);
        expect(done.won).toBe(true);
        expect(done.message).toBe("You brought the ring to the fox in 42 seconds.");
        expect(done.finishedAt).toBe(START + 42_000);
      }),
      { numRuns: 15 },
    );
  });

  it("ignores moves once the game is won", () => {
    const game = startGame("fox", 5, START);
    const won = walkRoute(walkRoute(game, game.maze.weddingRing), CENTER);
    expect(won.won).toBe(true);
    expect(walk(won, cellCenter(won.maze, won.maze.entrance), START)).toBe(won);
  });

  it("announces each new circuit as the player crosses into it", () => {
    const game = startGame("fox", 5, START);
    const inner = route(game.maze.links, game.maze.entrance, CENTER).find(
      (cell) => locate(game.maze, cell).ring === RINGS - 1,
    );
    const moved = walkRoute(game, inner ?? -1);
    expect(moved.circuit).toBe(RINGS - 1);
    expect(moved.message).toBe(`Circuit ${RINGS - 1}.`);
  });
});
