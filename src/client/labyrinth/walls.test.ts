import { describe, expect, it } from "vitest";
import { CENTER, generateMaze } from "@client/labyrinth/maze.ts";
import { centerGate, mazeWalls, wallPath } from "@client/labyrinth/walls.ts";

describe("mazeWalls", () => {
  it("has one wall for every closed side, leaving the entrance open", () => {
    const maze = generateMaze(11);
    const ringCells = maze.links.length - 1;
    const outerSize = maze.ringSizes.at(-1) ?? 0;
    const passages = maze.links.reduce((sum, set) => sum + set.size, 0) / 2;
    const innerAndClockwiseSides = 2 * ringCells;
    expect(mazeWalls(maze)).toHaveLength(innerAndClockwiseSides - passages + (outerSize - 1));
  });

  it("adds exactly one wall when a passage is closed", () => {
    const maze = generateMaze(11);
    const [next = -1] = maze.links[maze.entrance] ?? [];
    const closed = maze.links.map((set) => new Set(set));
    closed[maze.entrance]?.delete(next);
    closed[next]?.delete(maze.entrance);
    const before = mazeWalls(maze).length;
    expect(mazeWalls({ ...maze, links: closed })).toHaveLength(before + 1);
  });
});

describe("wallPath", () => {
  it("draws one subpath per wall", () => {
    const walls = mazeWalls(generateMaze(11));
    expect(wallPath(walls).split("M").length - 1).toBe(walls.length);
  });
});

describe("centerGate", () => {
  it("closes exactly the opening the maze leaves in the center", () => {
    const maze = generateMaze(11);
    const gate = centerGate(maze);
    const [doorway = -1] = maze.links[CENTER] ?? [];
    const sealed = maze.links.map((set) => new Set(set));
    sealed[CENTER]?.delete(doorway);
    sealed[doorway]?.delete(CENTER);
    const closedWalls = mazeWalls({ ...maze, links: sealed });
    expect(closedWalls).toContainEqual(gate);
    expect(mazeWalls(maze)).not.toContainEqual(gate);
  });

  it("fails clearly for a center with no way in", () => {
    const maze = generateMaze(11);
    const links = maze.links.map(() => new Set<number>());
    expect(() => centerGate({ ...maze, links })).toThrow(/no doorway/);
  });
});
