import { apiFetch, ApiRequestError } from "@client/api.ts";
import { copySizes, fitWithin, type Size } from "@shared/photos.ts";
import { photoUploadResult } from "@shared/schemas.ts";

/** Browsers that can't encode WebP (Safari) fall back to JPEG. */
const QUALITY = { webp: 0.82, jpeg: 0.85 };

/** Image files by type, plus iPhone HEIC files that some browsers report with no type. */
export const isImageFile = (file: File) =>
  file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);

async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`"${file.name}" couldn't be opened here. Please try a JPEG or PNG copy.`);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Redraws the photo at `size`, which also drops its metadata (GPS location included). */
async function encode(bitmap: ImageBitmap, size: Size): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("This browser can't resize photos.");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  const webp = await toBlob(canvas, "image/webp", QUALITY.webp);
  if (webp?.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", QUALITY.jpeg);
  if (jpeg === null) throw new Error("This browser couldn't save the resized photo.");
  return jpeg;
}

/** The upload form for one photo: its resized copies plus `fields`. */
export async function photoForm(file: File, fields: Record<string, string>): Promise<FormData> {
  const bitmap = await decode(file);
  try {
    const { large, small } = copySizes({ width: bitmap.width, height: bitmap.height });
    const form = new FormData();
    form.set("large", await encode(bitmap, large));
    if (small !== null) form.set("small", await encode(bitmap, small));
    form.set("width", String(large.width));
    form.set("height", String(large.height));
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    return form;
  } finally {
    bitmap.close();
  }
}

/** One copy of an image, no side longer than `maxEdge`, ready to upload. */
export async function resizedImage(file: File, maxEdge: number): Promise<Blob> {
  const bitmap = await decode(file);
  try {
    return await encode(bitmap, fitWithin(bitmap, maxEdge, maxEdge));
  } finally {
    bitmap.close();
  }
}

export interface UploadProgress {
  done: number;
  total: number;
  /** One line per photo that didn't upload, naming the file. */
  failed: string[];
  /** Set when uploading stopped early, e.g. the name isn't on the guest list. */
  stopped: string | null;
}

/** Errors that would fail every later photo too, so uploading stops at the first one. */
const STOPS_ALL = new Set([0, 401, 403, 429, 503, 507]);

/** Resizes and uploads `files` one at a time to `path`, reporting progress after each. */
export async function uploadPhotos(
  files: File[],
  path: string,
  fields: Record<string, string>,
  onProgress: (progress: UploadProgress) => void,
): Promise<UploadProgress> {
  const progress: UploadProgress = { done: 0, total: files.length, failed: [], stopped: null };
  onProgress({ ...progress });
  for (const file of files) {
    try {
      // One at a time on purpose: each decoded photo can take ~50 MB of memory on a phone, and
      // the guest upload route is rate-limited per minute.
      // oxlint-disable-next-line no-await-in-loop
      const body = await photoForm(file, fields);
      // oxlint-disable-next-line no-await-in-loop
      await apiFetch(path, photoUploadResult, { method: "POST", body });
      progress.done += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "It couldn't be uploaded.";
      if (error instanceof ApiRequestError && STOPS_ALL.has(error.status)) {
        progress.stopped = message;
        onProgress({ ...progress });
        break;
      }
      progress.failed.push(`${file.name}: ${message}`);
    }
    onProgress({ ...progress, failed: [...progress.failed] });
  }
  return progress;
}
