import type { InvitationView, RsvpSubmission } from "@shared/schemas.ts";

export interface GuestAnswer {
  attending: boolean | null;
  dietary: string;
}

export interface PlusOneDraft {
  bringing: boolean;
  firstName: string;
  lastName: string;
  dietary: string;
}

export interface Draft {
  answers: Record<string, GuestAnswer>;
  plusOnes: Record<string, PlusOneDraft>;
  email: string;
  songRequest: string;
  note: string;
}

export function emptyDraft(invitation: InvitationView): Draft {
  const answers: Record<string, GuestAnswer> = {};
  const plusOnes: Record<string, PlusOneDraft> = {};
  for (const guest of invitation.guests) {
    if (guest.isPlusOne) continue;
    answers[guest.id] = { attending: null, dietary: "" };
    if (guest.plusOneAllowed)
      plusOnes[guest.id] = { bringing: false, firstName: "", lastName: "", dietary: "" };
  }
  return { answers, plusOnes, email: "", songRequest: "", note: "" };
}

/** The plus-one that will actually be submitted: host attending, box ticked, name filled. */
export function activePlusOne(draft: Draft): { hostId: string; plusOne: PlusOneDraft } | null {
  for (const [hostId, plusOne] of Object.entries(draft.plusOnes)) {
    if (plusOne.bringing && draft.answers[hostId]?.attending === true) return { hostId, plusOne };
  }
  return null;
}

/** Returns what still needs answering on the respond step, or null when it's complete. */
export function respondProblem(draft: Draft): string | null {
  if (Object.values(draft.answers).some((a) => a.attending === null)) {
    return "Please let us know for each person whether they'll attend.";
  }
  const active = activePlusOne(draft);
  if (active !== null && (!active.plusOne.firstName.trim() || !active.plusOne.lastName.trim())) {
    return "Please add your guest's first and last name.";
  }
  return null;
}

export function toSubmission(draft: Draft): RsvpSubmission {
  const active = activePlusOne(draft);
  return {
    guests: Object.entries(draft.answers).map(([id, answer]) => ({
      id,
      attending: answer.attending === true,
      dietary: answer.attending === true ? answer.dietary : "",
    })),
    plusOne:
      active === null
        ? null
        : {
            hostId: active.hostId,
            firstName: active.plusOne.firstName,
            lastName: active.plusOne.lastName,
            dietary: active.plusOne.dietary,
          },
    email: draft.email.trim(),
    songRequest: draft.songRequest,
    note: draft.note,
  };
}

/** "2027-03-01" → "March 1, 2027". */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
