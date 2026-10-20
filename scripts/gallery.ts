import { parseCsv } from "./guests.ts";
import { slugify } from "./registry.ts";

export const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"] as const;
export const CAPTIONS_FILE = "captions.csv";

export interface PlannedPhoto {
  /** File name in images/. */
  file: string;
  /** Base name for the generated copies in public/photos/gallery/. */
  slug: string;
  alt: string;
  caption: string | null;
}

export function isPhoto(file: string): boolean {
  const lower = file.toLowerCase();
  return PHOTO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function stem(file: string): string {
  return file.replace(/\.[^.]+$/, "");
}

function readCaptionRows(csv: string): { file: string; alt: string; caption: string }[] {
  const [header, ...rows] = parseCsv(csv);
  const columns = header?.map((h) => h.trim().toLowerCase()) ?? [];
  for (const required of ["file", "alt"]) {
    if (!columns.includes(required)) {
      throw new Error(
        `${CAPTIONS_FILE} is missing the "${required}" column. Expected: file,caption,alt`,
      );
    }
  }
  const col = (row: string[], name: string) => (row[columns.indexOf(name)] ?? "").trim();
  return rows.map((row) => ({
    file: col(row, "file"),
    alt: col(row, "alt"),
    caption: columns.includes("caption") ? col(row, "caption") : "",
  }));
}

/**
 * Pairs the photos in images/ with their rows in captions.csv, in the CSV's order.
 * Every photo needs a row with alt text, so nothing reaches the page undescribed.
 */
export function planGallery(files: string[], captionsCsv: string | null): PlannedPhoto[] {
  const photos = files.filter(isPhoto);
  if (photos.length === 0 && captionsCsv === null) return [];
  if (captionsCsv === null) {
    throw new Error(
      `images/ has photos but no ${CAPTIONS_FILE}. Add one with the columns file,caption,alt and a row for each photo.`,
    );
  }
  const planned: PlannedPhoto[] = [];
  const slugs = new Map<string, string>();
  readCaptionRows(captionsCsv).forEach((row, index) => {
    const line = index + 2;
    if (!photos.includes(row.file)) {
      throw new Error(`${CAPTIONS_FILE} line ${line}: no photo named "${row.file}".`);
    }
    if (planned.some((p) => p.file === row.file)) {
      throw new Error(`${CAPTIONS_FILE} line ${line}: "${row.file}" is listed twice.`);
    }
    if (row.alt === "") {
      throw new Error(
        `${CAPTIONS_FILE} line ${line}: "${row.file}" needs alt text (a short description of the photo).`,
      );
    }
    const slug = slugify(stem(row.file)) || "photo";
    const clash = slugs.get(slug);
    if (clash !== undefined) {
      throw new Error(`"${row.file}" and "${clash}" need different names (both become "${slug}").`);
    }
    slugs.set(slug, row.file);
    planned.push({ file: row.file, slug, alt: row.alt, caption: row.caption || null });
  });
  const unlisted = photos.filter((file) => !planned.some((p) => p.file === file));
  if (unlisted.length > 0) {
    throw new Error(`Add a row with alt text to ${CAPTIONS_FILE} for: ${unlisted.join(", ")}.`);
  }
  return planned;
}
