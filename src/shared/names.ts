import { nicknamesOf } from "@shared/nicknames.ts";

const COMBINING_MARKS = /\p{M}/gu;
const WORD_BREAKS = /[-‐‑–—_.]/g;
const NON_LETTERS = /[^\p{L}\s]/gu;
const WHITESPACE = /\s+/g;

/**
 * Lowercases, strips accents and apostrophes, and collapses whitespace. Hyphens, dots and
 * underscores become spaces, so "Smith-Jones" and "Smith Jones" give the same key.
 */
export function normalizeName(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(WORD_BREAKS, " ")
    .replace(NON_LETTERS, "")
    .replace(WHITESPACE, " ")
    .trim();
}

/** The key stored in `guests.name_key` and compared at lookup time. */
export function nameKey(first: string, last: string): string {
  return `${normalizeName(first)} ${normalizeName(last)}`.trim();
}

/**
 * The key for one alias. A one-word alias is a first name and takes the guest's last name
 * ("Bill" for William Smith is "bill smith"); anything longer is a full name.
 */
export function aliasKey(alias: string, lastName: string): string {
  const key = normalizeName(alias);
  return key.includes(" ") ? key : nameKey(key, lastName);
}

/** The typed name plus the same name with each of its nicknames as the first name. */
export function typedKeys(first: string, last: string): string[] {
  const variants = [normalizeName(first), ...nicknamesOf(normalizeName(first))];
  return [...new Set(variants.map((f) => nameKey(f, last)))];
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

/** One name a guest can be found by: their listed name or one of their aliases. */
export interface NameCandidate {
  guestId: string;
  nameKey: string;
}

/** A guest a typed name matched, and whether it matched as typed or only approximately. */
export interface GuestMatch {
  guestId: string;
  /**
   * True when the typed name is the guest's listed name or one of their aliases, ignoring
   * case, accents and punctuation. False for a typo or nickname match, which the guest should
   * confirm.
   */
  exact: boolean;
}

/** The one guest among `ids`, or null when there are none or several. */
function only(ids: Set<string>, exact: boolean): GuestMatch | null {
  return ids.size === 1 ? { guestId: [...ids][0]!, exact } : null;
}

function guestsWithKey(keys: Set<string>, candidates: NameCandidate[]): Set<string> {
  return new Set(candidates.filter((c) => keys.has(c.nameKey)).map((c) => c.guestId));
}

function closestGuests(typed: string[], candidates: NameCandidate[]): Set<string> {
  let bestDistance = Infinity;
  let best = new Set<string>();
  for (const key of typed) {
    for (const candidate of candidates) {
      const distance = editDistance(key, candidate.nameKey);
      if (distance > allowedTypos(key) || distance > bestDistance) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = new Set();
      }
      best.add(candidate.guestId);
    }
  }
  return best;
}

/**
 * Finds the single guest a typed name belongs to. `typed` holds the typed key first, then its
 * nickname variants (see `typedKeys`).
 *
 * The name as typed wins first, then a nickname variant, then the closest key within the typo
 * allowance. At each stage, two guests matching equally well returns null rather than a guess.
 */
export function matchGuest(typed: string[], candidates: NameCandidate[]): GuestMatch | null {
  const keys = typed.filter((k) => k.length > 0);
  const [asTyped, ...variants] = keys;
  if (asTyped === undefined) return null;
  const exact = guestsWithKey(new Set([asTyped]), candidates);
  if (exact.size > 0) return only(exact, true);
  const nicknamed = guestsWithKey(new Set(variants), candidates);
  if (nicknamed.size > 0) return only(nicknamed, false);
  return only(closestGuests(keys, candidates), false);
}
