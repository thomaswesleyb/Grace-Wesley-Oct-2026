import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseDetails, waveDeadlines } from "./content.ts";
import { buildInvitations, buildSeedSql } from "./guests.ts";

const USAGE = "Usage: pnpm seed:guests <guests.csv> (--local | --remote) [--release-wave 1]";
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
    "release-wave": { type: "string" },
  },
});
const csvPath = positionals[0];
if (csvPath === undefined || values.local === values.remote) throw new Error(USAGE);
const target = values.local ? "--local" : "--remote";
const releaseWave = values["release-wave"] === undefined ? null : Number(values["release-wave"]);
if (releaseWave !== null && ![1, 2, 3].includes(releaseWave))
  throw new Error(`--release-wave must be 1, 2 or 3. ${USAGE}`);

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "wedding", target, ...args], {
    cwd: root,
    encoding: "utf8",
  });

const existing = JSON.parse(
  wrangler("--json", "--command", "SELECT COUNT(*) AS n FROM invitations"),
) as {
  results: { n: number }[];
}[];
if ((existing[0]?.results[0]?.n ?? 0) > 0) {
  throw new Error(
    "The database already has invitations. Seeding again would duplicate guests, so it was stopped. Nothing was changed.",
  );
}

const invitations = buildInvitations(readFileSync(csvPath, "utf8"));
const deadlines = waveDeadlines(parseDetails(readFileSync(`${root}DETAILS.md`, "utf8")));
const sqlText = buildSeedSql(invitations, {
  releaseWave,
  deadlines,
  now: new Date().toISOString(),
  newId: () => crypto.randomUUID(),
});

mkdirSync(`${root}.wrangler`, { recursive: true });
const sqlPath = `${root}.wrangler/seed-guests.sql`;
writeFileSync(sqlPath, sqlText);
try {
  wrangler("--file", sqlPath);
} finally {
  rmSync(sqlPath);
}

const guestCount = invitations.reduce((n, i) => n + i.guests.length, 0);
const byWave = [1, 2, 3]
  .map((w) => `wave ${w}: ${invitations.filter((i) => i.wave === w).length}`)
  .join(", ");
console.log(
  `Seeded ${invitations.length} invitations (${guestCount} guests; ${byWave}) into the ${target.slice(2)} database.`,
);
console.log(
  releaseWave === null
    ? "All invitations are held. Pass --release-wave 1 to make wave 1 findable."
    : `Waves 1–${releaseWave} are marked sent.`,
);
if (deadlines.size < 3)
  console.warn(
    'warning: not every wave has an "RSVP deadline, wave N" in DETAILS.md; those waves have no deadline.',
  );
