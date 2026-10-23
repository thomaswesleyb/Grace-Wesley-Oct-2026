import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import {
  GUEST_LIMIT_BYTES,
  GUEST_LIMIT_PHOTOS,
  MAX_LARGE_BYTES,
  STORAGE_LIMIT_BYTES,
} from "@shared/photos.ts";
import { adminPhotosResponse, photosResponse, photoUploadResult } from "@shared/schemas.ts";
import { call, resetDb, seedGuest } from "@worker/test-helpers.ts";

beforeEach(async () => {
  await resetDb();
  await seedGuest("sam", "Sam", "Lee", 2);
  await seedGuest("absent", "Dana", "Whitfield", 0);
  await seedGuest("kim", "Kim", "Moss", 1);
});

const asAdmin = { origin: "http://localhost:5173", env: { ADMIN_DEV_BYPASS: "1" } };
const noAccess = { env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } };

const ascii = (text: string) => [...text].map((ch) => ch.charCodeAt(0));
const webp = (tag = 0) => new Uint8Array([...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP"), tag]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

/** A valid upload of a 1600 × 1000 photo (so with a small copy); spread overrides on top. */
function photoForm(overrides: Record<string, string | Blob | null> = {}): FormData {
  const fields: Record<string, string | Blob | null> = {
    large: new File([webp(1)], "large.webp", { type: "image/webp" }),
    small: new File([webp(2)], "small.webp", { type: "image/webp" }),
    width: "1600",
    height: "1000",
    ...overrides,
  };
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) if (value !== null) form.set(name, value);
  return form;
}

const guestForm = (overrides: Record<string, string | Blob | null> = {}) =>
  photoForm({ firstName: "Sam", lastName: "Lee", ...overrides });

async function upload(overrides: Record<string, string | Blob | null> = {}) {
  const response = await call("/api/admin/photos", { ...asAdmin, body: photoForm(overrides) });
  expect(response.status).toBe(200);
  return photoUploadResult.parse(await response.json());
}

async function publicList() {
  return photosResponse.parse(await (await call("/api/photos")).json());
}

async function adminList() {
  return adminPhotosResponse.parse(await (await call("/api/admin/photos", asAdmin)).json());
}

async function openUploads(open = true) {
  const response = await call("/api/admin/photos/uploads", { ...asAdmin, body: { open } });
  expect(response.status).toBe(200);
}

const error = async (response: Response) => ((await response.json()) as { error: string }).error;

describe("admin photo routes", () => {
  it("fail closed without Cloudflare Access", async () => {
    expect((await call("/api/admin/photos", noAccess)).status).toBe(503);
    const posted = await call("/api/admin/photos", { ...noAccess, body: photoForm() });
    expect(posted.status).toBe(503);
    expect((await call("/api/admin/photos/x/large", noAccess)).status).toBe(503);
    const opened = await call("/api/admin/photos/uploads", { ...noAccess, body: { open: true } });
    expect(opened.status).toBe(503);
    expect(await publicList()).toMatchObject({ photos: [], uploadsOpen: false });
  });
});

describe("the couple's photos", () => {
  it("show on the Photos page as soon as they're uploaded, in upload order", async () => {
    const first = await upload({ alt: "The two of us at the chapel", caption: "Sewanee, 2024" });
    const second = await upload({ width: "600", height: "900", small: null });

    const { photos, guestPhotos } = await publicList();
    expect(guestPhotos).toEqual([]);
    expect(photos).toEqual([
      {
        id: first.id,
        alt: "The two of us at the chapel",
        caption: "Sewanee, 2024",
        credit: null,
        src: `/media/photos/${first.id}/large`,
        width: 1600,
        height: 1000,
        small: { src: `/media/photos/${first.id}/small`, width: 800 },
      },
      {
        id: second.id,
        alt: "Photo 2 of 2",
        caption: null,
        credit: null,
        src: `/media/photos/${second.id}/large`,
        width: 600,
        height: 900,
        small: { src: `/media/photos/${second.id}/large`, width: 600 },
      },
    ]);
  });

  it("are served from /media with their type and a cache header", async () => {
    const { id } = await upload({ small: new File([jpeg()], "small.jpg") });
    const large = await call(`/media/photos/${id}/large`);
    expect(large.status).toBe(200);
    expect(large.headers.get("content-type")).toBe("image/webp");
    expect(large.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(new Uint8Array(await large.arrayBuffer())).toEqual(webp(1));
    const small = await call(`/media/photos/${id}/small`);
    expect(small.headers.get("content-type")).toBe("image/jpeg");
    expect((await call(`/media/photos/${id}/medium`)).status).toBe(404);
    expect((await call("/media/photos/nope/large")).status).toBe(404);
  });

  it("reorder, ignoring unknown ids", async () => {
    const a = await upload();
    const b = await upload();
    const c = await upload();
    const reordered = await call("/api/admin/photos/order", {
      ...asAdmin,
      body: { ids: [c.id, "unknown", a.id, b.id] },
    });
    expect(reordered.status).toBe(200);
    expect((await publicList()).photos.map((p) => p.id)).toEqual([c.id, a.id, b.id]);
    const empty = await call("/api/admin/photos/order", { ...asAdmin, body: { ids: [] } });
    expect(empty.status).toBe(400);
  });

  it("edit only the fields sent, and an empty caption clears it", async () => {
    const { id } = await upload({ alt: "Old", caption: "Kept" });
    const patch = (body: unknown) =>
      call(`/api/admin/photos/${id}`, { ...asAdmin, method: "PATCH", body });

    expect((await patch({ alt: "New" })).status).toBe(200);
    expect((await publicList()).photos[0]).toMatchObject({ alt: "New", caption: "Kept" });
    expect((await patch({ caption: "" })).status).toBe(200);
    expect((await publicList()).photos[0]).toMatchObject({ alt: "New", caption: null });
    expect((await patch({ alt: "x".repeat(301) })).status).toBe(400);
    const missing = await call("/api/admin/photos/nope", {
      ...asAdmin,
      method: "PATCH",
      body: { alt: "x" },
    });
    expect(missing.status).toBe(404);
  });

  it("delete the row and both copies", async () => {
    const { id } = await upload();
    const remove = () => call(`/api/admin/photos/${id}`, { ...asAdmin, method: "DELETE" });
    expect((await remove()).status).toBe(200);
    expect((await publicList()).photos).toEqual([]);
    expect((await env.PHOTOS.list()).objects).toEqual([]);
    expect((await remove()).status).toBe(404);
  });
});

/** The couple's upload with `overrides` is refused with `message`, and nothing is stored. */
async function rejects(overrides: Record<string, string | Blob | null>, message: RegExp) {
  const response = await call("/api/admin/photos", { ...asAdmin, body: photoForm(overrides) });
  expect(response.status).toBe(400);
  expect(await error(response)).toMatch(message);
  expect((await env.PHOTOS.list()).objects).toEqual([]);
}

describe("upload checks", () => {
  it("refuse a file that isn't WebP or JPEG, whatever its declared type", async () => {
    const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "a.webp", {
      type: "image/webp",
    });
    await rejects({ large: png }, /isn't a WebP or JPEG/);
    await rejects({ small: new File(["<svg/>"], "s.webp", { type: "image/webp" }) }, /small/);
  });

  it("refuse a missing or oversized large copy", async () => {
    await rejects({ large: null }, /large photo file is missing/);
    await rejects({ large: "not a file" }, /large photo file is missing/);
    const huge = new File([webp(), new Uint8Array(MAX_LARGE_BYTES)], "big.webp");
    await rejects({ large: huge }, /over 5 MB/);
  });

  it("require a small copy exactly when the photo is wider than 800 px", async () => {
    await rejects({ small: null }, /small copy/);
    await rejects({ width: "800", height: "600" }, /small copy/);
  });

  it("refuse sizes over 1600 px or that aren't numbers", async () => {
    await rejects({ width: "1601" }, /details/);
    await rejects({ height: "0" }, /details/);
    await rejects({ width: "wide" }, /details/);
  });

  it("refuse a JSON body", async () => {
    const response = await call("/api/admin/photos", { ...asAdmin, body: { width: 10 } });
    expect(response.status).toBe(400);
  });
});

describe("guests' photos", () => {
  it("can't be uploaded until the couple opens uploads", async () => {
    const closed = await call("/api/photos", { body: guestForm() });
    expect(closed.status).toBe(403);
    expect(await error(closed)).toMatch(/isn't open/);

    await openUploads();
    expect((await publicList()).uploadsOpen).toBe(true);
    expect((await call("/api/photos", { body: guestForm() })).status).toBe(200);

    await openUploads(false);
    expect((await call("/api/photos", { body: guestForm() })).status).toBe(403);
  });

  it("give a stranger and a guest with no places the same reply", async () => {
    await openUploads();
    const stranger = await call("/api/photos", {
      body: guestForm({ firstName: "Pat", lastName: "Nobody" }),
    });
    const absent = await call("/api/photos", {
      body: guestForm({ firstName: "Dana", lastName: "Whitfield" }),
    });
    expect(stranger.status).toBe(403);
    expect(absent.status).toBe(403);
    expect(await error(stranger)).toBe(await error(absent));
    const nameless = await call("/api/photos", { body: guestForm({ firstName: "" }) });
    expect(nameless.status).toBe(400);
    expect((await env.PHOTOS.list()).objects).toEqual([]);
  });

  it("wait for approval and aren't served publicly until then", async () => {
    await openUploads();
    const response = await call("/api/photos", {
      body: guestForm({ firstName: "sam", lastName: "lee", caption: "The first dance" }),
    });
    const { id, status } = photoUploadResult.parse(await response.json());
    expect(status).toBe("pending");

    expect((await publicList()).guestPhotos).toEqual([]);
    expect((await call(`/media/photos/${id}/large`)).status).toBe(404);

    const [pending] = (await adminList()).photos;
    expect(pending).toMatchObject({
      id,
      source: "guest",
      status: "pending",
      altText: "",
      credit: "Sam Lee",
      src: `/api/admin/photos/${id}/large`,
    });
    const preview = await call(`/api/admin/photos/${id}/small`, asAdmin);
    expect(preview.status).toBe(200);
    expect(preview.headers.get("cache-control")).toBe("no-store");

    const approve = await call(`/api/admin/photos/${id}`, {
      ...asAdmin,
      method: "PATCH",
      body: { status: "approved" },
    });
    expect(approve.status).toBe(200);
    const { photos, guestPhotos } = await publicList();
    expect(photos).toEqual([]);
    expect(guestPhotos).toMatchObject([
      {
        id,
        alt: "A photo shared by Sam Lee",
        caption: "The first dance",
        credit: "Sam Lee",
        src: `/media/photos/${id}/large`,
      },
    ]);
    expect((await call(`/media/photos/${id}/large`)).status).toBe(200);
  });

  it("come after the couple's photos in admin, and reordering doesn't move them", async () => {
    await openUploads();
    const guest = photoUploadResult.parse(
      await (await call("/api/photos", { body: guestForm() })).json(),
    );
    const couple = await upload();
    await call("/api/admin/photos/order", { ...asAdmin, body: { ids: [guest.id, couple.id] } });
    expect((await adminList()).photos.map((p) => p.id)).toEqual([couple.id, guest.id]);
  });

  it("refuse a bad uploads setting", async () => {
    const response = await call("/api/admin/photos/uploads", { ...asAdmin, body: { open: "yes" } });
    expect(response.status).toBe(400);
  });
});

/** Stored photo rows (no files) taking up `bytes` in all, for `guestId` or the couple. */
async function seedUsage(bytes: number, guestId: string | null = null, count = 1) {
  const rows = Array.from({ length: count }, () =>
    env.DB.prepare(
      `INSERT INTO photos (id, source, status, guest_id, width, height, has_small, bytes, created_at)
       VALUES (?, ?, 'approved', ?, 10, 10, 0, ?, '2026-10-24T00:00:00Z')`,
    ).bind(
      crypto.randomUUID(),
      guestId === null ? "couple" : "guest",
      guestId,
      Math.max(1, Math.floor(bytes / count)),
    ),
  );
  await env.DB.batch(rows);
}

const guestUpload = (overrides: Record<string, string | Blob | null> = {}) =>
  call("/api/photos", { body: guestForm(overrides) });

describe("storage limits", () => {
  it("count both copies of every photo, and admin shows the total", async () => {
    await upload();
    await upload({ width: "600", height: "900", small: null });
    const { storage } = await adminList();
    expect(storage).toEqual({ usedBytes: 3 * webp().byteLength, limitBytes: STORAGE_LIMIT_BYTES });
  });

  it("refuse any upload once the total would pass the limit, storing nothing", async () => {
    await openUploads();
    await seedUsage(STORAGE_LIMIT_BYTES - 5);

    const couple = await call("/api/admin/photos", { ...asAdmin, body: photoForm() });
    expect(couple.status).toBe(507);
    expect(await error(couple)).toMatch(/storage is full/);
    const guest = await guestUpload();
    expect(guest.status).toBe(507);
    expect(await error(guest)).toMatch(/album is full/);

    expect((await env.PHOTOS.list()).objects).toEqual([]);
    expect((await adminList()).photos).toHaveLength(1);
  });

  it("cap each guest's bytes, without stopping other guests", async () => {
    await openUploads();
    await seedUsage(GUEST_LIMIT_BYTES - 5, "sam");
    const sam = await guestUpload();
    expect(sam.status).toBe(507);
    expect(await error(sam)).toMatch(/as many photos as we have room for/);
    expect((await env.PHOTOS.list()).objects).toEqual([]);

    expect((await guestUpload({ firstName: "Kim", lastName: "Moss" })).status).toBe(200);
  });

  it("cap each guest's number of photos, however small", async () => {
    await openUploads();
    await seedUsage(GUEST_LIMIT_PHOTOS - 1, "sam", GUEST_LIMIT_PHOTOS - 1);
    expect((await guestUpload()).status).toBe(200);
    expect((await guestUpload()).status).toBe(507);
  });

  it("free a guest's space when the couple deletes one of their photos", async () => {
    await openUploads();
    await seedUsage(GUEST_LIMIT_BYTES - 30, "sam");
    const first = photoUploadResult.parse(await (await guestUpload()).json());
    expect((await guestUpload()).status).toBe(507);
    await call(`/api/admin/photos/${first.id}`, { ...asAdmin, method: "DELETE" });
    expect((await guestUpload()).status).toBe(200);
  });
});
