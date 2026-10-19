import { z } from "zod";
import { nameKey } from "@shared/names.ts";

export const GUEST_COLUMNS = [
  "invitation",
  "first_name",
  "last_name",
  "plus_one_allowed",
  "wave",
  "priority",
] as const;

/** Columns the CSV may include. A missing column is treated as blank on every row. */
export const OPTIONAL_GUEST_COLUMNS = ["email"] as const;

export interface SeedGuest {
  firstName: string;
  lastName: string;
  nameKey: string;
  plusOneAllowed: boolean;
  email: string | null;
}

export interface SeedInvitation {
  label: string;
  wave: number;
  priority: number;
  guests: SeedGuest[];
}

const CSV_FIELD = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r?\n|$)/y;

/** Minimal RFC 4180 parser: quoted fields, doubled quotes, CRLF or LF line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  CSV_FIELD.lastIndex = 0;
  while (CSV_FIELD.lastIndex < text.length) {
    const start = CSV_FIELD.lastIndex;
    const match = CSV_FIELD.exec(text);
    if (match === null)
      throw new Error(
        `Guest CSV is malformed near character ${start + 1} (check for stray or unclosed quotes).`,
      );
    const [, quoted, plain, delimiter] = match;
    row.push(quoted === undefined ? (plain ?? "") : quoted.replaceAll('""', '"'));
    if (delimiter !== ",") {
      rows.push(row);
      row = [];
    }
  }
  if (row.length > 0) rows.push([...row, ""]);
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["", "no", "n", "false", "0"]);

function parseYesNo(value: string, line: number): boolean {
  const v = value.trim().toLowerCase();
  if (YES.has(v)) return true;
  if (NO.has(v)) return false;
  throw new Error(`Line ${line}: plus_one_allowed must be yes or no, got "${value}".`);
}

const emailAddress = z.email().max(254);

function parseEmail(value: string, line: number): string | null {
  const v = value.trim().toLowerCase();
  if (v === "") return null;
  if (!emailAddress.safeParse(v).success) {
    throw new Error(
      `Line ${line}: email "${value.trim()}" isn't a valid address. Fix it or leave it blank.`,
    );
  }
  return v;
}

function parseWave(value: string, line: number): number {
  const wave = Number(value.trim());
  if (![1, 2, 3].includes(wave))
    throw new Error(`Line ${line}: wave must be 1, 2 or 3, got "${value}".`);
  return wave;
}

function parsePriority(value: string, line: number, fallback: number): number {
  if (value.trim() === "") return fallback;
  const priority = Number(value.trim());
  if (!Number.isInteger(priority) || priority < 1) {
    throw new Error(`Line ${line}: priority must be a whole number of 1 or more, got "${value}".`);
  }
  return priority;
}

/**
 * Groups guest rows into invitations and checks them.
 *
 * A blank priority falls back to the row's position in the file (offset so explicit
 * priorities always come first). Duplicate names are rejected because the RSVP lookup could
 * not tell those guests apart.
 */
export function buildInvitations(text: string): SeedInvitation[] {
  const [header, ...rows] = parseCsv(text);
  const columns = header?.map((h) => h.trim().toLowerCase()) ?? [];
  const missing = GUEST_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0)
    throw new Error(
      `Guest CSV is missing columns: ${missing.join(", ")}. Expected: ${GUEST_COLUMNS.join(",")}`,
    );
  type Column = (typeof GUEST_COLUMNS)[number] | (typeof OPTIONAL_GUEST_COLUMNS)[number];
  const col = (row: string[], name: Column) => row[columns.indexOf(name)] ?? "";

  const invitations = new Map<string, SeedInvitation>();
  const seenNames = new Map<string, number>();
  rows.forEach((row, index) => {
    const line = index + 2;
    const firstName = col(row, "first_name").trim();
    const lastName = col(row, "last_name").trim();
    if (!firstName || !lastName)
      throw new Error(`Line ${line}: first_name and last_name are required.`);
    const key = nameKey(firstName, lastName);
    const earlier = seenNames.get(key);
    if (earlier !== undefined)
      throw new Error(
        `Line ${line}: "${firstName} ${lastName}" duplicates line ${earlier}. Add a middle initial or nickname so the RSVP lookup can tell them apart.`,
      );
    seenNames.set(key, line);

    const label = col(row, "invitation").trim() || `${firstName} ${lastName}`;
    const wave = parseWave(col(row, "wave"), line);
    const priority = parsePriority(col(row, "priority"), line, 100_000 + index);
    const guest: SeedGuest = {
      firstName,
      lastName,
      nameKey: key,
      plusOneAllowed: parseYesNo(col(row, "plus_one_allowed"), line),
      email: parseEmail(col(row, "email"), line),
    };

    const existing = invitations.get(label);
    if (existing === undefined) {
      invitations.set(label, { label, wave, priority, guests: [guest] });
      return;
    }
    if (existing.wave !== wave)
      throw new Error(
        `Line ${line}: "${label}" is in wave ${existing.wave} on an earlier line but wave ${wave} here.`,
      );
    existing.priority = Math.min(existing.priority, priority);
    existing.guests.push(guest);
  });
  return [...invitations.values()];
}

const sql = (value: string | number | null) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${value.replaceAll("'", "''")}'`;

export interface SeedOptions {
  releaseWave: number | null;
  deadlines: Map<number, string>;
  now: string;
  newId: () => string;
}

export function buildSeedSql(invitations: SeedInvitation[], options: SeedOptions): string {
  const lines: string[] = [];
  for (const [wave, date] of options.deadlines) {
    lines.push(`UPDATE waves SET respond_by = ${sql(date)} WHERE wave = ${wave};`);
  }
  for (const invitation of invitations) {
    const id = options.newId();
    const sent = options.releaseWave !== null && invitation.wave <= options.releaseWave;
    lines.push(
      `INSERT INTO invitations (id, label, wave, priority, status, sent_at) VALUES (${sql(id)}, ${sql(invitation.label)}, ${invitation.wave}, ${invitation.priority}, ${sql(sent ? "sent" : "held")}, ${sql(sent ? options.now : null)});`,
    );
    invitation.guests.forEach((g, sort) => {
      lines.push(
        `INSERT INTO guests (id, invitation_id, first_name, last_name, name_key, plus_one_allowed, email, sort) VALUES (${sql(options.newId())}, ${sql(id)}, ${sql(g.firstName)}, ${sql(g.lastName)}, ${sql(g.nameKey)}, ${g.plusOneAllowed ? 1 : 0}, ${sql(g.email)}, ${sort});`,
      );
    });
  }
  return `${lines.join("\n")}\n`;
}
