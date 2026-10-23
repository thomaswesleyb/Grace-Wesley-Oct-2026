import { Hono, type Context } from "hono";
import type { z } from "zod";
import { matchGuest, typedKeys } from "@shared/names.ts";
import {
  GUEST_LIMIT_BYTES,
  GUEST_LIMIT_PHOTOS,
  MAX_LARGE_BYTES,
  MAX_SMALL_BYTES,
  SMALL_WIDTH,
  STORAGE_LIMIT_BYTES,
  sniffPhotoType,
  type PhotoType,
} from "@shared/photos.ts";
import {
  guestPhotoUploadFields,
  photoEdit,
  photoOrder,
  photoUploadFields,
  photoUploadsSetting,
  type AdminPhoto,
  type AdminPhotosResponse,
  type GalleryPhoto,
  type PhotosResponse,
} from "@shared/schemas.ts";
import { requireAccess } from "@worker/admin.ts";
import {
  deletePhoto,
  getGuest,
  getPhoto,
  getSetting,
  insertPhoto,
  listPhotos,
  nameCandidates,
  photoUsage,
  reorderPhotos,
  setSetting,
  updatePhoto,
  type PhotoRow,
} from "@worker/db.ts";
import type { Env } from "@worker/env.ts";

type AppContext = Context<{ Bindings: Env }>;

const COPIES = ["large", "small"] as const;
type Copy = (typeof COPIES)[number];
const isCopy = (value: string): value is Copy => (COPIES as readonly string[]).includes(value);

const objectKey = (id: string, copy: Copy) => `${id}/${copy}`;

const UPLOADS_SETTING = "photo_uploads_open";
const uploadsOpen = async (db: D1Database) => (await getSetting(db, UPLOADS_SETTING)) === "1";

function describe(row: PhotoRow, index: number, total: number): string {
  if (row.alt !== "") return row.alt;
  if (row.credit !== null) return `A photo shared by ${row.credit}`;
  return `Photo ${index + 1} of ${total}`;
}

/** `base` is where the copies are served: /media/photos publicly, the admin API for pending. */
function toGalleryPhoto(row: PhotoRow, index: number, total: number, base: string): GalleryPhoto {
  const src = `${base}/${row.id}/large`;
  return {
    id: row.id,
    alt: describe(row, index, total),
    caption: row.caption,
    credit: row.credit,
    src,
    width: row.width,
    height: row.height,
    small:
      row.has_small === 1
        ? { src: `${base}/${row.id}/small`, width: SMALL_WIDTH }
        : { src, width: row.width },
  };
}

const toGallery = (rows: PhotoRow[], base: string) =>
  rows.map((row, index) => toGalleryPhoto(row, index, rows.length, base));

interface PhotoFile {
  bytes: ArrayBuffer;
  type: PhotoType;
}

type Upload<T> =
  | { ok: true; fields: T; large: PhotoFile; small: PhotoFile | null }
  | { ok: false; error: string };

async function readPhotoFile(
  value: unknown,
  label: string,
  maxBytes: number,
): Promise<PhotoFile | string> {
  if (!(value instanceof File)) return `The ${label} photo file is missing.`;
  if (value.size > maxBytes) {
    return `The ${label} photo is over ${maxBytes / 1024 / 1024} MB. Please try a smaller photo.`;
  }
  const bytes = await value.arrayBuffer();
  const type = sniffPhotoType(new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength)));
  return type === null ? `The ${label} photo isn't a WebP or JPEG image.` : { bytes, type };
}

/**
 * Reads a multipart upload: a `large` copy, a `small` copy exactly when the large one is wider
 * than SMALL_WIDTH, and the text fields `schema` describes.
 */
async function readUpload<S extends z.ZodType<{ width: number }>>(
  c: AppContext,
  schema: S,
): Promise<Upload<z.output<S>>> {
  const body = await c.req.parseBody().catch(() => null);
  if (body === null) return { ok: false, error: "Please send the photo as a form upload." };
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Some photo details are missing or too long." };

  const large = await readPhotoFile(body["large"], "large", MAX_LARGE_BYTES);
  if (typeof large === "string") return { ok: false, error: large };
  const needsSmall = parsed.data.width > SMALL_WIDTH;
  if (needsSmall !== body["small"] instanceof File) {
    return {
      ok: false,
      error: `Send a small copy exactly when the photo is wider than ${SMALL_WIDTH} px.`,
    };
  }
  const small = needsSmall ? await readPhotoFile(body["small"], "small", MAX_SMALL_BYTES) : null;
  if (typeof small === "string") return { ok: false, error: small };
  return { ok: true, fields: parsed.data, large, small };
}

