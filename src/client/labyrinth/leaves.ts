/**
 * Fallen leaves on the labyrinth floor. The player kicks the ones it walks through; they skid,
 * spin, slow down and settle, and the walls stop them the same way they stop the player.
 */
import type { Point } from "@client/labyrinth/maze.ts";
import { fits, slide } from "@client/labyrinth/physics.ts";
import type { Wall } from "@client/labyrinth/walls.ts";

export const LEAF_COUNT = 150;
/** Each leaf collides as a small circle, in maze units. */
export const LEAF_RADIUS = 0.1;
const LEAF_TINTS = 4;
/** Leaves this close to the player's path get kicked: the player's radius plus a little. */
const KICK_RADIUS = 0.45;
/** Speed gained along the player's motion per unit the player moves. */
const FOLLOW = 12;
/** Speed gained straight away from the player's path. */
const SCATTER = 0.8;
const SPIN = 9;
const MAX_SPEED = 3;
/** Speed and spin both fall by a factor of e every 1 / FRICTION seconds. */
const FRICTION = 4;
const REST_SPEED = 0.02;
const REST_SPIN = 0.05;
/** The center cell stays clear so nothing covers the waiting animal. */
const CLEAR_CENTER = 1;
const MAX_TRIES = 50;

export interface Leaf {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Rotation in radians, and how fast it is turning. */
  angle: number;
  spin: number;
  scale: number;
  tint: number;
}

function randomSpot(walls: readonly Wall[], rim: number, random: () => number): Point | null {
  const inner = CLEAR_CENTER + LEAF_RADIUS;
  const outer = rim - LEAF_RADIUS;
  for (let tries = 0; tries < MAX_TRIES; tries++) {
    const radius = Math.sqrt(inner ** 2 + random() * (outer ** 2 - inner ** 2));
    const angle = random() * 2 * Math.PI;
    const spot = { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
    if (fits(walls, spot, LEAF_RADIUS)) return spot;
  }
  return null;
}

/** Scatters leaves at rest over the floor, clear of the walls and the center cell. */
export function scatterLeaves(walls: readonly Wall[], rim: number, random: () => number): Leaf[] {
  const leaves: Leaf[] = [];
  for (let i = 0; i < LEAF_COUNT; i++) {
    const spot = randomSpot(walls, rim, random);
    if (spot === null) continue;
    leaves.push({
      id: i,
      ...spot,
      vx: 0,
      vy: 0,
      angle: random() * 2 * Math.PI,
      spin: 0,
      scale: 0.8 + random() * 0.5,
      tint: Math.floor(random() * LEAF_TINTS),
    });
  }
  return leaves;
}

function nearestOnSegment(from: Point, to: Point, p: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const t = Math.max(
    0,
    Math.min(1, ((p.x - from.x) * dx + (p.y - from.y) * dy) / (dx ** 2 + dy ** 2)),
  );
  return { x: from.x + t * dx, y: from.y + t * dy };
}

function kickOne(leaf: Leaf, from: Point, to: Point): void {
  const near = nearestOnSegment(from, to, leaf);
  const ax = leaf.x - near.x;
  const ay = leaf.y - near.y;
  const distance = Math.hypot(ax, ay);
  if (distance > KICK_RADIUS) return;
  const strength = 1 - distance / KICK_RADIUS;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const away = distance === 0 ? 0 : (SCATTER * Math.min(1, Math.hypot(dx, dy) * 10)) / distance;
  leaf.vx += strength * (dx * FOLLOW + ax * away);
  leaf.vy += strength * (dy * FOLLOW + ay * away);
  const speed = Math.hypot(leaf.vx, leaf.vy);
  if (speed > MAX_SPEED) {
    leaf.vx *= MAX_SPEED / speed;
    leaf.vy *= MAX_SPEED / speed;
  }
  const side = Math.sign(dx * ay - dy * ax) || 1;
  leaf.spin += side * SPIN * strength;
}

/** Kicks every leaf near the player's move from `from` to `to`. Mutates the leaves. */
export function kick(leaves: Leaf[], from: Point, to: Point): void {
  if (from.x === to.x && from.y === to.y) return;
  for (const leaf of leaves) kickOne(leaf, from, to);
}

function isMoving(leaf: Leaf): boolean {
  return leaf.vx !== 0 || leaf.vy !== 0 || leaf.spin !== 0;
}

function stepOne(leaf: Leaf, walls: readonly Wall[], rim: number, seconds: number): void {
  const from = { x: leaf.x, y: leaf.y };
  const at = slide(
    walls,
    rim,
    from,
    { x: from.x + leaf.vx * seconds, y: from.y + leaf.vy * seconds },
    LEAF_RADIUS,
  );
  const decay = Math.exp(-FRICTION * seconds);
  leaf.x = at.x;
  leaf.y = at.y;
  leaf.vx = ((at.x - from.x) / seconds) * decay;
  leaf.vy = ((at.y - from.y) / seconds) * decay;
  leaf.angle += leaf.spin * seconds;
  leaf.spin *= decay;
  if (Math.hypot(leaf.vx, leaf.vy) < REST_SPEED) {
    leaf.vx = 0;
    leaf.vy = 0;
  }
  if (Math.abs(leaf.spin) < REST_SPIN) leaf.spin = 0;
}

/**
 * Advances every moving leaf by `seconds`: it skids, spins and slows, and a wall in its way
 * takes away the speed heading into it. Mutates the leaves; returns whether any still move.
 */
export function stepLeaves(
  leaves: Leaf[],
  walls: readonly Wall[],
  rim: number,
  seconds: number,
): boolean {
  if (seconds <= 0) return leaves.some(isMoving);
  let moving = false;
  for (const leaf of leaves) {
    if (!isMoving(leaf)) continue;
    stepOne(leaf, walls, rim, seconds);
    moving ||= isMoving(leaf);
  }
  return moving;
}
