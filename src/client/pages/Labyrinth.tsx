import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { LeafLitter } from "@client/labyrinth/LeafLitter.tsx";
import { LeaderboardPanel, useLeaderboard } from "@client/labyrinth/Leaderboard.tsx";
import { type Animal, AnimalIcon, AnimalMark, otherAnimal } from "@client/labyrinth/animals.tsx";
import { EDGE, type Game, blocking, startGame, walk } from "@client/labyrinth/game.ts";
import { type Point, RINGS, cellCenter } from "@client/labyrinth/maze.ts";
import { wallPath } from "@client/labyrinth/walls.ts";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { type SessionGuest, useSession } from "@client/session.ts";
import { site } from "@client/site.ts";
import { okResponse } from "@shared/schemas.ts";
import "@client/pages/labyrinth.css";

/** Screen directions for the arrow keys and WASD, in maze units per key press. */
const KEY_STEP = 0.25;
const KEYS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -KEY_STEP },
  ArrowDown: { x: 0, y: KEY_STEP },
  ArrowLeft: { x: -KEY_STEP, y: 0 },
  ArrowRight: { x: KEY_STEP, y: 0 },
  w: { x: 0, y: -KEY_STEP },
  s: { x: 0, y: KEY_STEP },
  a: { x: -KEY_STEP, y: 0 },
  d: { x: KEY_STEP, y: 0 },
};

/** A drag must start this close to the player, in maze units. */
const GRAB_RADIUS = 0.9;
const VIEW = `${-EDGE - 0.6} ${-EDGE - 0.6} ${2 * EDGE + 1.2} ${2 * EDGE + 1.2}`;
/** Where the player stands beside the other animal once they meet in the center. */
const MEETING_SPOT = { x: -0.42, y: 0.1 };
/** Where the ring rides once carried, relative to the player. */
const CARRIED = { x: 0.26, y: -0.28 };

const GEM = "M 0 -0.3 L 0.07 -0.22 L 0 -0.15 L -0.07 -0.22 Z";

const newSeed = () => Math.floor(Math.random() * 2 ** 32);

const HEART =
  "M 0 -0.42 C -0.08 -0.62 -0.36 -0.62 -0.36 -0.4 C -0.36 -0.24 -0.12 -0.14 0 -0.02 C 0.12 -0.14 0.36 -0.24 0.36 -0.4 C 0.36 -0.62 0.08 -0.62 0 -0.42 Z";

function toMaze(svg: SVGSVGElement, event: PointerEvent): Point | null {
  const matrix = svg.getScreenCTM();
  if (matrix === null) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
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

/** A gold band with a small stone; it glows while it waits to be found. */
function WeddingRing({ at, scale, glow }: { at: Point; scale: number; glow: boolean }) {
  return (
    <g
      className="labyrinth-wedding-ring"
      transform={`translate(${at.x} ${at.y}) scale(${scale})`}
      aria-hidden="true"
    >
      {glow && <circle className="ring-glow" r={0.34} />}
      <circle className="ring-band" r={0.15} />
      <path className="ring-gem" d={GEM} />
    </g>
  );
}

interface BoardProps {
  game: Game;
  onDrag: (to: Point) => void;
}

/**
 * Pointer handlers that drag the player. A drag starts only on the player, and the player keeps
 * its offset from the pointer so it doesn't jump to the fingertip.
 */
function useDrag(position: Point, enabled: boolean, onDrag: (to: Point) => void) {
  const grab = useRef<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const endDrag = () => {
    grab.current = null;
    setDragging(false);
  };
  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const point = toMaze(event.currentTarget, event);
    if (!enabled || point === null) return;
    const offset = { x: point.x - position.x, y: point.y - position.y };
    if (Math.hypot(offset.x, offset.y) > GRAB_RADIUS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    grab.current = offset;
    setDragging(true);
  };
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const offset = grab.current;
    const point = toMaze(event.currentTarget, event);
    if (offset === null || point === null) return;
    onDrag({ x: point.x - offset.x, y: point.y - offset.y });
  };
  const handlers = { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag };
  return { dragging, handlers };
}

/** The player follows the pointer while dragged, stopping at walls and sliding along them. */
function Board({ game, onDrag }: BoardProps) {
  const { walls, gatedWalls, animal, position, hasRing, won } = game;
  const path = useMemo(() => wallPath(walls), [walls]);
  const { dragging, handlers } = useDrag(position, !won, onDrag);

  return (
    <svg
      className={`labyrinth-board${dragging ? " dragging" : ""}`}
      viewBox={VIEW}
      role="img"
      aria-label={`A round maze of ${RINGS} circuits. A ring lies in one of its dead ends, and the ${otherAnimal(animal)} waits behind a gate in the center.`}
      {...handlers}
    >
      <circle className="labyrinth-ground" r={EDGE} />
      <circle className="labyrinth-rim" r={EDGE + 0.4} />
      <LeafLitter layout={gatedWalls} walls={blocking(game)} rim={EDGE} player={position} />
      <path className="labyrinth-walls" d={path} />
      {!hasRing && <RingAndGate game={game} />}
      <Meeting game={game} />
    </svg>
  );
}

/** The ring waiting in its dead end and the gate it opens, both gone once the ring is carried. */
function RingAndGate({ game }: { game: Game }) {
  const { maze, gate } = game;
  const ringSpot = useMemo(() => cellCenter(maze, maze.weddingRing), [maze]);
  return (
    <>
      <path className="labyrinth-gate" d={wallPath([gate])} />
      <WeddingRing at={ringSpot} scale={1} glow />
    </>
  );
}