const LIMITS = {
  totalBytes: STORAGE_LIMIT_BYTES,
  guestBytes: GUEST_LIMIT_BYTES,
  guestPhotos: GUEST_LIMIT_PHOTOS,
};

type Stored = "stored" | "full" | "guest-full";

/**
 * Saves the row first, which reserves its space under the storage limits, then both copies to
 * R2. A photo over a limit is refused before anything reaches R2. Removes the row if R2 fails.
 */
async function storePhoto(
  env: Env,
  photo: Omit<PhotoRow, "bytes">,
  large: PhotoFile,
  small: PhotoFile | null,
): Promise<Stored> {
  const copies: [Copy, PhotoFile][] = [["large", large]];
  if (small !== null) copies.push(["small", small]);
  const bytes = copies.reduce((sum, [, file]) => sum + file.bytes.byteLength, 0);
  if (!(await insertPhoto(env.DB, { ...photo, bytes }, LIMITS))) {
    const usage = await photoUsage(env.DB, photo.guest_id);
    return usage.totalBytes + bytes > STORAGE_LIMIT_BYTES ? "full" : "guest-full";
  }
  try {
    await Promise.all(
      copies.map(([copy, file]) =>
        env.PHOTOS.put(objectKey(photo.id, copy), file.bytes, {
          httpMetadata: { contentType: file.type },
        }),
      ),
    );
  } catch (error) {
    await deletePhoto(env.DB, photo.id);
    await env.PHOTOS.delete(copies.map(([copy]) => objectKey(photo.id, copy)));
    throw error;
  }
  return "stored";
}

async function servePhoto(c: AppContext, id: string, copy: string, cacheControl: string) {
  if (!isCopy(copy)) return c.json({ error: "Not found." }, 404);
  const object = await c.env.PHOTOS.get(objectKey(id, copy));
  if (object === null) return c.json({ error: "Not found." }, 404);
  const headers = new Headers({
    "Cache-Control": cacheControl,
    "X-Content-Type-Options": "nosniff",
    ETag: object.httpEtag,
  });
  object.writeHttpMetadata(headers);
  return new Response(object.body, { headers });
}

/** Public photo files, at /media/photos/<id>/(large|small). Only approved photos are served. */
export const media = new Hono<{ Bindings: Env }>();

media.get("/photos/:id/:copy", async (c) => {
  const photo = await getPhoto(c.env.DB, c.req.param("id"));
  if (photo === null || photo.status !== "approved") return c.json({ error: "Not found." }, 404);
  return servePhoto(c, photo.id, c.req.param("copy"), "public, max-age=604800");
});

/** The Photos page's list, and guests' uploads at /api/photos. */
export const photos = new Hono<{ Bindings: Env }>();

photos.get("/", async (c) => {
  const [approved, open] = await Promise.all([
    listPhotos(c.env.DB, "approved"),
    uploadsOpen(c.env.DB),
  ]);
  return c.json({
    photos: toGallery(
      approved.filter((p) => p.source === "couple"),
      "/media/photos",
    ),
    guestPhotos: toGallery(
      approved.filter((p) => p.source === "guest"),
      "/media/photos",
    ),
    uploadsOpen: open,
  } satisfies PhotosResponse);
});

/** The same reply for a stranger, an ambiguous name, and a guest with no places. */
const NOT_ON_LIST =
  "We couldn't find that name on our guest list. Please enter it as it's written on your invitation.";

/** The guest a typed name belongs to, or null for a stranger, an ambiguous name or 0 places. */
async function findUploader(db: D1Database, firstName: string, lastName: string) {
  const match = matchGuest(typedKeys(firstName, lastName), await nameCandidates(db));
  const guest = match === null ? null : await getGuest(db, match.guestId);
  return guest === null || guest.spots === 0 ? null : guest;
}

const GUEST_REFUSED = {
  "guest-full": "You've shared as many photos as we have room for from one guest. Thank you!",
  full: "Our photo album is full, so we can't take more photos right now. Thank you!",
};

photos.post("/", async (c) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  if (!(await c.env.PHOTO_LIMITER.limit({ key: ip })).success) {
    return c.json(
      { error: "That's a lot of photos at once! Please wait a minute and go on." },
      429,
    );
  }
  if (!(await uploadsOpen(c.env.DB))) {
    return c.json({ error: "Photo sharing isn't open right now." }, 403);
  }
  const upload = await readUpload(c, guestPhotoUploadFields);
  if (!upload.ok) return c.json({ error: upload.error }, 400);

  const { fields } = upload;
  const guest = await findUploader(c.env.DB, fields.firstName, fields.lastName);
  if (guest === null) return c.json({ error: NOT_ON_LIST }, 403);

  const row: Omit<PhotoRow, "bytes"> = {
    id: crypto.randomUUID(),
    source: "guest",
    status: "pending",
    guest_id: guest.id,
    credit: `${guest.first_name} ${guest.last_name}`,
    alt: fields.alt,
    caption: fields.caption,
    width: fields.width,
    height: fields.height,
    has_small: upload.small === null ? 0 : 1,
    created_at: new Date().toISOString(),
  };
  const stored = await storePhoto(c.env, row, upload.large, upload.small);
  if (stored !== "stored") {
    console.warn(`Guest ${guest.id}'s upload refused: ${stored}.`);
    return c.json({ error: GUEST_REFUSED[stored] }, 507);
  }
  console.log(`Guest ${guest.id} uploaded photo ${row.id}; waiting for approval.`);
  return c.json({ id: row.id, status: row.status });
});

