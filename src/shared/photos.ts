/** Longest side of a photo's large copy, in pixels. */
export const LARGE_EDGE = 1600;
/** Width of the small copy, made only when the large copy is wider than this. */
export const SMALL_WIDTH = 800;
/** Upload limits per copy. A 1600 px WebP is usually 150–400 KB. */
export const MAX_LARGE_BYTES = 5 * 1024 * 1024;
export const MAX_SMALL_BYTES = 2 * 1024 * 1024;

/**
 * Storage limits, kept under R2's free 10 GB so the site can't run up a bill. Every photo counts
 * toward the total, the couple's included. The per-guest caps stop one guest's name (names
 * aren't secret) from filling the space or making a flood of tiny uploads.
 */
export const STORAGE_LIMIT_BYTES = 8 * 1024 ** 3;
export const GUEST_LIMIT_BYTES = 300 * 1024 ** 2;
export const GUEST_LIMIT_PHOTOS = 500;

export const PHOTO_TYPES = ["image/webp", "image/jpeg"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];

export interface Size {
  width: number;
  height: number;
}

/** Scales `size` down, keeping its shape, so neither side is over `maxWidth` × `maxHeight`. */
export function fitWithin(size: Size, maxWidth: number, maxHeight: number): Size {
  const scale = Math.min(1, maxWidth / size.width, maxHeight / size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** The sizes of a photo's large copy and, when it's wider than SMALL_WIDTH, its small copy. */
export function copySizes(original: Size): { large: Size; small: Size | null } {
  const large = fitWithin(original, LARGE_EDGE, LARGE_EDGE);
  const small = large.width > SMALL_WIDTH ? fitWithin(large, SMALL_WIDTH, Infinity) : null;
  return { large, small };
}

/** The image type the file's first bytes show, or null when it's neither WebP nor JPEG. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
