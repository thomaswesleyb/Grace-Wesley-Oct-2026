import { parseCsv } from "./csv.ts";
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

export interface GalleryPlan {
  photos: PlannedPhoto[];
  /** Captions rows that name a photo no longer in images/. They're skipped, not fatal. */
  warnings: string[];
}

type CaptionRow = ReturnType<typeof readCaptionRows>[number];

/** Natural order, so "photo-6" comes before "photo-15", ignoring letter case. */
export const byName = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

function describedPhotos(photos: string[], rows: CaptionRow[], warnings: string[]) {
  const described = new Map<string, CaptionRow>();
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const line = index + 2;
    if (seen.has(row.file)) {
      throw new Error(`${CAPTIONS_FILE} line ${line}: "${row.file}" is listed twice.`);
    }
    seen.add(row.file);
    if (photos.includes(row.file)) described.set(row.file, row);
    else warnings.push(`${CAPTIONS_FILE} line ${line}: no photo named "${row.file}"; skipped.`);
  });
  return described;
}

export function uniqueSlugs(files: string[]): string[] {
  const owners = new Map<string, string>();
  return files.map((file) => {
    const slug = slugify(stem(file)) || "photo";
    const clash = owners.get(slug);
    if (clash !== undefined) {
      throw new Error(`"${file}" and "${clash}" need different names (both become "${slug}").`);
    }
    owners.set(slug, file);
    return slug;
  });
}

/**
 * Lists every photo in images/. Photos with a row in the optional captions.csv come first, in
 * the CSV's order, with its caption and alt text. The rest follow by file name, described
 * generically as "Photo N of M".
 */
export function planGallery(files: string[], captionsCsv: string | null): GalleryPlan {
  const photos = files.filter(isPhoto);
  const warnings: string[] = [];
  const rows = captionsCsv === null ? [] : readCaptionRows(captionsCsv);
  const described = describedPhotos(photos, rows, warnings);
  const ordered = [
    ...described.keys(),
    ...photos.filter((f) => !described.has(f)).toSorted(byName),
  ];
  const slugs = uniqueSlugs(ordered);
  const planned = ordered.map((file, index) => {
    const row = described.get(file);
    return {
      file,
      slug: slugs[index]!,
      alt: row?.alt || `Photo ${index + 1} of ${ordered.length}`,
      caption: row?.caption || null,
    };
  });
  return { photos: planned, warnings };
}
