import { CENTER, type Maze, cellAngles, locate, neighbors } from "@client/labyrinth/maze.ts";

/** A wall as geometry, in maze units: an arc of a ring boundary or a radial spoke. */
export type Wall =
  | { kind: "arc"; radius: number; start: number; end: number }
  | { kind: "radial"; angle: number; inner: number; outer: number };

/** The closed walls one ring cell owns: its inner arc, its clockwise side, and any outer rim. */
function cellWalls(maze: Maze, cell: number): Wall[] {
  const { ring } = locate(maze, cell);
  const { start, end } = cellAngles(maze, cell);
  const [clockwise = -1, , inward = -1] = neighbors(maze, cell);
  const open = maze.links[cell] ?? new Set<number>();
  const walls: Wall[] = [];
  if (!open.has(inward)) walls.push({ kind: "arc", radius: ring, start, end });
  if (!open.has(clockwise))
    walls.push({ kind: "radial", angle: end, inner: ring, outer: ring + 1 });
  const onRim = ring === maze.ringSizes.length - 1;
  if (onRim && cell !== maze.entrance) walls.push({ kind: "arc", radius: ring + 1, start, end });
  return walls;
}

/**
 * Every wall: each ring cell has its inner arc and its clockwise side when those are closed, and
 * the outer ring is bounded everywhere except at the entrance.
 */
export function mazeWalls(maze: Maze): Wall[] {
  const walls: Wall[] = [];
  for (let cell = CENTER + 1; cell < maze.links.length; cell++) {
    walls.push(...cellWalls(maze, cell));
  }
  return walls;
}

/** A wall across the center's one doorway, standing until the player has the ring. */
export function centerGate(maze: Maze): Wall {
  const [doorway] = maze.links[CENTER] ?? [];
  if (doorway === undefined) throw new Error("The center has no doorway to gate.");
  const { start, end } = cellAngles(maze, doorway);
  return { kind: "arc", radius: 1, start, end };
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function polar(radius: number, angle: number): string {
  return `${round(radius * Math.cos(angle))} ${round(radius * Math.sin(angle))}`;
}

function segment(wall: Wall): string {
  if (wall.kind === "radial") {
    return `M ${polar(wall.inner, wall.angle)} L ${polar(wall.outer, wall.angle)}`;
  }
  const { radius, start, end } = wall;
  return `M ${polar(radius, start)} A ${radius} ${radius} 0 0 1 ${polar(radius, end)}`;
}

/** SVG path data drawing every wall, one subpath each. */
export function wallPath(walls: readonly Wall[]): string {
  return walls.map(segment).join(" ");
}