/** Managing photos at /api/admin/photos, behind Cloudflare Access. */
export const adminPhotos = new Hono<{ Bindings: Env }>();
adminPhotos.use("*", requireAccess);

/** Pending photos are previewed through the admin API, since /media won't serve them. */
const toAdminPhoto = (row: PhotoRow, index: number, total: number): AdminPhoto => ({
  ...toGalleryPhoto(
    row,
    index,
    total,
    row.status === "approved" ? "/media/photos" : "/api/admin/photos",
  ),
  altText: row.alt,
  source: row.source,
  status: row.status,
  createdAt: row.created_at,
});

function toAdminPhotos(rows: PhotoRow[]): AdminPhoto[] {
  const couple = rows.filter((r) => r.source === "couple");
  const guests = rows.filter((r) => r.source === "guest");
  return [
    ...couple.map((row, i) => toAdminPhoto(row, i, couple.length)),
    ...guests.map((row, i) => toAdminPhoto(row, i, guests.length)),
  ];
}

adminPhotos.get("/", async (c) => {
  const [rows, open, usage] = await Promise.all([
    listPhotos(c.env.DB),
    uploadsOpen(c.env.DB),
    photoUsage(c.env.DB, null),
  ]);
  return c.json({
    photos: toAdminPhotos(rows),
    uploadsOpen: open,
    storage: { usedBytes: usage.totalBytes, limitBytes: STORAGE_LIMIT_BYTES },
  } satisfies AdminPhotosResponse);
});

adminPhotos.post("/", async (c) => {
  const upload = await readUpload(c, photoUploadFields);
  if (!upload.ok) return c.json({ error: upload.error }, 400);
  const row: Omit<PhotoRow, "bytes"> = {
    id: crypto.randomUUID(),
    source: "couple",
    status: "approved",
    guest_id: null,
    credit: null,
    alt: upload.fields.alt,
    caption: upload.fields.caption,
    width: upload.fields.width,
    height: upload.fields.height,
    has_small: upload.small === null ? 0 : 1,
    created_at: new Date().toISOString(),
  };
  if ((await storePhoto(c.env, row, upload.large, upload.small)) !== "stored") {
    const limit = STORAGE_LIMIT_BYTES / 1024 ** 3;
    return c.json({ error: `Photo storage is full (${limit} GB). Delete some to make room.` }, 507);
  }
  return c.json({ id: row.id, status: row.status });
});

adminPhotos.post("/order", async (c) => {
  const parsed = photoOrder.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Send the photo ids in their new order." }, 400);
  await reorderPhotos(c.env.DB, parsed.data.ids);
  return c.json({ ok: true as const });
});

adminPhotos.post("/uploads", async (c) => {
  const parsed = photoUploadsSetting.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: 'Send { "open": true } or { "open": false }.' }, 400);
  await setSetting(c.env.DB, UPLOADS_SETTING, parsed.data.open ? "1" : "0");
  console.log(`Admin ${parsed.data.open ? "opened" : "closed"} guest photo uploads.`);
  return c.json({ ok: true as const });
});

adminPhotos.patch("/:id", async (c) => {
  const parsed = photoEdit.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "The alt text or caption is too long." }, 400);
  if (!(await updatePhoto(c.env.DB, c.req.param("id"), parsed.data))) {
    return c.json({ error: "That photo doesn't exist. It may have been deleted." }, 404);
  }
  return c.json({ ok: true as const });
});

adminPhotos.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await deletePhoto(c.env.DB, id))) {
    return c.json({ error: "That photo doesn't exist. It may already be deleted." }, 404);
  }
  await c.env.PHOTOS.delete(COPIES.map((copy) => objectKey(id, copy)));
  console.log(`Admin deleted photo ${id}.`);
  return c.json({ ok: true as const });
});

/** Any photo's copies, pending ones included, for previews on /admin/photos. */
adminPhotos.get("/:id/:copy", (c) =>
  servePhoto(c, c.req.param("id"), c.req.param("copy"), "private, no-store"),
);
