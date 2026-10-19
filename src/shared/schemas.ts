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

export const lookupRequest = z.object({
  firstName: personName,
  lastName: personName,
});
export type LookupRequest = z.infer<typeof lookupRequest>;

export const invitationGuest = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  plusOneAllowed: z.boolean(),
  isPlusOne: z.boolean(),
  attending: z.boolean().nullable(),
});
export type InvitationGuest = z.infer<typeof invitationGuest>;

export const invitationView = z.object({
  id: z.string(),
  label: z.string(),
  respondBy: z.string().nullable(),
  closed: z.boolean(),
  responded: z.boolean(),
  guests: z.array(invitationGuest),
});
export type InvitationView = z.infer<typeof invitationView>;

export const lookupResponse = z.discriminatedUnion("found", [
  z.object({ found: z.literal(false) }),
  z.object({ found: z.literal(true), invitation: invitationView }),
]);
export type LookupResponse = z.infer<typeof lookupResponse>;

export const rsvpSubmission = z.object({
  guests: z
    .array(
      z.object({
        id: z.string().min(1),
        attending: z.boolean(),
        dietary: optionalText(200),
      }),
    )
    .min(1),
  plusOne: z
    .object({
      hostId: z.string().min(1),
      firstName: personName,
      lastName: personName,
      dietary: optionalText(200),
    })
    .nullable()
    .default(null),
  email: z.email().max(254),
  songRequest: optionalText(200),
  note: optionalText(1000),
});
export type RsvpSubmission = z.input<typeof rsvpSubmission>;
export type ParsedRsvpSubmission = z.output<typeof rsvpSubmission>;

export const rsvpResult = z.object({
  attending: z.number().int(),
  declining: z.number().int(),
  respondBy: z.string().nullable(),
});
export type RsvpResult = z.infer<typeof rsvpResult>;

export const apiError = z.object({ error: z.string() });
export type ApiError = z.infer<typeof apiError>;

export const adminGuest = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  plusOneAllowed: z.boolean(),
  plusOneOf: z.string().nullable(),
  attending: z.boolean().nullable(),
  dietary: z.string().nullable(),
  inviteEmail: z.string().nullable(),
});

export const adminInvitation = z.object({
  id: z.string(),
  label: z.string(),
  wave: z.number().int(),
  priority: z.number().int(),
  status: z.enum(["held", "sent"]),
  sentAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  /** The address the guest typed when they RSVP'd. */
  email: z.string().nullable(),
  note: z.string().nullable(),
  songRequest: z.string().nullable(),
  guests: z.array(adminGuest),
});
export type AdminInvitation = z.infer<typeof adminInvitation>;

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
  capacity: z.object({
    target: z.number(),
    confirmed: z.number(),
    declined: z.number(),
    pending: z.number(),
    open: z.number(),
    forecast: z.number(),
  }),
  invitations: z.array(adminInvitation),
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
