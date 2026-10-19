const COMBINING_MARKS = /\p{M}/gu;
const NON_LETTERS = /[^\p{L}\s]/gu;
const WHITESPACE = /\s+/g;

/** Lowercases, strips accents and punctuation, and collapses whitespace. */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(NON_LETTERS, "")
    .replace(WHITESPACE, " ")
    .trim();
}

/** The key stored in `guests.name_key` and compared at lookup time. */
export function nameKey(first: string, last: string): string {
  return `${normalizeName(first)} ${normalizeName(last)}`.trim();
}

function cell(d: number[][], a: string, b: string, i: number, j: number): number {
  const cost = a[i - 1] === b[j - 1] ? 0 : 1;
  const best = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
  const transposed = i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
  return transposed ? Math.min(best, d[i - 2]![j - 2]! + 1) : best;
}

/** Optimal string alignment distance: Levenshtein plus adjacent transpositions. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_row, i) =>
    Array.from({ length: b.length + 1 }, (_cell, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i]![j] = cell(d, a, b, i, j);
  }
  return d[a.length]![b.length]!;
}

/** Typos tolerated for a key of this length: none for very short names, up to two for long. */
export function allowedTypos(key: string): number {
  if (key.length < 8) return 0;
  if (key.length < 14) return 1;
  return 2;
}

export interface NameCandidate {
  guestId: string;
  invitationId: string;
  nameKey: string;
}

/** The one invitation among `ids`, or null when there are none or several. */
function only(ids: Set<string>): string | null {
  return ids.size === 1 ? [...ids][0]! : null;
}

function closestInvitations(typedKey: string, candidates: NameCandidate[]): Set<string> {
  let bestDistance = allowedTypos(typedKey) + 1;
  let best = new Set<string>();
  for (const candidate of candidates) {
    const distance = editDistance(typedKey, candidate.nameKey);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = new Set([candidate.invitationId]);
    } else if (distance === bestDistance) {
      best.add(candidate.invitationId);
    }
  }
  return best;
}

/**
 * Finds the single invitation a typed name belongs to.
 *
 * An exact key match wins. Otherwise the closest key within the typo allowance wins, but only
 * if no other invitation is equally close. An ambiguous match returns null rather than guess.
 */
export function matchInvitation(typedKey: string, candidates: NameCandidate[]): string | null {
  if (typedKey.length === 0) return null;
  const exact = new Set(
    candidates.filter((c) => c.nameKey === typedKey).map((c) => c.invitationId),
  );
  if (exact.size > 0) return only(exact);
  if (allowedTypos(typedKey) === 0) return null;
  return only(closestInvitations(typedKey, candidates));
}
