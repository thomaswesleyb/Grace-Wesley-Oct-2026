import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { planBackdrops } from "./backdrops.ts";
import { removeStaleWebp, requireImageMagick, toWebp } from "./webp.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = `${root}background-images`;
const outDir = `${root}public/photos/backdrops`;
const manifest = `${root}content/backdrops.json`;

/** Backdrops are blurred and dimmed, so a smaller, lower-quality copy looks the same. */
const SIZE = "1280x1280>";
const QUALITY = 65;

const planned = planBackdrops(existsSync(sourceDir) ? readdirSync(sourceDir) : []);
if (planned.length === 0) {
  console.log(
    "background-images/ has no photos; keeping the current backdrops (content/backdrops.json).",
  );
  process.exit(0);
}
requireImageMagick("the page backdrops");

mkdirSync(outDir, { recursive: true });
const sources = planned.map(({ file, slug }) => {
  toWebp(`${sourceDir}/${file}`, `${outDir}/${slug}.webp`, SIZE, QUALITY);
  return `/photos/backdrops/${slug}.webp`;
});
removeStaleWebp(outDir, new Set(planned.map((p) => `${p.slug}.webp`)));

writeFileSync(manifest, `${JSON.stringify(sources, null, 2)}\n`);
console.log(`content/backdrops.json: ${sources.length} backdrops.`);
