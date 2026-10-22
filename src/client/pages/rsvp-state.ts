import { MAX_PARTY, type RsvpSubmission } from "@shared/schemas.ts";

export interface PersonDraft {
  /** Stable React key, so removing a person doesn't shift the others' inputs. */
  key: number;
  firstName: string;
  lastName: string;
  attending: boolean | null;
  dietary: string;
}

export interface Draft {
  people: PersonDraft[];
  email: string;
  songRequest: string;
  note: string;
}

let nextKey = 0;

function emptyPerson(): PersonDraft {
  nextKey += 1;
  return { key: nextKey, firstName: "", lastName: "", attending: null, dietary: "" };
}

export function emptyDraft(): Draft {
  return { people: [emptyPerson()], email: "", songRequest: "", note: "" };
}

export const canAddPerson = (draft: Draft) => draft.people.length < MAX_PARTY;

export function addPerson(draft: Draft): Draft {
  return canAddPerson(draft) ? { ...draft, people: [...draft.people, emptyPerson()] } : draft;
}

/** Removes the person with this key. The first person (the one responding) always stays. */
export function removePerson(draft: Draft, key: number): Draft {
  const people = draft.people.filter((p, index) => index === 0 || p.key !== key);
  return { ...draft, people };
}

export function updatePerson(draft: Draft, key: number, patch: Partial<PersonDraft>): Draft {
  return { ...draft, people: draft.people.map((p) => (p.key === key ? { ...p, ...patch } : p)) };
}

/** Returns what still needs filling in on the respond step, or null when it's complete. */
export function respondProblem(draft: Draft): string | null {
  if (draft.people.some((p) => !p.firstName.trim() || !p.lastName.trim())) {
    return "Please add a first and last name for each person.";
  }
  if (draft.people.some((p) => p.attending === null)) {
    return "Please let us know for each person whether they'll attend.";
  }
  return null;
}

export function toSubmission(code: string, draft: Draft): RsvpSubmission {
  return {
    code,
    people: draft.people.map((p) => ({
      firstName: p.firstName,
      lastName: p.lastName,
      attending: p.attending === true,
      dietary: p.attending === true ? p.dietary : "",
    })),
    email: draft.email.trim(),
    songRequest: draft.songRequest,
    note: draft.note,
  };
}
