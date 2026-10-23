import { byName, isPhoto, uniqueSlugs } from "./gallery.ts";

export interface PlannedBackdrop {
  /** File name in background-images/. */
  file: string;
  /** Base name for the generated copy in public/photos/backdrops/. */
  slug: string;
}

/** Every photo in background-images/, in natural file-name order. */
export function planBackdrops(files: string[]): PlannedBackdrop[] {
  const photos = files.filter(isPhoto).toSorted(byName);
  const slugs = uniqueSlugs(photos);
  return photos.map((file, index) => ({ file, slug: slugs[index]! }));
}
