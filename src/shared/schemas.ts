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

const rsvpCode = z.string().max(40);

export const unlockRequest = z.object({ code: rsvpCode });
export const okResponse = z.object({ ok: z.literal(true) });

export const rsvpPerson = z.object({
  firstName: personName,
  lastName: personName,
  attending: z.boolean(),
  dietary: optionalText(200),
});

export const rsvpSubmission = z.object({
  code: rsvpCode,
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
  createdAt: z.string(),
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

export const adminSummary = z.object({
  totals: z.object({
    rsvps: z.number().int(),
    attending: z.number().int(),
    declining: z.number().int(),
  }),
  /** Newest first. */
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
