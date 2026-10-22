import { z } from "zod";

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
  image: z.string().nullable(),
  link: z.string().nullable(),
  priceCents: z.number().int(),
  raisedCents: z.number().int(),
});
export type RegistryItem = z.infer<typeof registryItem>;

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
