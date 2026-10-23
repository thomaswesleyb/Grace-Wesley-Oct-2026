/**
 * A round maze laid out like the 7-circuit labyrinth in Abbo's Alley: a center cell inside seven
 * rings. Unlike the real labyrinth (one path, no choices) this is a "perfect" maze: exactly one
 * route between any two cells, with branches and dead ends along the way.
 *
 * Cell 0 is the center. Ring r (1..RINGS) spans radius r to r + 1, so the outer wall sits at
 * radius RINGS + 1. Angles are screen angles: 0 points right, π/2 points down.
 */

export const RINGS = 7;
export const CENTER = 0;

export interface Maze {
  /** Cells in each ring; ring 0 is the center and always has 1. */
  ringSizes: readonly number[];
  /** Id of the first cell in each ring. */
  ringStarts: readonly number[];
  /** Open passages: links[a].has(b) means a and b are joined. Symmetric. */
  links: readonly ReadonlySet<number>[];
  /** The outer-ring cell at the bottom, where the player enters. */
  entrance: number;
  /** The dead end holding the wedding ring, off the route from the entrance to the center. */
  weddingRing: number;
  /** Rotation that centers the entrance cell at the bottom of the board. */
  angleOffset: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Ring sizes chosen so cells stay roughly square: each ring keeps or multiplies the last. */
export function ringSizes(rings: number): number[] {
  const sizes = [1];
  for (let ring = 1; ring <= rings; ring++) {
    const previous = sizes[ring - 1] ?? 1;
    if (ring === 1) {
      sizes.push(6);
      continue;
    }
    const estimate = (2 * Math.PI * ring) / previous;
    sizes.push(previous * Math.max(1, Math.round(estimate)));
  }
  return sizes;
}

/** Deterministic PRNG (mulberry32) so a seed always gives the same maze. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Grid {
  ringSizes: readonly number[];
  ringStarts: readonly number[];
}

function buildGrid(rings: number): Grid {
  const sizes = ringSizes(rings);
  const starts: number[] = [];
  let next = 0;
  for (const size of sizes) {
    starts.push(next);
    next += size;
  }
  return { ringSizes: sizes, ringStarts: starts };
}

function sizeOf(grid: Grid, ring: number): number {
  return grid.ringSizes[ring] ?? 0;
}

function startOf(grid: Grid, ring: number): number {
  return grid.ringStarts[ring] ?? 0;
}

/** The ring and position within the ring of a cell id. */
export function locate(grid: Grid, cell: number): { ring: number; index: number } {
  for (let ring = grid.ringSizes.length - 1; ring >= 0; ring--) {
    const start = startOf(grid, ring);
    if (cell >= start) return { ring, index: cell - start };
  }
  throw new Error(`Cell ${cell} is not in the maze.`);
}

/** Every cell that shares a wall with `cell`, open or not. */
export function neighbors(grid: Grid, cell: number): number[] {
  if (cell === CENTER) {
    return Array.from({ length: sizeOf(grid, 1) }, (_, i) => startOf(grid, 1) + i);
  }
  const { ring, index } = locate(grid, cell);
  const size = sizeOf(grid, ring);
  const start = startOf(grid, ring);
  const result = [start + ((index + 1) % size), start + ((index - 1 + size) % size)];
  const inwardRatio = size / sizeOf(grid, ring - 1);
  result.push(startOf(grid, ring - 1) + Math.floor(index / inwardRatio));
  if (ring + 1 < grid.ringSizes.length) {
    const outwardRatio = sizeOf(grid, ring + 1) / size;
    for (let k = 0; k < outwardRatio; k++) {
      result.push(startOf(grid, ring + 1) + index * outwardRatio + k);
    }
  }
  return result;
}

function isOutward(grid: Grid, from: number, to: number): boolean {
  return from === CENTER || locate(grid, to).ring > locate(grid, from).ring;
}

/** Randomized depth-first search; a cell never gets a second outward passage. */
function carvePassages(grid: Grid, start: number, random: () => number): Set<number>[] {
  const cellCount = grid.ringSizes.reduce((sum, size) => sum + size, 0);
  const links = Array.from({ length: cellCount }, () => new Set<number>());
  const hasOutward = new Set<number>();
  const visited = new Set([start]);
  const stack = [start];
  const canCarve = (from: number, to: number) =>
    !visited.has(to) && !(hasOutward.has(from) && isOutward(grid, from, to));

  while (stack.length > 0) {
    const current = stack.at(-1) ?? start;
    const open = neighbors(grid, current).filter((next) => canCarve(current, next));
    const chosen = open[Math.floor(random() * open.length)];
    if (chosen === undefined) {
      stack.pop();
      continue;
    }
    if (isOutward(grid, current, chosen)) hasOutward.add(current);
    if (isOutward(grid, chosen, current)) hasOutward.add(chosen);
    links[current]?.add(chosen);
    links[chosen]?.add(current);
    visited.add(chosen);
    stack.push(chosen);
  }
  return links;
}

/**
 * Carves a perfect maze from the entrance. Each cell gets at most one outward passage, so the
 * center has exactly one way in.
 */
export function generateMaze(seed: number, rings = RINGS): Maze {
  const grid = buildGrid(rings);
  const outer = sizeOf(grid, rings);
  const entrance = startOf(grid, rings) + Math.floor(outer / 4);
  const links = carvePassages(grid, entrance, seededRandom(seed));
  const weddingRing = detourDeadEnd(links, route(links, entrance, CENTER));
  return { ...grid, links, entrance, weddingRing, angleOffset: -Math.PI / outer };
}

/** Steps through open passages from every source cell; distance[cell] is -1 if unreached. */
function distancesFrom(links: Maze["links"], sources: readonly number[]): number[] {
  const distance = links.map(() => -1);
  for (const source of sources) distance[source] = 0;
  const queue = [...sources];
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head] ?? CENTER;
    for (const next of links[cell] ?? []) {
      if (distance[next] !== -1) continue;
      distance[next] = (distance[cell] ?? 0) + 1;
      queue.push(next);
    }
  }
  return distance;
}

