import { QA_ENTRIES, type FactLabel } from "@content/qa.ts";
import type { SiteContent } from "@shared/site.ts";

const REQUIRED = [
  "Bride name as printed on invitation",
  "Groom name as printed on invitation",
  "Wedding date",
  "Ceremony start time",
  "Ceremony venue",
  "Ceremony city, state",
  "Website URL",
] as const;

const PLACEHOLDER = /\{\{.*\}\}/;
const FACT_LINE = /^([A-Z][^:]{0,80}):\s+(.+)$/;
/** "October 23, 2027" or "March 30th, 2027". */
const DATE = /^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$/i;
const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

export type Facts = Map<string, string>;

/**
 * Reads `Label: value` lines from DETAILS.md. Lines inside quoted blocks, HTML comments, and
 * any value still holding a `{{ PLACEHOLDER }}` are skipped.
 */
export function parseDetails(markdown: string): Facts {
  const facts: Facts = new Map();
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, "");
  for (const line of withoutComments.split("\n")) {
    const match = FACT_LINE.exec(line.trim());
    if (!match) continue;
    const [, label, value] = match;
    if (label === undefined || value === undefined || PLACEHOLDER.test(value)) continue;
    const cleaned = value.trim();
    if (cleaned.startsWith('"')) continue;
    facts.set(label.trim(), cleaned);
  }
  return facts;
}

function requireFact(facts: Facts, label: string): string {
  const value = facts.get(label);
  if (value === undefined) {
    throw new Error(`DETAILS.md is missing "${label}: …". Add it before building the site.`);
  }
  return value;
}

/** Parses "October 23, 2027" + "5:00 pm" into local wall-clock parts. */
export function parseLocalDateTime(date: string, time: string): number[] {
  const d = DATE.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/i.exec(time.trim());
  const month = d ? MONTHS.indexOf(d[1]!.toLowerCase()) : -1;
  if (!d || !t || month < 0) {
    throw new Error(
      `Can't parse wedding date/time "${date}" "${time}". Use "October 23, 2027" and "5:00 pm".`,
    );
  }
  let hour = Number(t[1]) % 12;
  if (t[3]!.toLowerCase() === "p") hour += 12;
  return [Number(d[3]), month, Number(d[2]), hour, Number(t[2])];
}

function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - instant;
}

/** Returns the canonical IANA name, or throws a message the couple can act on. */
function canonicalTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone }).resolvedOptions().timeZone;
  } catch {
    throw new Error(
      `"Wedding time zone: ${timeZone}" isn't a time zone name the site understands. Use an IANA name such as "America/Chicago" (US Central) or "America/New_York" (US Eastern).`,
    );
  }
}

/** Converts a wall-clock time in an IANA zone to an ISO instant. */
export function toInstant(parts: number[], zoneName: string): string {
  const timeZone = canonicalTimeZone(zoneName);
  const [year, month, day, hour, minute] = parts as [number, number, number, number, number];
  const wall = Date.UTC(year, month, day, hour, minute);
  let instant = wall - zoneOffsetMs(wall, timeZone);
  instant = wall - zoneOffsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

export interface BuildResult {
  content: SiteContent;
  hiddenQuestions: string[];
  warnings: string[];
}

/** The countdown instant and guest contact, with a warning for each one still missing. */
function scheduleAndContact(facts: Facts, localParts: number[]) {
  const warnings: string[] = [];
  const timeZone = facts.get("Wedding time zone");
  const startsAt = timeZone === undefined ? null : toInstant(localParts, timeZone);
  if (startsAt === null)
    warnings.push('No "Wedding time zone" in DETAILS.md: the countdown is hidden.');
  const contact = facts.get("Couple contact") ?? "{{ COUPLE_CONTACT }}";
  if (!facts.has("Couple contact")) {
    warnings.push(
      'No "Couple contact" in DETAILS.md: RSVP pages show the {{ COUPLE_CONTACT }} placeholder.',
    );
  }
  return { startsAt, contact, warnings };
}

/** Q&A entries whose facts are all present; the rest are listed as hidden. */
function buildQa(facts: Facts) {
  const fact = (label: FactLabel) => facts.get(label);
  const qa: SiteContent["qa"] = [];
  const hiddenQuestions: string[] = [];
  for (const entry of QA_ENTRIES) {
    if (entry.requires.every((label) => facts.has(label))) {
      qa.push({ topic: entry.topic, question: entry.question, answer: entry.answer(fact) });
    } else {
      hiddenQuestions.push(entry.question);
    }
  }
  return { qa, hiddenQuestions };
}

export function buildContent(facts: Facts): BuildResult {
  const [brideFormal, groomFormal, dateText, timeText, ceremonyVenue, ceremonyCityState, website] =
    REQUIRED.map((label) => requireFact(facts, label)) as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
  const firstName = (label: string) => requireFact(facts, label).split(/[\s,]/)[0] ?? "";
  const { startsAt, contact, warnings } = scheduleAndContact(
    facts,
    parseLocalDateTime(dateText, timeText),
  );
  const { qa, hiddenQuestions } = buildQa(facts);
  const ceremonyAddress = facts.get("Ceremony address line") ?? null;
  const mapQuery = [ceremonyVenue, ceremonyAddress, ceremonyCityState].filter(Boolean).join(", ");

  return {
    content: {
      brideShort: firstName("Bride"),
      groomShort: firstName("Groom"),
      brideFormal,
      groomFormal,
      dateText,
      timeText,
      ceremonyVenue,
      ceremonyCityState,
      ceremonyAddress,
      mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`,
      website,
      startsAt,
      contact,
      registryIntro: facts.get("Registry intro") ?? null,
      photosIntro: facts.get("Photos intro") ?? null,
      labyrinthIntro: facts.get("Labyrinth intro") ?? null,
      qa,
    },
    hiddenQuestions,
    warnings,
  };
}
