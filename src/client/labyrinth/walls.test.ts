import { describe, expect, it } from "vitest";
import { generateMaze } from "@client/labyrinth/maze.ts";
import { wallPath } from "@client/labyrinth/walls.ts";

const segmentCount = (path: string) => path.split("M").length - 1;

describe("wallPath", () => {
  it("draws one wall for every closed side, leaving the entrance open", () => {
    const maze = generateMaze(11);
    const ringCells = maze.links.length - 1;
    const outerSize = maze.ringSizes.at(-1) ?? 0;
    const passages = maze.links.reduce((sum, set) => sum + set.size, 0) / 2;
    const innerAndClockwiseSides = 2 * ringCells;
    expect(segmentCount(wallPath(maze))).toBe(innerAndClockwiseSides - passages + (outerSize - 1));
  });

  it("adds exactly one wall when a passage is closed", () => {
    const maze = generateMaze(11);
    const [next = -1] = maze.links[maze.entrance] ?? [];
    const closed = maze.links.map((set) => new Set(set));
    closed[maze.entrance]?.delete(next);
    closed[next]?.delete(maze.entrance);
    const before = segmentCount(wallPath(maze));
    expect(segmentCount(wallPath({ ...maze, links: closed }))).toBe(before + 1);
  });
});
