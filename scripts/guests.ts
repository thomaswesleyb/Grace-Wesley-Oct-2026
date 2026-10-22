import { aliasKey, nameKey } from "@shared/names.ts";
import { MAX_PARTY } from "@shared/schemas.ts";
import { parseCsv } from "./csv.ts";
import { sql } from "./sql.ts";

export const GUEST_COLUMNS = ["firstname", "lastname", "total_guest_spots"] as const;
/** Optional: other names a guest may type, separated by ";" ("Bill; Will Smith-Jones"). */
export const OPTIONAL_GUEST_COLUMNS = ["aliases"] as const;

export interface SeedGuest {
  firstName: string;
  lastName: string;
  nameKey: string;
  spots: number;
  /** Alias keys, excluding the guest's own name key. */
  aliasKeys: string[];
  sort: number;
}

type Column = (typeof GUEST_COLUMNS)[number] | (typeof OPTIONAL_GUEST_COLUMNS)[number];

function parseSpots(value: string): number | null {
  const v = value.trim();
  return /^\d+$/.test(v) && Number(v) <= MAX_PARTY ? Number(v) : null;
}

function parseRow(row: string[], columns: string[], sort: number, problems: string[]) {
  const line = sort + 2;
  const col = (name: Column) => (row[columns.indexOf(name)] ?? "").trim();
  const firstName = col("firstname");
  const lastName = col("lastname");
  const spots = parseSpots(col("total_guest_spots"));
  if (!firstName || !lastName) problems.push(`Line ${line}: firstname and lastname are required.`);
  if (spots === null) {
    problems.push(
      `Line ${line}: total_guest_spots must be a whole number from 0 to ${MAX_PARTY}, got "${col("total_guest_spots")}".`,
    );
  }
  const key = nameKey(firstName, lastName);
  const aliases = col("aliases")
    .split(";")
    .map((a) => a.trim())
    .filter((a) => a !== "");
  const aliasKeys = [...new Set(aliases.map((a) => aliasKey(a, lastName)))].filter(
    (k) => k !== key && k !== "",
  );
  return { firstName, lastName, nameKey: key, spots: spots ?? 0, aliasKeys, sort };
}

/** Reports every name or alias that more than one guest could be found by. */
function collisions(guests: SeedGuest[]): string[] {
  const owners = new Map<string, number[]>();
  for (const g of guests) {
    for (const key of [g.nameKey, ...g.aliasKeys]) {
      owners.set(key, [...(owners.get(key) ?? []), g.sort + 2]);
    }
  }
  return [...owners]
    .filter(([, lines]) => lines.length > 1)
    .map(([key, lines]) => `"${key}" belongs to more than one guest (lines ${lines.join(", ")}).`);
}

/**
 * Parses and checks `guest-list.csv`. Every problem is collected, and an error listing them all
 * is thrown, so one run shows everything that needs fixing.
 */
export function buildGuests(text: string): SeedGuest[] {
  const [header, ...rows] = parseCsv(text);
  const columns = header?.map((h) => h.trim().toLowerCase()) ?? [];
  const missing = GUEST_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `Guest CSV is missing columns: ${missing.join(", ")}. Expected: ${GUEST_COLUMNS.join(",")}[,aliases]`,
    );
  }
  const problems: string[] = [];
  const guests = rows.map((row, sort) => parseRow(row, columns, sort, problems));
  problems.push(...collisions(guests));
  if (problems.length > 0) {
    throw new Error(`The guest list has problems. Nothing was changed.\n${problems.join("\n")}`);
  }
  return guests;
}

/** A guest already in the database. */
export interface ExistingGuest {
  nameKey: string;
  hasRsvp: boolean;
}

export interface SeedPlan {
  added: number;
  updated: number;
  /** Name keys of guests no longer in the CSV. */
  removed: string[];
}

/**
 * Compares the CSV with the database. Throws when a guest who has answered would be removed,
 * since their RSVP would lose its guest.
 */
export function planSeed(guests: SeedGuest[], existing: ExistingGuest[]): SeedPlan {
  const keys = new Set(guests.map((g) => g.nameKey));
  const known = new Set(existing.map((e) => e.nameKey));
  const gone = existing.filter((e) => !keys.has(e.nameKey));
  const answered = gone.filter((e) => e.hasRsvp).map((e) => e.nameKey);
  if (answered.length > 0) {
    throw new Error(
      `These guests have RSVPs but aren't in the guest list: ${answered.join("; ")}. ` +
        "To rename one, put the old spelling back and add the new one under aliases. " +
        "To remove one, delete their RSVP in admin first. Nothing was changed.",
    );
  }
  const updated = guests.filter((g) => known.has(g.nameKey)).length;
  return { added: guests.length - updated, updated, removed: gone.map((e) => e.nameKey) };
}

/** Upserts by name key, so a guest's id and RSVPs survive edits to their spots or aliases. */
export function buildGuestSql(guests: SeedGuest[], removed: string[], newId: () => string): string {
  const lines: string[] = [];
  if (removed.length > 0) {
    const list = removed.map(sql).join(", ");
    lines.push(
      `DELETE FROM guest_aliases WHERE guest_id IN (SELECT id FROM guests WHERE name_key IN (${list}));`,
      `DELETE FROM guests WHERE name_key IN (${list});`,
    );
  }
  for (const g of guests) {
    lines.push(
      `INSERT INTO guests (id, first_name, last_name, name_key, spots, sort) VALUES (${sql(newId())}, ${sql(g.firstName)}, ${sql(g.lastName)}, ${sql(g.nameKey)}, ${g.spots}, ${g.sort}) ON CONFLICT (name_key) DO UPDATE SET first_name = excluded.first_name, last_name = excluded.last_name, spots = excluded.spots, sort = excluded.sort;`,
    );
  }
  lines.push("DELETE FROM guest_aliases;");
  for (const g of guests) {
    for (const alias of g.aliasKeys) {
      lines.push(
        `INSERT INTO guest_aliases (guest_id, name_key) SELECT id, ${sql(alias)} FROM guests WHERE name_key = ${sql(g.nameKey)};`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
