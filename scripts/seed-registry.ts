import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { buildRegistryItems, buildRegistrySql } from "./registry.ts";

const USAGE = "Usage: pnpm seed:registry (--local | --remote) [registry.csv]";
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
const csvPath = positionals[0] ?? `${root}wedding-registry.csv`;
const items = buildRegistryItems(readFileSync(csvPath, "utf8"));

const missingImages = items.filter(
  (i) => i.image !== null && !existsSync(`${root}public${i.image}`),
);
if (missingImages.length > 0) {
  const list = missingImages.map((i) => `${i.name}: public${i.image}`).join("; ");
  throw new Error(`Registry images not found (put them under public/): ${list}`);
}

mkdirSync(`${root}.wrangler`, { recursive: true });
const sqlPath = `${root}.wrangler/seed-registry.sql`;
writeFileSync(sqlPath, buildRegistrySql(items));
try {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "wedding", target, "--file", sqlPath],
    {
      cwd: root,
      encoding: "utf8",
    },
  );
} finally {
  rmSync(sqlPath);
}

const withoutPhoto = items.filter((i) => i.image === null).length;
console.log(`Upserted ${items.length} registry items into the ${target.slice(2)} database.`);
if (withoutPhoto > 0)
  console.log(`${withoutPhoto} item(s) have no Image column value; they show without a photo.`);
