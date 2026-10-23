import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  LEAF_COUNT,
  LEAF_RADIUS,
  type Leaf,
  kick,
  scatterLeaves,
  stepLeaves,
} from "@client/labyrinth/leaves.ts";
import { RINGS, cellAt, generateMaze, seededRandom } from "@client/labyrinth/maze.ts";
import { fits } from "@client/labyrinth/physics.ts";
import { mazeWalls } from "@client/labyrinth/walls.ts";

const RIM = RINGS + 1;
const FRAME = 1 / 60;

function restingLeaf(x: number, y: number): Leaf {
  return { id: 0, x, y, vx: 0, vy: 0, angle: 0, spin: 0, scale: 1, tint: 0 };
}

describe("scatterLeaves", () => {
  it("covers the floor clear of the walls and the center, the same way for the same seed", () => {
    const walls = mazeWalls(generateMaze(4));
    const leaves = scatterLeaves(walls, RIM, seededRandom(9));
    expect(leaves).toHaveLength(LEAF_COUNT);
    for (const leaf of leaves) {
      expect(fits(walls, leaf, LEAF_RADIUS)).toBe(true);
      expect(Math.hypot(leaf.x, leaf.y)).toBeGreaterThan(1);
      expect(leaf.vx === 0 && leaf.vy === 0 && leaf.spin === 0).toBe(true);
    }
    expect(scatterLeaves(walls, RIM, seededRandom(9))).toEqual(leaves);
  });
});

describe("kick", () => {
  it("pushes a leaf in the player's path the way the player moves", () => {
    const leaf = restingLeaf(0.2, 0);
    kick([leaf], { x: 0, y: 0 }, { x: 0.1, y: 0 });
    expect(leaf.vx).toBeGreaterThan(0);
    expect(leaf.spin).not.toBe(0);
  });

  it("leaves alone a leaf far from the path, and every leaf when the player stays put", () => {
    const far = restingLeaf(2, 2);
    const near = restingLeaf(0.1, 0);
    kick([far], { x: 0, y: 0 }, { x: 0.1, y: 0 });
    kick([near], { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(far).toEqual(restingLeaf(2, 2));
    expect(near).toEqual(restingLeaf(0.1, 0));
  });
});

describe("stepLeaves", () => {
  it("lets a kicked leaf skid forward and settle", () => {
    const leaf = restingLeaf(0, RINGS + 0.5);
    kick([leaf], { x: -0.3, y: leaf.y }, { x: -0.2, y: leaf.y });
    let moving = true;
    let frames = 0;
    while (moving && frames < 600) {
      moving = stepLeaves([leaf], [], RIM, FRAME);
      frames++;
    }
    expect(moving).toBe(false);
    expect(leaf.x).toBeGreaterThan(0.05);
    expect(stepLeaves([leaf], [], RIM, FRAME)).toBe(false);
  });

  it("never lets a leaf cross a closed wall or overlap one", () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (seed, scatter) => {
        const maze = generateMaze(seed);
        const walls = mazeWalls(maze);
        const leaves = scatterLeaves(walls, RIM, seededRandom(scatter));
        for (const leaf of leaves)
          kick([leaf], { x: leaf.x, y: leaf.y }, { x: leaf.y, y: -leaf.x });
        let cells = leaves.map((leaf) => cellAt(maze, leaf) ?? -1);
        for (let frame = 0; frame < 60; frame++) {
          stepLeaves(leaves, walls, RIM, FRAME);
          leaves.forEach((leaf, i) => {
            const before = cells[i] ?? -1;
            const now = cellAt(maze, leaf) ?? -1;
            if (now !== before) expect(maze.links[before]?.has(now)).toBe(true);
            expect(fits(walls, leaf, LEAF_RADIUS)).toBe(true);
          });
          cells = leaves.map((leaf) => cellAt(maze, leaf) ?? -1);
        }
      }),
      { numRuns: 5 },
    );
  });
});
