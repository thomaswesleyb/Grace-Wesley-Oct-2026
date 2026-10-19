import { describe, expect, it } from "vitest";
import { emptyDraft, formatDate, respondProblem, toSubmission } from "@client/pages/rsvp-state.ts";
import type { InvitationView } from "@shared/schemas.ts";

const invitation: InvitationView = {
  id: "inv",
  label: "Lee",
  respondBy: null,
  closed: false,
  responded: false,
  guests: [
    {
      id: "a",
      firstName: "Sam",
      lastName: "Lee",
      plusOneAllowed: true,
      isPlusOne: false,
      attending: null,
    },
    {
      id: "b",
      firstName: "Kim",
      lastName: "Lee",
      plusOneAllowed: false,
      isPlusOne: false,
      attending: null,
    },
  ],
};

describe("rsvp draft", () => {
  it("requires an answer for every guest", () => {
    const draft = emptyDraft(invitation);
    expect(respondProblem(draft)).toMatch(/each person/);
    draft.answers["a"] = { attending: true, dietary: "" };
    draft.answers["b"] = { attending: false, dietary: "" };
    expect(respondProblem(draft)).toBeNull();
  });

  it("requires the plus-one's name only when they're coming", () => {
    const draft = emptyDraft(invitation);
    draft.answers["a"] = { attending: true, dietary: "" };
    draft.answers["b"] = { attending: true, dietary: "" };
    draft.plusOnes["a"] = { bringing: true, firstName: "", lastName: "", dietary: "" };
    expect(respondProblem(draft)).toMatch(/guest's first and last name/);
    draft.answers["a"] = { attending: false, dietary: "" };
    expect(respondProblem(draft)).toBeNull();
  });

  it("drops the dietary note and plus-one of someone declining", () => {
    const draft = emptyDraft(invitation);
    draft.answers["a"] = { attending: false, dietary: "nuts" };
    draft.answers["b"] = { attending: true, dietary: "vegan" };
    draft.plusOnes["a"] = { bringing: true, firstName: "Pat", lastName: "Doe", dietary: "" };
    draft.email = "  sam@example.com ";
    expect(toSubmission(draft)).toEqual({
      guests: [
        { id: "a", attending: false, dietary: "" },
        { id: "b", attending: true, dietary: "vegan" },
      ],
      plusOne: null,
      email: "sam@example.com",
      songRequest: "",
      note: "",
    });
  });

  it("formats deadlines without shifting the day", () => {
    expect(formatDate("2027-03-01")).toBe("March 1, 2027");
  });
});
