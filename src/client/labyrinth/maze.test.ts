import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CENTER,
  type Direction,
  type Maze,
  RINGS,
  cellCenter,
  generateMaze,
  move,
  neighbors,
  ringSizes,
} from "@client/labyrinth/maze.ts";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

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

  it("gives no cell more passages than there are arrow keys, and the center one", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        for (const set of maze.links) expect(set.size).toBeLessThanOrEqual(4);
        expect(maze.links[CENTER]?.size).toBe(1);
      }),
    );
  });

  it("has dead ends, so it is a maze and not a single path", () => {
    const maze = generateMaze(3);
    const deadEnds = maze.links.filter((set) => set.size === 1).length;
    expect(deadEnds).toBeGreaterThan(5);
  });
});

describe("move", () => {
  it("never passes through a wall", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(fc.constantFrom(...DIRECTIONS), { maxLength: 200 }),
        (seed, presses) => {
          const maze = generateMaze(seed);
          let at = maze.entrance;
          for (const direction of presses) {
            const next = move(maze, at, direction);
            if (next !== at) expect(maze.links[at]?.has(next)).toBe(true);
            at = next;
          }
        },
      ),
    );
  });

  it("can take every open passage with some arrow key", () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const maze = generateMaze(seed);
        maze.links.forEach((set, cell) => {
          const reached = new Set(DIRECTIONS.map((d) => move(maze, cell, d)));
          for (const next of set) expect(reached).toContain(next);
        });
      }),
    );
  });

  it("maps screen directions at the bottom of the board", () => {
    const base = generateMaze(1);
    const entrance = base.entrance;
    const [clockwise, counterclockwise, inward] = neighbors(base, entrance) as [
      number,
      number,
      number,
    ];
    const maze = mazeWith([
      [entrance, inward],
      [entrance, clockwise],
      [entrance, counterclockwise],
    ]);
    expect(move(maze, entrance, "up")).toBe(inward);
    expect(cellCenter(maze, move(maze, entrance, "left")).x).toBeLessThan(0);
    expect(cellCenter(maze, move(maze, entrance, "right")).x).toBeGreaterThan(0);
    expect(move(maze, entrance, "down")).toBe(entrance);
  });

  it("stays put when nothing lies that way", () => {
    const base = generateMaze(1);
    const inward = neighbors(base, base.entrance)[2] ?? -1;
    const maze = mazeWith([[base.entrance, inward]]);
    expect(move(maze, base.entrance, "up")).toBe(inward);
    expect(move(maze, base.entrance, "down")).toBe(base.entrance);
    expect(move(maze, base.entrance, "left")).toBe(base.entrance);
  });

  it("reaches the center from ring 1", () => {
    const base = generateMaze(1);
    const top = neighbors(base, CENTER).find((cell) => cellCenter(base, cell).y < -1);
    expect(top).toBeDefined();
    const maze = mazeWith([[CENTER, top ?? -1]]);
    expect(move(maze, top ?? -1, "down")).toBe(CENTER);
  });
});
