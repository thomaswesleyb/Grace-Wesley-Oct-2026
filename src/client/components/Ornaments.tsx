/** Filigree spandrel traced from the printed invitation. */
export function Filigree({ position }: { position: "top" | "bottom" }) {
  return (
    <img
      className={`inv-filigree inv-filigree-${position}`}
      src="/ornaments/filigree.svg"
      alt=""
      width={470}
      height={164}
    />
  );
}

/** Lattice side border traced from the printed invitation; the left one is mirrored. */
export function Lattice({ side }: { side: "left" | "right" }) {
  return (
    <img
      className={`inv-lattice inv-lattice-${side}`}
      src="/ornaments/lattice.svg"
      alt=""
      width={39}
      height={971}
    />
  );
}
