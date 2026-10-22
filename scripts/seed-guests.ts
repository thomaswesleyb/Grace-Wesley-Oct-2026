import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildGuests, buildGuestSql, planSeed, type ExistingGuest } from "./guests.ts";

const USAGE = "Usage: pnpm seed:guests (--local | --remote) [guest-list.csv]";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
  },
});
if (values.local === values.remote) throw new Error(USAGE);
const target = values.local ? "--local" : "--remote";

const root = fileURLToPath(new URL("..", import.meta.url));
const csvPath = positionals[0] ?? `${root}guest-list.csv`;
const wrangler = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "wedding", target, ...args], {
    cwd: root,
    encoding: "utf8",
  });

const guests = buildGuests(readFileSync(csvPath, "utf8"));

const [existingResult] = JSON.parse(
  wrangler(
    "--json",
    "--command",
    `SELECT g.name_key, EXISTS (SELECT 1 FROM rsvps r WHERE r.guest_id = g.id) AS has_rsvp
     FROM guests g`,
  ),
) as { results: { name_key: string; has_rsvp: 0 | 1 }[] }[];
const existing: ExistingGuest[] = (existingResult?.results ?? []).map((r) => ({
  nameKey: r.name_key,
  hasRsvp: r.has_rsvp === 1,
}));
const plan = planSeed(guests, existing);

mkdirSync(`${root}.wrangler`, { recursive: true });
const sqlPath = `${root}.wrangler/seed-guests.sql`;
writeFileSync(
  sqlPath,
  buildGuestSql(guests, plan.removed, () => crypto.randomUUID()),
);
try {
  wrangler("--file", sqlPath);
} finally {
  rmSync(sqlPath);
}

const spots = guests.reduce((sum, g) => sum + g.spots, 0);
const aliases = guests.reduce((sum, g) => sum + g.aliasKeys.length, 0);
console.log(
  `Seeded ${guests.length} guests (${spots} places, ${aliases} aliases) into the ${target.slice(2)} database: ` +
    `${plan.added} added, ${plan.updated} updated, ${plan.removed.length} removed.`,
);
const cantAttend = guests.filter((g) => g.spots === 0).length;
if (cantAttend > 0) {
  console.log(`${cantAttend} guest(s) have 0 places; looking them up says "not found".`);
}