/** Both animals: the other waits in the center, and on a win the player joins it there. */
function Meeting({ game }: { game: Game }) {
  const { animal, position, hasRing, won } = game;
  const player = won ? MEETING_SPOT : position;
  return (
    <>
      <g transform={`translate(${won ? 0.42 : 0} ${won ? 0.1 : 0})`}>
        <AnimalMark animal={otherAnimal(animal)} scale={won ? 0.38 : 0.55} />
      </g>
      {won && <path className="labyrinth-heart" d={HEART} transform="translate(0 -0.35)" />}
      <g
        className={`labyrinth-player${won ? " arrived" : ""}`}
        style={{ transform: `translate(${player.x}px, ${player.y}px)` }}
      >
        <AnimalMark animal={animal} scale={0.38} />
        {hasRing && <WeddingRing at={CARRIED} scale={0.7} glow={false} />}
      </g>
    </>
  );
}

type Saved = { ok: true } | { ok: false; error: string } | null;

/**
 * Saves each won game's time under the guest's name, once, then calls `onSaved`. Returns how
 * saving the current game went: null while it's unfinished or saving, or when there's no guest.
 */
function useSaveRun(
  game: Game | null,
  guest: SessionGuest | null | undefined,
  onSaved: () => void,
): Saved {
  const [saved, setSaved] = useState<{ game: Game; result: Saved } | null>(null);
  const sent = useRef<Game | null>(null);
  const finished = game !== null && game.won ? game : null;
  useEffect(() => {
    if (finished === null || finished.finishedAt === null || !guest) return;
    if (sent.current === finished) return;
    sent.current = finished;
    const body = { animal: finished.animal, durationMs: finished.finishedAt - finished.startedAt };
    apiFetch("/api/labyrinth/runs", okResponse, { method: "POST", body })
      .then(() => {
        setSaved({ game: finished, result: { ok: true } });
        onSaved();
      })
      .catch((e: unknown) => {
        const error = e instanceof ApiRequestError ? e.message : "Your time couldn't be saved.";
        setSaved({ game: finished, result: { ok: false, error } });
      });
  }, [finished, guest, onSaved]);
  return saved !== null && saved.game === finished ? saved.result : null;
}

function SavedNote({ saved, guest }: { saved: Saved; guest: SessionGuest | null | undefined }) {
  if (saved === null || !guest) return null;
  if (!saved.ok) return <p className="notice error">{saved.error}</p>;
  return <p className="labyrinth-saved">Your time is saved, {guest.firstName}.</p>;
}

interface WinProps {
  animal: Animal;
  onAgain: () => void;
  onSwitch: () => void;
  children: ReactNode;
}

function WinPanel({ animal, onAgain, onSwitch, children }: WinProps) {
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus(), []);
  return (
    <div className="labyrinth-win">
      <h2>
        The {animal} found the {otherAnimal(animal)}
      </h2>
      {children}
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

/** Arrow keys and WASD nudge the player while a game is running. */
function useKeyboard(active: boolean, onNudge: (by: Point) => void) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
      const by = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (by === undefined) return;
      event.preventDefault();
      onNudge(by);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onNudge]);
}

interface PlayProps {
  game: Game;
  onDrag: (to: Point) => void;
  onNewGame: (animal: Animal) => void;
  saved: Saved;
  guest: SessionGuest | null | undefined;
}

/** The board, what's happening, and once won, the way to play again. */
function Play({ game, onDrag, onNewGame, saved, guest }: PlayProps) {
  const other = otherAnimal(game.animal);
  return (
    <>
      <Board game={game} onDrag={onDrag} />
      <p className="labyrinth-status" aria-live="polite">
        {game.message}
      </p>
      {game.won ? (
        <WinPanel
          animal={game.animal}
          onAgain={() => onNewGame(game.animal)}
          onSwitch={() => onNewGame(other)}
        >
          <SavedNote saved={saved} guest={guest} />
        </WinPanel>
      ) : (
        <p className="labyrinth-hint">
          {game.hasRing
            ? `Drag the ${game.animal} to the ${other}.`
            : `Drag the ${game.animal} to the ring, then to the ${other}.`}
        </p>
      )}
    </>
  );
}

export function Labyrinth() {
  const [game, setGame] = useState<Game | null>(null);
  const onDrag = useCallback(
    (to: Point) => setGame((g) => (g === null ? g : walk(g, to, Date.now()))),
    [],
  );
  const onNudge = useCallback(
    (by: Point) =>
      setGame((g) =>
        g === null ? g : walk(g, { x: g.position.x + by.x, y: g.position.y + by.y }, Date.now()),
      ),
    [],
  );
  useKeyboard(game !== null && !game.won, onNudge);
  const { guest } = useSession();
  const { board, reload } = useLeaderboard();
  const saved = useSaveRun(game, guest, reload);
  const [wonOnce, setWonOnce] = useState(false);
  if (game?.won === true && !wonOnce) setWonOnce(true);
  const onNewGame = (animal: Animal) => setGame(startGame(animal, newSeed(), Date.now()));

  return (
    <section className="page labyrinth-page">
      <h1>The Labyrinth</h1>
      {site.labyrinthIntro !== null && <p className="lede">{site.labyrinthIntro}</p>}
      {game === null ? (
        <StartScreen onChoose={onNewGame} />
      ) : (
        <Play game={game} onDrag={onDrag} onNewGame={onNewGame} saved={saved} guest={guest} />
      )}
      <LeaderboardPanel board={board} wonOnce={wonOnce} signedIn={Boolean(guest)} />
    </section>
  );
}
