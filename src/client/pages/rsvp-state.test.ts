import { describe, expect, it } from "vitest";
import {
  addPerson,
  canAddPerson,
  draftFor,
  removePerson,
  respondProblem,
  toSubmission,
  updatePerson,
  type Draft,
} from "@client/pages/rsvp-state.ts";
import type { ListedGuest } from "@shared/schemas.ts";

const sam: ListedGuest = { id: "g1", firstName: "Sam", lastName: "Lee", spots: 3 };

function named(draft: Draft, index: number, firstName: string, attending: boolean | null) {
  const key = draft.people[index]!.key;
  return updatePerson(draft, key, { firstName, lastName: "Lee", attending });
}

const answer = (draft: Draft, index: number, attending: boolean) =>
  updatePerson(draft, draft.people[index]!.key, { attending });

describe("rsvp draft", () => {
  it("starts with the listed guest, named, and no answer yet", () => {
    const draft = draftFor(sam);
    expect(draft.people).toMatchObject([{ firstName: "Sam", lastName: "Lee", attending: null }]);
    expect(respondProblem(draft)).toMatch(/whether they'll attend/);
  });

  it("requires a name and an answer for every person", () => {
    let draft = answer(draftFor(sam), 0, true);
    expect(respondProblem(draft)).toBeNull();
    draft = addPerson(draft, sam.spots);
    expect(respondProblem(draft)).toMatch(/first and last name/);
    draft = named(draft, 1, "Kim", null);
    expect(respondProblem(draft)).toMatch(/whether they'll attend/);
    draft = named(draft, 1, "Kim", false);
    expect(respondProblem(draft)).toBeNull();
  });

  it("treats a name of only spaces as missing", () => {
    const draft = named(addPerson(answer(draftFor(sam), 0, true), 2), 1, "   ", true);
    expect(respondProblem(draft)).toMatch(/first and last name/);
  });

  it("stops adding people at the guest's number of places", () => {
    let draft = answer(draftFor(sam), 0, true);
    for (let i = 0; i < sam.spots + 2; i++) draft = addPerson(draft, sam.spots);
    expect(draft.people).toHaveLength(sam.spots);
    expect(canAddPerson(draft, sam.spots)).toBe(false);
  });

  it("can't add anyone for a guest with one place", () => {
    const draft = answer(draftFor({ ...sam, spots: 1 }), 0, true);
    expect(canAddPerson(draft, 1)).toBe(false);
    expect(addPerson(draft, 1).people).toHaveLength(1);
  });

  it("adds no one until the listed guest accepts", () => {
    let draft = draftFor(sam);
    expect(canAddPerson(draft, sam.spots)).toBe(false);
    expect(addPerson(draft, sam.spots).people).toHaveLength(1);
    draft = answer(draft, 0, false);
    expect(canAddPerson(draft, sam.spots)).toBe(false);
    draft = answer(draft, 0, true);
    expect(addPerson(draft, sam.spots).people).toHaveLength(2);
  });

  it("removes only the chosen person, and never the listed guest", () => {
    let draft = addPerson(addPerson(answer(draftFor(sam), 0, true), 3), 3);
    const [first, second, third] = draft.people;
    draft = removePerson(draft, second!.key);
    expect(draft.people.map((p) => p.key)).toEqual([first!.key, third!.key]);
    expect(removePerson(draft, first!.key).people).toHaveLength(2);
  });

  it("drops the dietary note of someone declining and trims the email", () => {
    let draft = addPerson(answer(draftFor(sam), 0, true), sam.spots);
    draft = answer(draft, 0, false);
    draft = updatePerson(draft, draft.people[0]!.key, { dietary: "nuts" });
    draft = named(draft, 1, "Kim", true);
    draft = updatePerson(draft, draft.people[1]!.key, { dietary: "vegan" });
    draft.email = "  sam@example.com ";
    expect(toSubmission("g1", draft)).toEqual({
      guestId: "g1",
      people: [
        { firstName: "Sam", lastName: "Lee", attending: false, dietary: "" },
        { firstName: "Kim", lastName: "Lee", attending: true, dietary: "vegan" },
      ],
      email: "sam@example.com",
      songRequest: "",
      note: "",
    });
  });
});
