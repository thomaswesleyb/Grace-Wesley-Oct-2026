import { z } from "zod";
import { TOPICS } from "@content/qa.ts";
import { LARGE_EDGE } from "@shared/photos.ts";
import { MAX_PRICE_CENTS } from "@shared/registry.ts";

const personName = z.string().trim().min(1).max(60);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null);

/** Most people one RSVP form can answer for. */
export const MAX_PARTY = 6;

export const okResponse = z.object({ ok: z.literal(true) });

export const lookupRequest = z.object({ firstName: personName, lastName: personName });

/** The guest a looked-up name belongs to, with their name as it's written on the guest list. */
export const listedGuest = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  /** Most people this guest's RSVP can include, themselves included. */
  spots: z.number().int().min(1).max(MAX_PARTY),
});
export type ListedGuest = z.infer<typeof listedGuest>;

export const lookupResponse = z.discriminatedUnion("found", [
  z.object({ found: z.literal(false) }),
  z.object({
    found: z.literal(true),
    guest: listedGuest,
    /**
     * False when the name only matched through a typo or nickname, so the page asks
     * "Did you mean …?" before going on.
     */
    exact: z.boolean(),
    /** True when this guest already has an RSVP; a new one replaces it. */
    answered: z.boolean(),
  }),
]);
export type LookupResponse = z.infer<typeof lookupResponse>;

export const rsvpPerson = z.object({
  firstName: personName,
  lastName: personName,
  attending: z.boolean(),
  dietary: optionalText(200),
});

export const rsvpSubmission = z.object({
  guestId: z.string().min(1).max(64),
  /** The listed guest first, then anyone else they're answering for. */
  people: z.array(rsvpPerson).min(1).max(MAX_PARTY),
  email: z.email().max(254),
  songRequest: optionalText(200),
  note: optionalText(1000),
});
export type RsvpSubmission = z.input<typeof rsvpSubmission>;
export type ParsedRsvpSubmission = z.output<typeof rsvpSubmission>;

export const rsvpResult = z.object({
  attending: z.number().int(),
  declining: z.number().int(),
});
export type RsvpResult = z.infer<typeof rsvpResult>;

export const apiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof apiError>;

export const adminRsvp = z.object({
  id: z.string(),
  /** Null for RSVPs sent with the old shared code, before the guest list. */
  guestId: z.string().nullable(),
  createdAt: z.string(),
  /** When a newer RSVP from the same guest replaced this one; null while it's current. */
  replacedAt: z.string().nullable(),
  email: z.string(),
  songRequest: z.string().nullable(),
  note: z.string().nullable(),
  people: z.array(
    z.object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      attending: z.boolean(),
      dietary: z.string().nullable(),
    }),
  ),
});
export type AdminRsvp = z.infer<typeof adminRsvp>;

export const adminContribution = z.object({
  id: z.string(),
  itemName: z.string(),
  amountCents: z.number().int(),
  name: z.string(),
  note: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
});
export type AdminContribution = z.infer<typeof adminContribution>;

export const adminGuest = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  spots: z.number().int(),
  /** When their current RSVP arrived; null if they haven't answered. */
  answeredAt: z.string().nullable(),
  /** People attending on their current RSVP; null if they haven't answered. */
  attending: z.number().int().nullable(),
});
export type AdminGuest = z.infer<typeof adminGuest>;

export const adminSummary = z.object({
  /** Replaced RSVPs are left out of every total. */
  totals: z.object({
    places: z.number().int(),
    rsvps: z.number().int(),
    attending: z.number().int(),
    declining: z.number().int(),
    notAnswered: z.number().int(),
  }),
  /** In guest-list order. */
  guests: z.array(adminGuest),
  /** Newest first, replaced ones included. */
  rsvps: z.array(adminRsvp),
  gifts: z.array(adminContribution),
});
export type AdminSummary = z.infer<typeof adminSummary>;

export const registryItem = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  /** Where the picture is served, or null when the item has none. */
  image: z.string().nullable(),
  link: z.string().nullable(),
  /** Null for an open fund, which has no goal and shows only what's been given. */
  priceCents: z.number().int().nullable(),
  raisedCents: z.number().int(),
});
export type RegistryItem = z.infer<typeof registryItem>;

/** An item as the couple enters it on /admin/registry. The picture is uploaded separately. */
export const registryItemFields = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  /** Null for an open fund, like a honeymoon fund. */
  priceCents: z.number().int().min(1).max(MAX_PRICE_CENTS).nullable(),
  /** Null for no link. Only web links, so a link can't run script when a guest clicks it. */
  link: z
    .string()
    .trim()
    .max(2000)
    .pipe(z.url({ protocol: /^https?$/, hostname: z.regexes.domain }))
    .nullable(),
});
export type RegistryItemFields = z.input<typeof registryItemFields>;

export const createdRegistryItem = z.object({ id: z.string() });

export const registryResponse = z.object({
  items: z.array(registryItem),
  /** False until Stripe is configured; the page then explains gifts aren't open yet. */
  acceptingGifts: z.boolean(),
});
export type RegistryResponse = z.infer<typeof registryResponse>;

export const checkoutRequest = z.object({
  itemId: z.string().min(1),
  amountCents: z.number().int(),
  name: z.string().trim().min(1).max(80),
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null),
});
export type CheckoutRequest = z.input<typeof checkoutRequest>;

