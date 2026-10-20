import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { type Animal, AnimalIcon, AnimalMark, otherAnimal } from "@client/labyrinth/animals.tsx";
import {
  CENTER,
  type Direction,
  type Maze,
  RINGS,
  cellCenter,
  generateMaze,
  locate,
  move,
} from "@client/labyrinth/maze.ts";
import { wallPath } from "@client/labyrinth/walls.ts";
import { site } from "@client/site.ts";
import "@client/pages/labyrinth.css";

const KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const ARROWS: { direction: Direction; label: string; glyph: string }[] = [
  { direction: "up", label: "Move up", glyph: "↑" },
  { direction: "left", label: "Move left", glyph: "←" },
  { direction: "right", label: "Move right", glyph: "→" },
  { direction: "down", label: "Move down", glyph: "↓" },
];

/** A swipe shorter than this (in CSS pixels) is treated as a tap and ignored. */
const MIN_SWIPE = 24;
const EDGE = RINGS + 1;
const VIEW = `${-EDGE - 0.6} ${-EDGE - 0.6} ${2 * EDGE + 1.2} ${2 * EDGE + 1.2}`;

const HEART =
  "M 0 -0.42 C -0.08 -0.62 -0.36 -0.62 -0.36 -0.4 C -0.36 -0.24 -0.12 -0.14 0 -0.02 C 0.12 -0.14 0.36 -0.24 0.36 -0.4 C 0.36 -0.62 0.08 -0.62 0 -0.42 Z";

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

function swipeDirection(dx: number, dy: number): Direction | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < MIN_SWIPE) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function StartScreen({ onChoose }: { onChoose: (animal: Animal) => void }) {
  return (
    <div className="labyrinth-start">
      <p>Choose who walks the labyrinth. The other waits for you in the center.</p>
      <div className="labyrinth-choices">
        {(["fox", "deer"] as const).map((animal) => (
          <button
            key={animal}
            type="button"
            className="labyrinth-choice"
            onClick={() => onChoose(animal)}
          >
            <AnimalIcon animal={animal} />
            <span>Play as the {animal}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

interface BoardProps {
  maze: Maze;
  animal: Animal;
  position: number;
  onMove: (direction: Direction) => void;
}

function Board({ maze, animal, position, onMove }: BoardProps) {
  const walls = useMemo(() => wallPath(maze), [maze]);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const won = position === CENTER;
  const at = cellCenter(maze, position);
  const player = won ? { x: -0.42, y: 0.1 } : at;

  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    if (direction !== null) onMove(direction);
  };

  return (
    <svg
      className="labyrinth-board"
      viewBox={VIEW}
      role="img"
      aria-label={`A round maze of ${RINGS} rings. The ${otherAnimal(animal)} waits in the center.`}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (swipeStart.current = null)}
    >
      <circle className="labyrinth-ground" r={EDGE} />
      <circle className="labyrinth-rim" r={EDGE + 0.4} />
      <path className="labyrinth-walls" d={walls} />
      <g transform={`translate(${won ? 0.42 : 0} ${won ? 0.1 : 0})`}>
        <AnimalMark animal={otherAnimal(animal)} scale={won ? 0.38 : 0.55} />
      </g>
      {won && <path className="labyrinth-heart" d={HEART} transform="translate(0 -0.35)" />}
      <g
        className="labyrinth-player"
        style={{ transform: `translate(${player.x}px, ${player.y}px)` }}
      >
        <AnimalMark animal={animal} scale={0.38} />
      </g>
    </svg>
  );
}

function ArrowPad({ onMove }: { onMove: (direction: Direction) => void }) {
  return (
    <div className="labyrinth-pad" role="group" aria-label="Move">
      {ARROWS.map(({ direction, label, glyph }) => (
        <button
          key={direction}
          type="button"
          className={`labyrinth-arrow labyrinth-arrow-${direction}`}
          aria-label={label}
          onClick={() => onMove(direction)}
        >
          {glyph}
        </button>
      ))}
    </div>
  );
}

interface WinProps {
  animal: Animal;
  onAgain: () => void;
  onSwitch: () => void;
}

function WinPanel({ animal, onAgain, onSwitch }: WinProps) {
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus(), []);
  return (
    <div className="labyrinth-win">
      <h2>
        The {animal} found the {otherAnimal(animal)}
      </h2>
      <div className="actions">
        <button ref={again} type="button" className="button" onClick={onAgain}>
          Walk it again
        </button>
        <button type="button" className="button secondary" onClick={onSwitch}>
          Play as the {otherAnimal(animal)}
        </button>
      </div>
    </div>
  );
}

/** Arrow keys and WASD move the player while a game is running. */
function useKeyboard(active: boolean, onMove: (direction: Direction) => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      const direction = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (direction === undefined) return;
      event.preventDefault();
      onMove(direction);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onMove]);
}

interface Game {
  animal: Animal;
  maze: Maze;
  position: number;
  moves: number;
  message: string;
}

function startGame(animal: Animal): Game {
  const maze = generateMaze(newSeed());
  return {
    animal,
    maze,
    position: maze.entrance,
    moves: 0,
    message: `You are the ${animal}, at the entrance on ring ${RINGS}.`,
  };
}

function step(game: Game, direction: Direction): Game {
  if (game.position === CENTER) return game;
  const next = move(game.maze, game.position, direction);
  if (next === game.position) return { ...game, message: "A wall blocks the way." };
  const moves = game.moves + 1;
  const message =
    next === CENTER
      ? `You found the ${otherAnimal(game.animal)} in ${moves} moves.`
      : `Ring ${locate(game.maze, next).ring}.`;
  return { ...game, position: next, moves, message };
}

export function Labyrinth() {
  const [game, setGame] = useState<Game | null>(null);
  const won = game?.position === CENTER;
  const onMove = useCallback(
    (direction: Direction) => setGame((g) => (g === null ? g : step(g, direction))),
    [],
  );
  useKeyboard(game !== null && !won, onMove);

  return (
    <section className="page labyrinth-page">
      <h1>The Labyrinth</h1>
      {site.labyrinthIntro !== null && <p className="lede">{site.labyrinthIntro}</p>}
      {game === null ? (
        <StartScreen onChoose={(animal) => setGame(startGame(animal))} />
      ) : (
        <>
          <Board maze={game.maze} animal={game.animal} position={game.position} onMove={onMove} />
          <p className="labyrinth-status" aria-live="polite">
            {game.message}
          </p>
          {won ? (
            <WinPanel
              animal={game.animal}
              onAgain={() => setGame(startGame(game.animal))}
              onSwitch={() => setGame(startGame(otherAnimal(game.animal)))}
            />
          ) : (
            <>
              <ArrowPad onMove={onMove} />
              <p className="labyrinth-hint">Arrow keys, WASD, or swipe on the maze.</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
