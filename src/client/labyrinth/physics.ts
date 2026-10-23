/**
 * Moves round bodies (the player, fallen leaves) through the maze. Walls are solid: a move that
 * runs into one is pushed back out along the wall's normal, so pressing at an angle slides
 * along it.
 */
import type { Point } from "@client/labyrinth/maze.ts";
import type { Wall } from "@client/labyrinth/walls.ts";

/** The player's collision circle, in maze units (a cell is about 1 unit across). */
export const PLAYER_RADIUS = 0.3;
/** Half of `.labyrinth-walls` stroke-width in labyrinth.css, so collisions match the drawing. */
const WALL_HALF_WIDTH = 0.09;
/** How close a body's center may come to a wall's center line. */
const clearanceFor = (radius: number) => radius + WALL_HALF_WIDTH;
/** The player's clearance. */
export const CLEARANCE = clearanceFor(PLAYER_RADIUS);
/** Each move is split into steps this long; shorter than any clearance, so no wall is skipped. */
const MAX_STEP = 0.1;
const PUSH_PASSES = 4;
/** A step still overlapping a wall by more than this after pushing is refused. */
const TOLERANCE = 0.01;

const TURN = 2 * Math.PI;
const wrap = (angle: number) => ((angle % TURN) + TURN) % TURN;

function onArc(angle: number, start: number, end: number): boolean {
  return wrap(angle - start) <= wrap(end - start);
}

function atAngle(radius: number, angle: number): Point {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** The point of a wall's center line nearest to `p`. */
export function closestPoint(wall: Wall, p: Point): Point {
  if (wall.kind === "radial") {
    const along = p.x * Math.cos(wall.angle) + p.y * Math.sin(wall.angle);
    return atAngle(Math.min(wall.outer, Math.max(wall.inner, along)), wall.angle);
  }
  const angle = Math.atan2(p.y, p.x);
  if (onArc(angle, wall.start, wall.end)) return atAngle(wall.radius, angle);
  const start = atAngle(wall.radius, wall.start);
  const end = atAngle(wall.radius, wall.end);
  const toStart = Math.hypot(p.x - start.x, p.y - start.y);
  return toStart <= Math.hypot(p.x - end.x, p.y - end.y) ? start : end;
}

/** A quick lower bound on the distance from `p` to a wall, to skip walls that are far off. */
function roughDistance(wall: Wall, p: Point): number {
  if (wall.kind === "arc") return Math.abs(Math.hypot(p.x, p.y) - wall.radius);
  return Math.abs(p.y * Math.cos(wall.angle) - p.x * Math.sin(wall.angle));
}

function distanceTo(wall: Wall, p: Point): number {
  const c = closestPoint(wall, p);
  return Math.hypot(p.x - c.x, p.y - c.y);
}

/** Whether a body centered at `p` overlaps no wall. */
export function fits(walls: readonly Wall[], p: Point, radius = PLAYER_RADIUS): boolean {
  const minimum = clearanceFor(radius) - TOLERANCE;
  return walls.every((wall) => roughDistance(wall, p) >= minimum || distanceTo(wall, p) >= minimum);
}

/** Pushes a body at `p` out of every wall it overlaps and back inside the rim. */
function pushOut(walls: readonly Wall[], rim: number, p: Point, radius: number): Point {
  const clearance = clearanceFor(radius);
  let { x, y } = p;
  for (let pass = 0; pass < PUSH_PASSES; pass++) {
    for (const wall of walls) {
      if (roughDistance(wall, { x, y }) >= clearance) continue;
      const c = closestPoint(wall, { x, y });
      const distance = Math.hypot(x - c.x, y - c.y);
      if (distance >= clearance || distance === 0) continue;
      const push = (clearance - distance) / distance;
      x += (x - c.x) * push;
      y += (y - c.y) * push;
    }
    const fromCenter = Math.hypot(x, y);
    const limit = rim - radius;
    if (fromCenter > limit) {
      x *= limit / fromCenter;
      y *= limit / fromCenter;
    }
  }
  return { x, y };
}

/**
 * Moves a body from `from` toward `to`, stopping at walls and sliding along them. `rim` is the
 * maze's outer radius; nothing leaves it, even through the entrance.
 */
export function slide(
  walls: readonly Wall[],
  rim: number,
  from: Point,
  to: Point,
  radius = PLAYER_RADIUS,
): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.ceil(length / MAX_STEP);
  const dx = (to.x - from.x) / Math.max(1, steps);
  const dy = (to.y - from.y) / Math.max(1, steps);
  // Pushing never carries a body more than one clearance off its path, so walls beyond that
  // reach can't be touched on this move.
  const reach = length + 2 * clearanceFor(radius);
  const nearby = walls.filter((wall) => roughDistance(wall, from) < reach);
  let at = from;
  for (let i = 0; i < steps; i++) {
    const next = pushOut(nearby, rim, { x: at.x + dx, y: at.y + dy }, radius);
    if (!fits(nearby, next, radius)) break;
    at = next;
  }
  return at;
}
