import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CENTER,
  type Maze,
  type Point,
  RINGS,
  cellAt,
  cellCenter,
  generateMaze,
  neighbors,
} from "@client/labyrinth/maze.ts";
import { CLEARANCE, PLAYER_RADIUS, fits, slide } from "@client/labyrinth/physics.ts";
import { mazeWalls } from "@client/labyrinth/walls.ts";

const RIM = RINGS + 1;
const TOLERANCE = 0.01;

/** A maze whose only passages are the given pairs, on the standard grid. */
function mazeWith(pairs: [number, number][]): Maze {
  const base = generateMaze(1);
  const links = base.links.map(() => new Set<number>());
  for (const [a, b] of pairs) {
    links[a]?.add(b);
    links[b]?.add(a);
  }
  return { ...base, links };
}

function walkFrom(maze: Maze, from: Point, to: Point): Point {
  return slide(mazeWalls(maze), RIM, from, to);
}

const base = generateMaze(1);
const start = cellCenter(base, base.entrance);
const [clockwise = -1, , inward = -1] = neighbors(base, base.entrance);

describe("slide", () => {
  it("moves freely through an open passage", () => {
    const maze = mazeWith([[base.entrance, inward]]);
    const end = walkFrom(maze, start, { x: 0, y: RINGS - 0.5 });
    expect(cellAt(maze, end)).toBe(inward);
    expect(end.y).toBeCloseTo(RINGS - 0.5);
  });

  it("stops at a closed wall instead of passing through", () => {
    const maze = mazeWith([]);
    const end = walkFrom(maze, start, { x: 0, y: RINGS - 2 });
    expect(cellAt(maze, end)).toBe(base.entrance);
    expect(end.y).toBeGreaterThanOrEqual(RINGS + CLEARANCE - TOLERANCE);
  });

  it("slides along a wall when pushed into it at an angle", () => {
    const maze = mazeWith([[base.entrance, clockwise]]);
    const end = walkFrom(maze, start, { x: -1.5, y: RINGS - 1 });
    expect(cellAt(maze, end)).toBe(clockwise);
    expect(end.x).toBeLessThan(-0.8);
    expect(Math.hypot(end.x, end.y)).toBeGreaterThanOrEqual(RINGS + CLEARANCE - TOLERANCE);
  });

  it("keeps the player inside the rim, even at the entrance", () => {
    const end = walkFrom(mazeWith([]), start, { x: 0, y: RIM + 5 });
    expect(Math.hypot(end.x, end.y)).toBeLessThanOrEqual(RIM - PLAYER_RADIUS + 1e-9);
  });

  it("enters the center only through its opening", () => {
    const top = neighbors(base, CENTER).find((cell) => cellCenter(base, cell).y < -1) ?? -1;
    const from = cellCenter(base, top);
    expect(cellAt(base, walkFrom(mazeWith([[CENTER, top]]), from, { x: 0, y: 0 }))).toBe(CENTER);
    expect(cellAt(base, walkFrom(mazeWith([]), from, { x: 0, y: 0 }))).toBe(top);
  });

  it("never crosses a closed wall or overlaps one on a random drag", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }), { maxLength: 300 }),
        (seed, headings) => {
          const maze = generateMaze(seed);
          const walls = mazeWalls(maze);
          let at = cellCenter(maze, maze.entrance);
          let cell = maze.entrance;
          for (const heading of headings) {
            const to = { x: at.x + 0.1 * Math.cos(heading), y: at.y + 0.1 * Math.sin(heading) };
            at = slide(walls, RIM, at, to);
            const next = cellAt(maze, at) ?? -1;
            if (next !== cell) expect(maze.links[cell]?.has(next)).toBe(true);
            expect(fits(walls, at)).toBe(true);
            cell = next;
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
