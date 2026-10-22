import { describe, expect, it } from "vitest";
import {
  addPerson,
  canAddPerson,
  emptyDraft,
  removePerson,
  respondProblem,
  toSubmission,
  updatePerson,
  type Draft,
} from "@client/pages/rsvp-state.ts";
import { MAX_PARTY } from "@shared/schemas.ts";

function named(draft: Draft, index: number, firstName: string, attending: boolean | null) {
  const key = draft.people[index]!.key;
  return updatePerson(draft, key, { firstName, lastName: "Lee", attending });
}

describe("rsvp draft", () => {
  it("starts with one empty person", () => {
    const draft = emptyDraft();
    expect(draft.people).toHaveLength(1);
    expect(respondProblem(draft)).toMatch(/first and last name/);
  });

  it("requires a name and an answer for every person", () => {
    let draft = named(emptyDraft(), 0, "Sam", true);
    expect(respondProblem(draft)).toBeNull();
    draft = addPerson(draft);
    expect(respondProblem(draft)).toMatch(/first and last name/);
    draft = named(draft, 1, "Kim", null);
    expect(respondProblem(draft)).toMatch(/whether they'll attend/);
    draft = named(draft, 1, "Kim", false);
    expect(respondProblem(draft)).toBeNull();
  });

  it("treats a name of only spaces as missing", () => {
    const draft = named(emptyDraft(), 0, "   ", true);
    expect(respondProblem(draft)).toMatch(/first and last name/);
  });

  it(`stops adding people at ${MAX_PARTY}`, () => {
    let draft = emptyDraft();
    for (let i = 0; i < MAX_PARTY + 2; i++) draft = addPerson(draft);
    expect(draft.people).toHaveLength(MAX_PARTY);
    expect(canAddPerson(draft)).toBe(false);
  });

  it("removes only the chosen person, and never the first", () => {
    let draft = addPerson(addPerson(emptyDraft()));
    const [first, second, third] = draft.people;
    draft = removePerson(draft, second!.key);
    expect(draft.people.map((p) => p.key)).toEqual([first!.key, third!.key]);
    expect(removePerson(draft, first!.key).people).toHaveLength(2);
  });

  it("drops the dietary note of someone declining and trims the email", () => {
    let draft = addPerson(emptyDraft());
    draft = named(draft, 0, "Sam", false);
    draft = updatePerson(draft, draft.people[0]!.key, { dietary: "nuts" });
    draft = named(draft, 1, "Kim", true);
    draft = updatePerson(draft, draft.people[1]!.key, { dietary: "vegan" });
    draft.email = "  sam@example.com ";
    expect(toSubmission("10232027", draft)).toEqual({
      code: "10232027",
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
