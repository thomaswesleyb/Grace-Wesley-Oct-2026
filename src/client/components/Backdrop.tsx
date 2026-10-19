import type { CSSProperties } from "react";

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
