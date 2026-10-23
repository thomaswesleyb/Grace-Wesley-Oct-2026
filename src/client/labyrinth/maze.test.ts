import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CENTER,
  type Maze,
  RINGS,
  cellAt,
  cellCenter,
  generateMaze,
  neighbors,
  ringSizes,
  route,
} from "@client/labyrinth/maze.ts";

function cellCount(maze: Maze): number {
  return maze.links.length;
}

function reachableFrom(maze: Maze, start: number): Set<number> {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const cell = queue.shift() ?? start;
    for (const next of maze.links[cell] ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
}

function passageCount(maze: Maze): number {
  let total = 0;
  for (const set of maze.links) total += set.size;
  return total / 2;
}

function flat(maze: Maze): number[][] {
  return maze.links.map((set) => [...set].toSorted((a, b) => a - b));
}

describe("ringSizes", () => {
  it("has a single center cell and never shrinks outward", () => {
    const sizes = ringSizes(RINGS);
    expect(sizes).toHaveLength(RINGS + 1);
    expect(sizes[0]).toBe(1);
    for (let ring = 2; ring <= RINGS; ring++) {
      const inner = sizes[ring - 1] ?? 0;
      const outer = sizes[ring] ?? 0;
      expect(outer % inner).toBe(0);
    }
  });
});

describe("generateMaze", () => {
  it("is a perfect maze: every cell reachable, with no loops", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        expect(reachableFrom(maze, maze.entrance).size).toBe(cellCount(maze));
        expect(passageCount(maze)).toBe(cellCount(maze) - 1);
      }),
    );
  });

  it("only opens walls between cells that touch", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        maze.links.forEach((set, cell) => {
          for (const next of set) {
            expect(neighbors(maze, cell)).toContain(next);
            expect(maze.links[next]?.has(cell)).toBe(true);
          }
        });
      }),
    );
  });

  it("gives the same maze for the same seed and a different one for another", () => {
    expect(flat(generateMaze(42))).toEqual(flat(generateMaze(42)));
    expect(flat(generateMaze(42))).not.toEqual(flat(generateMaze(43)));
  });

  it("puts the entrance on the outer ring at the bottom of the board", () => {
    const maze = generateMaze(7);
    const { x, y } = cellCenter(maze, maze.entrance);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(RINGS + 0.5);
  });

  it("gives the center exactly one way in", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        expect(maze.links[CENTER]?.size).toBe(1);
      }),
    );
  });

  it("hides the wedding ring in a dead end off the route to the center", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        expect(maze.links[maze.weddingRing]?.size).toBe(1);
        expect(route(maze.links, maze.entrance, CENTER)).not.toContain(maze.weddingRing);
      }),
    );
  });

  it("picks the ring's dead end so the detour is about a third of the route", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        const toCenter = route(maze.links, maze.entrance, CENTER);
        const detour = (cell: number) =>
          route(maze.links, maze.entrance, cell).filter((c) => !toCenter.includes(c)).length;
        const target = Math.max(4, Math.round(toCenter.length / 3));
        const miss = (cell: number) => Math.abs(detour(cell) - target);
        const deadEnds = maze.links
          .map((set, cell) => ({ set, cell }))
          .filter(({ set, cell }) => set.size === 1 && detour(cell) > 0)
          .map(({ cell }) => cell);
        expect(miss(maze.weddingRing)).toBe(Math.min(...deadEnds.map(miss)));
      }),
      { numRuns: 30 },
    );
  });

  it("has dead ends, so it is a maze and not a single path", () => {
    const maze = generateMaze(3);
    const deadEnds = maze.links.filter((set) => set.size === 1).length;
    expect(deadEnds).toBeGreaterThan(5);
  });
});

describe("route", () => {
  it("walks open passages from one cell to the other", () => {
    const maze = generateMaze(8);
    const path = route(maze.links, maze.entrance, CENTER);
    expect(path[0]).toBe(maze.entrance);
    expect(path.at(-1)).toBe(CENTER);
    path.slice(1).forEach((cell, i) => expect(maze.links[path[i] ?? -1]?.has(cell)).toBe(true));
    expect(route(maze.links, CENTER, CENTER)).toEqual([CENTER]);
  });

  it("fails clearly when the cells aren't connected", () => {
    const maze = generateMaze(8);
    const sealed = maze.links.map(() => new Set<number>());
    expect(() => route(sealed, maze.entrance, CENTER)).toThrow(/No route/);
  });
});

describe("cellAt", () => {
  it("finds every cell at its own center", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 2 ** 32 - 1 }), (seed) => {
        const maze = generateMaze(seed);
        for (let cell = 0; cell < cellCount(maze); cell++) {
          expect(cellAt(maze, cellCenter(maze, cell))).toBe(cell);
        }
      }),
      { numRuns: 5 },
    );
  });

  it("puts the bottom of the outer ring at the entrance", () => {
    const maze = generateMaze(1);
    expect(cellAt(maze, { x: 0, y: RINGS + 0.5 })).toBe(maze.entrance);
  });

  it("returns the center inside radius 1 and null beyond the outer wall", () => {
    const maze = generateMaze(1);
    expect(cellAt(maze, { x: 0.3, y: -0.4 })).toBe(CENTER);
    expect(cellAt(maze, { x: 0, y: RINGS + 1 })).toBeNull();
    expect(cellAt(maze, { x: -RINGS - 2, y: 0 })).toBeNull();
  });
});
