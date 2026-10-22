import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { GalleryPhoto } from "@shared/site.ts";
import { CAPTIONS_FILE, planGallery } from "./gallery.ts";
import { dimensions, removeStaleWebp, requireImageMagick, toWebp } from "./webp.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceDir = `${root}images`;
const outDir = `${root}public/photos/gallery`;
const manifest = `${root}content/gallery.json`;

/** Long-side limits for the two copies; ">" only ever shrinks. */
const SIZES = { large: "1600x1600>", small: "800x>" } as const;

const files = existsSync(sourceDir) ? readdirSync(sourceDir) : [];
const captionsPath = `${sourceDir}/${CAPTIONS_FILE}`;
const captions = existsSync(captionsPath) ? readFileSync(captionsPath, "utf8") : null;
const { photos: planned, warnings } = planGallery(files, captions);
for (const warning of warnings) console.warn(`Warning: ${warning}`);

if (planned.length === 0) {
  console.log("images/ has no photos; keeping the current gallery (content/gallery.json).");
  process.exit(0);
}
requireImageMagick("the gallery");

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

removeStaleWebp(
  outDir,
  new Set(photos.flatMap((p) => [p.src, p.small.src].map((s) => s.split("/").at(-1) ?? ""))),
);

writeFileSync(manifest, `${JSON.stringify(photos, null, 2)}\n`);
console.log(`content/gallery.json: ${photos.length} photos.`);
