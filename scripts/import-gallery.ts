import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { galleryPhoto } from "@shared/schemas.ts";
import { sql } from "./sql.ts";

/**
 * One-time move of the photos built into the site (content/gallery.json and its WebP copies in
 * public/photos/gallery/) into the PHOTOS bucket and the photos table, in the same order.
 * Refuses to run when the photos table already has photos, so it can't import twice.
 */
const USAGE = "Usage: pnpm photos:import (--local | --remote)";
const { values } = parseArgs({
  options: {
    local: { type: "boolean", default: false },
    remote: { type: "boolean", default: false },
  },
});
if (values.local === values.remote) throw new Error(USAGE);
const target = values.local ? "--local" : "--remote";

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args, target], { cwd: root, encoding: "utf8" });

/** The old gallery's shape: a galleryPhoto before photos had ids or credits. */
const oldPhotos = galleryPhoto
  .omit({ id: true, credit: true })
  .array()
  .parse(JSON.parse(readFileSync(`${root}content/gallery.json`, "utf8")));

const [countResult] = JSON.parse(
  wrangler("d1", "execute", "wedding", "--json", "--command", "SELECT COUNT(*) AS n FROM photos"),
) as { results: { n: number }[] }[];
const existing = countResult?.results[0]?.n ?? 0;
if (existing > 0) {
  throw new Error(
    `The ${target.slice(2)} photos table already has ${existing} photos, so nothing was imported. ` +
      "Delete them from /admin/photos first if you really want to import again.",
  );
}

const fileOf = (src: string) => `${root}public${src}`;
const put = (key: string, src: string) =>
  wrangler(
    "r2",
    "object",
    "put",
    `wedding-photos/${key}`,
    "--file",
    fileOf(src),
    "--content-type",
    "image/webp",
  );

const createdAt = new Date().toISOString();
const rows = oldPhotos.map((photo, sort) => {
  const id = crypto.randomUUID();
  const hasSmall = photo.small.src !== photo.src;
  put(`${id}/large`, photo.src);
  if (hasSmall) put(`${id}/small`, photo.small.src);
  console.log(`Uploaded ${sort + 1} of ${oldPhotos.length}: ${photo.src}`);
  const alt = /^Photo \d+ of \d+$/.test(photo.alt) ? "" : photo.alt;
  const bytes =
    statSync(fileOf(photo.src)).size + (hasSmall ? statSync(fileOf(photo.small.src)).size : 0);
  return `(${[id, "couple", "approved", alt, photo.caption, photo.width, photo.height, hasSmall ? 1 : 0, bytes, sort, createdAt].map(sql).join(", ")})`;
});

mkdirSync(`${root}.wrangler`, { recursive: true });
const sqlPath = `${root}.wrangler/import-gallery.sql`;
writeFileSync(
  sqlPath,
  `INSERT INTO photos (id, source, status, alt, caption, width, height, has_small, bytes, sort, created_at)
VALUES ${rows.join(",\n")};\n`,
);
try {
  wrangler("d1", "execute", "wedding", "--file", sqlPath);
} finally {
  rmSync(sqlPath);
}
console.log(`Imported ${rows.length} photos into the ${target.slice(2)} bucket and database.`);
