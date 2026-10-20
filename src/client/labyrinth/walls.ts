import { CENTER, type Maze, cellAngles, locate, neighbors } from "@client/labyrinth/maze.ts";

const round = (n: number) => Math.round(n * 1000) / 1000;

function polar(radius: number, angle: number): string {
  return `${round(radius * Math.cos(angle))} ${round(radius * Math.sin(angle))}`;
}

function arc(radius: number, start: number, end: number): string {
  return `M ${polar(radius, start)} A ${radius} ${radius} 0 0 1 ${polar(radius, end)}`;
}

function radial(angle: number, inner: number, outer: number): string {
  return `M ${polar(inner, angle)} L ${polar(outer, angle)}`;
}

/** The closed walls one ring cell owns: its inner arc, its clockwise side, and any outer rim. */
function cellWalls(maze: Maze, cell: number): string[] {
  const { ring } = locate(maze, cell);
  const { start, end } = cellAngles(maze, cell);
  const [clockwise = -1, , inward = -1] = neighbors(maze, cell);
  const open = maze.links[cell] ?? new Set<number>();
  const walls: string[] = [];
  if (!open.has(inward)) walls.push(arc(ring, start, end));
  if (!open.has(clockwise)) walls.push(radial(end, ring, ring + 1));
  const onRim = ring === maze.ringSizes.length - 1;
  if (onRim && cell !== maze.entrance) walls.push(arc(ring + 1, start, end));
  return walls;
}

/**
 * SVG path data for every wall: each ring cell draws its inner arc and its clockwise side when
 * those are closed, and the outer ring draws the boundary everywhere except at the entrance.
 */
export function wallPath(maze: Maze): string {
  const segments: string[] = [];
  for (let cell = CENTER + 1; cell < maze.links.length; cell++) {
    segments.push(...cellWalls(maze, cell));
  }
  return segments.join(" ");
}
