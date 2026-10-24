export const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic"] as const;

export function isPhoto(file: string): boolean {
  const lower = file.toLowerCase();
  return PHOTO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function stem(file: string): string {
  return file.replace(/\.[^.]+$/, "");
}

/** Natural order, so "photo-6" comes before "photo-15", ignoring letter case. */
export const byName = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

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
