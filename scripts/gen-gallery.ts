import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import type { GalleryPhoto } from "@shared/site.ts";
import { CAPTIONS_FILE, planGallery } from "./gallery.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = `${root}images`;
const outDir = `${root}public/photos/gallery`;
const manifest = `${root}content/gallery.json`;

/** Long-side limits for the two copies; ">" only ever shrinks. */
const SIZES = { large: "1600x1600>", small: "800x>" } as const;

function isFresh(output: string, input: string): boolean {
  return existsSync(output) && statSync(output).mtimeMs >= statSync(input).mtimeMs;
}

/** Converts to WebP, fixing camera rotation and stripping metadata (including GPS). */
function toWebp(input: string, output: string, size: string): void {
  if (isFresh(output, input)) return;
  execFileSync("convert", [
    `${input}[0]`,
    "-auto-orient",
    "-strip",
    "-resize",
    size,
    "-quality",
    "82",
    output,
  ]);
}

function dimensions(file: string): { width: number; height: number } {
  const [width, height] = execFileSync("identify", ["-format", "%w %h", file], {
    encoding: "utf8",
  })
    .trim()
    .split(" ")
    .map(Number);
  if (!width || !height) throw new Error(`Couldn't read the size of ${file}.`);
  return { width, height };
}

const files = existsSync(sourceDir) ? readdirSync(sourceDir) : [];
const captionsPath = `${sourceDir}/${CAPTIONS_FILE}`;
const captions = existsSync(captionsPath) ? readFileSync(captionsPath, "utf8") : null;
const planned = planGallery(files, captions);

mkdirSync(outDir, { recursive: true });
/** The small copy is skipped when the large one is already no wider than it. */
const SMALL_WIDTH = 800;

const photos: GalleryPhoto[] = planned.map((photo) => {
  const input = `${sourceDir}/${photo.file}`;
  const large = `${photo.slug}-1600.webp`;
  toWebp(input, `${outDir}/${large}`, SIZES.large);
  const { width, height } = dimensions(`${outDir}/${large}`);
  const src = `/photos/gallery/${large}`;
  let small = { src, width };
  if (width > SMALL_WIDTH) {
    const smallFile = `${photo.slug}-${SMALL_WIDTH}.webp`;
    toWebp(input, `${outDir}/${smallFile}`, SIZES.small);
    small = {
      src: `/photos/gallery/${smallFile}`,
      width: dimensions(`${outDir}/${smallFile}`).width,
    };
  }
  return { alt: photo.alt, caption: photo.caption, src, width, height, small };
});

const keep = new Set(photos.flatMap((p) => [p.src, p.small.src].map((s) => s.split("/").at(-1))));
for (const file of readdirSync(outDir)) {
  if (file.endsWith(".webp") && !keep.has(file)) unlinkSync(`${outDir}/${file}`);
}

writeFileSync(manifest, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`content/gallery.json: ${photos.length} photos.`);
