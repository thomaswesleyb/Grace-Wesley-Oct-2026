export type Animal = "fox" | "deer";

export function otherAnimal(animal: Animal): Animal {
  return animal === "fox" ? "deer" : "fox";
}

/** A fox head drawn in a 2 × 2 box centered on the origin. */
function Fox() {
  return (
    <g className="animal-fox">
      <path
        className="animal-fill"
        d="M -0.78 -0.88 L -0.34 -0.4 L 0.34 -0.4 L 0.78 -0.88 L 0.72 -0.12 L 0 0.86 L -0.72 -0.12 Z"
      />
      <path className="animal-cheek" d="M -0.72 -0.12 L -0.18 0.08 L 0 0.86 Z" />
      <path className="animal-cheek" d="M 0.72 -0.12 L 0.18 0.08 L 0 0.86 Z" />
      <circle className="animal-ink" cx="-0.26" cy="-0.1" r="0.08" />
      <circle className="animal-ink" cx="0.26" cy="-0.1" r="0.08" />
      <circle className="animal-ink" cx="0" cy="0.74" r="0.1" />
    </g>
  );
}

/** A deer head with antlers, drawn in a 2 × 2 box centered on the origin. */
function Deer() {
  return (
    <g className="animal-deer">
      <path
        className="animal-antler"
        d="M -0.2 -0.42 L -0.42 -0.94 M -0.32 -0.7 L -0.62 -0.78 M -0.38 -0.84 L -0.2 -0.98 M 0.2 -0.42 L 0.42 -0.94 M 0.32 -0.7 L 0.62 -0.78 M 0.38 -0.84 L 0.2 -0.98"
      />
      <ellipse
        className="animal-fill"
        cx="-0.56"
        cy="-0.3"
        rx="0.3"
        ry="0.13"
        transform="rotate(-20 -0.56 -0.3)"
      />
      <ellipse
        className="animal-fill"
        cx="0.56"
        cy="-0.3"
        rx="0.3"
        ry="0.13"
        transform="rotate(20 0.56 -0.3)"
      />
      <path
        className="animal-fill"
        d="M -0.34 -0.4 Q 0 -0.56 0.34 -0.4 L 0.2 0.58 Q 0 0.82 -0.2 0.58 Z"
      />
      <circle className="animal-ink" cx="-0.17" cy="-0.12" r="0.07" />
      <circle className="animal-ink" cx="0.17" cy="-0.12" r="0.07" />
      <circle className="animal-ink" cx="0" cy="0.62" r="0.1" />
    </g>
  );
}

/** One animal at a maze point, scaled to fit inside a cell. */
export function AnimalMark({ animal, scale }: { animal: Animal; scale: number }) {
  return (
    <g transform={`scale(${scale})`} aria-hidden="true">
      {animal === "fox" ? <Fox /> : <Deer />}
    </g>
  );
}

/** A standalone icon for buttons. */
export function AnimalIcon({ animal }: { animal: Animal }) {
  return (
    <svg className="animal-icon" viewBox="-1 -1 2 2" aria-hidden="true">
      {animal === "fox" ? <Fox /> : <Deer />}
    </svg>
  );
}