export const checkoutResponse = z.object({ url: z.url() });

export const galleryPhoto = z.object({
  id: z.string(),
  alt: z.string(),
  caption: z.string().nullable(),
  /** The guest who shared it, by their guest-list name; null for the couple's own photos. */
  credit: z.string().nullable(),
  /** The large copy, up to LARGE_EDGE px on its long side; `width` and `height` are its size. */
  src: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  /** A copy up to SMALL_WIDTH px wide (the same file as `src` when the photo is that small). */
  small: z.object({ src: z.string(), width: z.number().int() }),
});
export type GalleryPhoto = z.infer<typeof galleryPhoto>;

export const photosResponse = z.object({
  /** The couple's photos, in their chosen order. */
  photos: z.array(galleryPhoto),
  /** Guests' photos the couple approved, oldest first. */
  guestPhotos: z.array(galleryPhoto),
  /** True while guests may upload photos. */
  uploadsOpen: z.boolean(),
});
export type PhotosResponse = z.infer<typeof photosResponse>;

export const adminPhoto = galleryPhoto.extend({
  /** The description as entered; empty when `alt` is the generic one. */
  altText: z.string(),
  source: z.enum(["couple", "guest"]),
  status: z.enum(["pending", "approved"]),
  createdAt: z.string(),
});
export type AdminPhoto = z.infer<typeof adminPhoto>;

export const adminPhotosResponse = z.object({
  /** The couple's photos in order, then guests' photos oldest first. */
  photos: z.array(adminPhoto),
  uploadsOpen: z.boolean(),
  /** Bytes stored for every photo, pending ones included, and the most allowed. */
  storage: z.object({ usedBytes: z.number().int(), limitBytes: z.number().int() }),
});
export type AdminPhotosResponse = z.infer<typeof adminPhotosResponse>;

const pixels = z.coerce.number().int().min(1).max(LARGE_EDGE);

/** The text fields sent with an upload's `large` and optional `small` files. */
export const photoUploadFields = z.object({
  width: pixels,
  height: pixels,
  alt: z.string().trim().max(300).default(""),
  caption: optionalText(300),
});

/** A guest with a session sends no name; their session says who they are. */
export const guestPhotoUploadFields = photoUploadFields.extend({
  firstName: personName.optional(),
  lastName: personName.optional(),
});

export const photoUploadResult = z.object({
  id: z.string(),
  status: z.enum(["pending", "approved"]),
});

/** Only the fields sent change. An empty caption clears it. */
export const photoEdit = z.object({
  alt: z.string().trim().max(300).optional(),
  caption: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .optional(),
  /** Guests' photos start as pending; approving one shows it on the Photos page. */
  status: z.literal("approved").optional(),
});
export type PhotoEdit = z.input<typeof photoEdit>;

export const photoOrder = z.object({ ids: z.array(z.string().min(1).max(64)).min(1).max(1000) });

export const photoUploadsSetting = z.object({ open: z.boolean() });

/** A Q&A entry the couple adds from /admin/questions, on top of those from DETAILS.md. */
export const questionFields = z.object({
  topic: z.enum(TOPICS),
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(2000),
});
export type QuestionFields = z.input<typeof questionFields>;

export const addedQuestion = questionFields.extend({ id: z.string(), createdAt: z.string() });
export type AddedQuestion = z.infer<typeof addedQuestion>;

/** The couple's change to a DETAILS.md question (content/qa.ts `key`), made from /admin/questions. */
export const builtEditFields = questionFields.extend({ hidden: z.boolean() });
export type BuiltEditFields = z.input<typeof builtEditFields>;

export const builtEdit = builtEditFields.extend({ key: z.string(), updatedAt: z.string() });
export type BuiltEdit = z.infer<typeof builtEdit>;

/** Added questions oldest first, plus the edits to DETAILS.md questions. */
export const questionsResponse = z.object({
  questions: z.array(addedQuestion),
  edits: z.array(builtEdit),
});
export type QuestionsResponse = z.infer<typeof questionsResponse>;

/** Who the visitor is, once they've sent an RSVP from this browser; null until then. */
export const sessionResponse = z.object({
  guest: z.object({ firstName: z.string(), lastName: z.string() }).nullable(),
});
export type SessionResponse = z.infer<typeof sessionResponse>;

/** Longest walk through the labyrinth that's saved: a day, in milliseconds. */
export const MAX_RUN_MS = 24 * 60 * 60 * 1000;

export const labyrinthRun = z.object({
  animal: z.enum(["fox", "deer"]),
  durationMs: z.number().int().min(1).max(MAX_RUN_MS),
});

/** Places shown on the leaderboard. */
export const LEADERBOARD_SIZE = 10;

export const leaderboardEntry = z.object({
  /** Equal times share a rank. */
  rank: z.number().int().min(1),
  /** First name and last initial, e.g. "Sam L.". */
  name: z.string(),
  /** The guest's best time. */
  durationMs: z.number().int(),
  /** True for the visitor's own entry. */
  you: z.boolean(),
});
export type LeaderboardEntry = z.infer<typeof leaderboardEntry>;

export const leaderboardResponse = z.object({
  /** Fastest first, at most LEADERBOARD_SIZE. */
  entries: z.array(leaderboardEntry),
  /** The visitor's own entry, wherever it ranks; null without a session or a saved time. */
  you: leaderboardEntry.nullable(),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponse>;