/** The cells on the only route between two cells of a perfect maze, both ends included. */
export function route(links: Maze["links"], from: number, to: number): number[] {
  const distance = distancesFrom(links, [to]);
  const path = [from];
  let at = from;
  while (at !== to) {
    const here = distance[at] ?? -1;
    const next = [...(links[at] ?? [])].find((cell) => distance[cell] === here - 1);
    if (next === undefined) throw new Error(`No route from cell ${from} to cell ${to}.`);
    path.push(next);
    at = next;
  }
  return path;
}

/** The ring's branch aims for this share of the main route's length, so the detour is fair. */
const DETOUR_SHARE = 1 / 3;
const MIN_DETOUR = 4;

/**
 * The dead end whose branch off `path` comes closest to a third of the path's length (the
 * longer one on a tie), so fetching the ring is a real detour but not a second maze.
 */
function detourDeadEnd(links: Maze["links"], path: readonly number[]): number {
  const distance = distancesFrom(links, path);
  const target = Math.max(MIN_DETOUR, Math.round(path.length * DETOUR_SHARE));
  let best = -1;
  let bestMiss = Infinity;
  links.forEach((set, cell) => {
    const off = distance[cell] ?? 0;
    const miss = Math.abs(off - target);
    if (set.size !== 1 || off === 0) return;
    if (miss < bestMiss || (miss === bestMiss && off > (distance[best] ?? 0))) {
      best = cell;
      bestMiss = miss;
    }
  });
  if (best === -1) throw new Error("The maze has no dead end off the route for the ring.");
  return best;
}

/** The angles where a ring cell starts and ends. */
export function cellAngles(maze: Maze, cell: number): { start: number; end: number } {
  const { ring, index } = locate(maze, cell);
  const step = (2 * Math.PI) / sizeOf(maze, ring);
  return { start: maze.angleOffset + index * step, end: maze.angleOffset + (index + 1) * step };
}

/** Where a cell's center sits, in maze units with the board's center at (0, 0). */
export function cellCenter(maze: Maze, cell: number): Point {
  if (cell === CENTER) return { x: 0, y: 0 };
  const { ring } = locate(maze, cell);
  const { start, end } = cellAngles(maze, cell);
  const angle = (start + end) / 2;
  const radius = ring + 0.5;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

/** The cell under a point in maze units, or null when the point is outside the maze. */
export function cellAt(maze: Maze, point: Point): number | null {
  const ring = Math.floor(Math.hypot(point.x, point.y));
  if (ring === CENTER) return CENTER;
  const size = sizeOf(maze, ring);
  if (size === 0) return null;
  const turn = 2 * Math.PI;
  const angle = (((Math.atan2(point.y, point.x) - maze.angleOffset) % turn) + turn) % turn;
  return startOf(maze, ring) + (Math.floor((angle / turn) * size) % size);
}
