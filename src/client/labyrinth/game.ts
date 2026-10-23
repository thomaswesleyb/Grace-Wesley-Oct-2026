/** The labyrinth's rules: find the ring in its dead end, then bring it through the gate. */
import { type Animal, otherAnimal } from "@client/labyrinth/animals.tsx";
import {
  CENTER,
  type Maze,
  type Point,
  RINGS,
  cellAt,
  cellCenter,
  generateMaze,
} from "@client/labyrinth/maze.ts";
import { PLAYER_RADIUS, fits, slide } from "@client/labyrinth/physics.ts";
import { type Wall, centerGate, mazeWalls } from "@client/labyrinth/walls.ts";

/** The maze's outer radius. */
export const EDGE = RINGS + 1;
/** The player picks up the ring when its center comes this close to the ring's. */
const PICKUP_RADIUS = 0.45;
/** How near the shut gate the player must be to be told why it won't open. */
const GATE_NOTICE = 0.05;

export interface Game {
  animal: Animal;
  maze: Maze;
  /** The maze's own walls, and the same with the gate shut across the center's doorway. */
  walls: readonly Wall[];
  gate: Wall;
  gatedWalls: readonly Wall[];
  position: Point;
  circuit: number;
  hasRing: boolean;
  won: boolean;
  startedAt: number;
  message: string;
}

/** A fresh game in a new maze; `now` is the start time in milliseconds. */
export function startGame(animal: Animal, seed: number, now: number): Game {
  const maze = generateMaze(seed);
  const walls = mazeWalls(maze);
  const gate = centerGate(maze);
  return {
    animal,
    maze,
    walls,
    gate,
    gatedWalls: [...walls, gate],
    position: cellCenter(maze, maze.entrance),
    circuit: RINGS,
    hasRing: false,
    won: false,
    startedAt: now,
    message: `You are the ${animal}, at the entrance. Find the ring before you go to the ${otherAnimal(animal)}.`,
  };
}

/** The walls in the way right now: the gate stands until the player carries the ring. */
export function blocking(game: Game): readonly Wall[] {
  return game.hasRing ? game.walls : game.gatedWalls;
}

function picksUpRing(game: Game, position: Point): boolean {
  const ring = cellCenter(game.maze, game.maze.weddingRing);
  return !game.hasRing && Math.hypot(position.x - ring.x, position.y - ring.y) < PICKUP_RADIUS;
}

function atShutGate(game: Game, position: Point): boolean {
  return !game.hasRing && !fits([game.gate], position, PLAYER_RADIUS + GATE_NOTICE);
}

/**
 * Moves the player toward `to` and applies what happens there: picking up the ring, bumping the
 * shut gate, or bringing the ring to the center to win. `now` is the time in milliseconds.
 */
export function walk(game: Game, to: Point, now: number): Game {
  if (game.won) return game;
  const position = slide(blocking(game), EDGE, game.position, to);
  const circuit = Math.floor(Math.hypot(position.x, position.y));
  const other = otherAnimal(game.animal);
  const moved = { ...game, position, circuit };
  if (game.hasRing && cellAt(game.maze, position) === CENTER) {
    const seconds = Math.max(1, Math.round((now - game.startedAt) / 1000));
    return {
      ...moved,
      won: true,
      message: `You brought the ring to the ${other} in ${seconds} seconds.`,
    };
  }
  if (picksUpRing(game, position)) {
    return { ...moved, hasRing: true, message: `You found the ring. Now take it to the ${other}.` };
  }
  if (atShutGate(game, position)) {
    return { ...moved, message: "The gate is shut. Find the ring first." };
  }
  const message = circuit === game.circuit ? game.message : `Circuit ${circuit}.`;
  return { ...moved, message };
}
