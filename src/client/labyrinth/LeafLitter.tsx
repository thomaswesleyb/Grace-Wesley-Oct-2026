import { useEffect, useMemo, useRef } from "react";
import { type Leaf, kick, scatterLeaves, stepLeaves } from "@client/labyrinth/leaves.ts";
import type { Point } from "@client/labyrinth/maze.ts";
import type { Wall } from "@client/labyrinth/walls.ts";

/** A leaf blade pointing along x, with its stem poking out of the left end. */
const BLADE = "M -0.13 0 C -0.06 -0.08 0.06 -0.08 0.13 0 C 0.06 0.08 -0.06 0.08 -0.13 0 Z";
const VEIN = "M -0.17 0 L 0.1 0";
/** The longest frame step, so a stalled tab doesn't fling leaves when it wakes up. */
const MAX_FRAME_SECONDS = 0.05;

function leafTransform(leaf: Leaf): string {
  const degrees = (leaf.angle * 180) / Math.PI;
  return `translate(${leaf.x} ${leaf.y}) rotate(${degrees}) scale(${leaf.scale})`;
}

interface LeafLitterProps {
  /** The walls to scatter leaves clear of; fixed for a maze, so the leaves stay put. */
  layout: readonly Wall[];
  /** The walls leaves collide with right now. */
  walls: readonly Wall[];
  rim: number;
  /** The player's position; each change kicks the leaves along the way. */
  player: Point;
}

/**
 * Leaves strewn over the maze floor. They live outside React state: while any leaf moves, each
 * animation frame steps them and writes their transforms straight to the SVG.
 */
export function LeafLitter({ layout, walls, rim, player }: LeafLitterProps) {
  const leaves = useMemo(() => scatterLeaves(layout, rim, Math.random), [layout, rim]);
  const nodes = useRef<(SVGGElement | null)[]>([]);
  const last = useRef({ leaves, player });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    let previous: number | null = null;
    const tick = (now: number) => {
      const seconds =
        previous === null ? 1 / 60 : Math.min(MAX_FRAME_SECONDS, (now - previous) / 1000);
      previous = now;
      const moving = stepLeaves(leaves, walls, rim, seconds);
      leaves.forEach((leaf, i) => nodes.current[i]?.setAttribute("transform", leafTransform(leaf)));
      frame.current = moving ? requestAnimationFrame(tick) : null;
    };
    // A new maze brings new leaves; the move into it isn't a kick.
    if (last.current.leaves === leaves) kick(leaves, last.current.player, player);
    last.current = { leaves, player };
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [leaves, walls, rim, player]);

  return (
    <g className="labyrinth-leaves" aria-hidden="true">
      {leaves.map((leaf, i) => (
        <g
          key={leaf.id}
          ref={(node) => {
            nodes.current[i] = node;
          }}
          className={`labyrinth-leaf tint-${leaf.tint}`}
          transform={leafTransform(leaf)}
        >
          <path className="leaf-blade" d={BLADE} />
          <path className="leaf-vein" d={VEIN} />
        </g>
      ))}
    </g>
  );
}
