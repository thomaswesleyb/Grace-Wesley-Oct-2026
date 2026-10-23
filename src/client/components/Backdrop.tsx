import { useState, type CSSProperties } from "react";
import backdrops from "@content/backdrops.json";

interface BackdropProps {
  /** Image under public/, e.g. "/photos/all-saints.webp". */
  src: string;
  /** CSS background-position for the part of the photo to keep in view. */
  position?: string;
}

/**
 * A full-page photo behind a page's content, toned to the site's sepia palette.
 * Render it as the first child of a page; the page's sections stack above it.
 */
export function Backdrop({ src, position = "center" }: BackdropProps) {
  const style = {
    "--backdrop-image": `url("${src}")`,
    "--backdrop-position": position,
  } as CSSProperties;
  return <div className="backdrop" style={style} aria-hidden="true" />;
}

/**
 * Picks a backdrop at random, avoiding `previous` when there's another to choose.
 * `random` returns a number in [0, 1), like Math.random.
 */
export function pickBackdrop(
  sources: readonly string[],
  previous: string | null,
  random: () => number = Math.random,
): string | null {
  const choices = sources.length > 1 ? sources.filter((s) => s !== previous) : sources;
  return choices[Math.floor(random() * choices.length)] ?? null;
}

let lastPicked: string | null = null;

/**
 * A backdrop chosen at random from background-images/ (via content/backdrops.json) each time
 * it mounts. Give it a `key` that changes per page so every page visit picks again.
 */
export function RandomBackdrop() {
  const [src] = useState(() => {
    lastPicked = pickBackdrop(backdrops, lastPicked);
    return lastPicked;
  });
  return src === null ? null : <Backdrop src={src} />;
}
