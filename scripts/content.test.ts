import { describe, expect, it } from "vitest";
import { buildContent, parseDetails, parseLocalDateTime, toInstant } from "./content.ts";

const BASE = `
# Details
Groom: Wesley Bailey, he/him
Groom name as printed on invitation: T. Wesley Bailey
Bride: Grace Parkhill, she/her
Bride name as printed on invitation: Grace A. Parkhill
Wedding date: October 23, 2027
Ceremony start time: 5:00 pm
Ceremony venue: All Saints Chapel
Ceremony city, state: Sewanee, Tennessee
Website URL: parkhillbaileywedding.com
Invitation wording: "Grace A. Parkhill and T. Wesley Bailey invite you"
Dress code: {{ DRESS_CODE }}
<!-- Parking: commented out -->
`;

describe("parseDetails", () => {
  it("reads Label: value lines and skips quotes, placeholders and comments", () => {
    const facts = parseDetails(BASE);
    expect(facts.get("Ceremony venue")).toBe("All Saints Chapel");
    expect(facts.has("Invitation wording")).toBe(false);
    expect(facts.has("Dress code")).toBe(false);
    expect(facts.has("Parking")).toBe(false);
  });
});

describe("buildContent", () => {
  it("shows only Q&A entries whose facts exist", () => {
    const { content, hiddenQuestions } = buildContent(
      parseDetails(`${BASE}\nParking: Behind the chapel.`),
    );
    expect(content.qa.map((q) => q.question)).toContain("Where should I park?");
    expect(content.qa.find((q) => q.question === "Where should I park?")?.answer).toBe(
      "Behind the chapel.",
    );
    expect(hiddenQuestions).toContain("What should I wear?");
  });

  it("answers when, how to RSVP and whom to contact from DETAILS.md", () => {
    const { content } = buildContent(
      parseDetails(`${BASE}
Wedding time zone: America/Chicago
Couple contact: us@example.com
RSVP method: online, via the website
RSVP deadline, wave 1: March 30th, 2027
RSVP deadline, wave 2: June 30th, 2027`),
    );
    const answer = (question: string) => content.qa.find((q) => q.question === question)?.answer;
    expect(answer("When is the wedding?")).toBe(
      "October 23, 2027. The ceremony begins at 5:00 pm Central Time.",
    );
    expect(answer("Who can I contact with questions?")).toBe("Email us at us@example.com.");
    const rsvp = answer("How do I RSVP?");
    expect(rsvp).toContain("parkhillbaileywedding.com");
    expect(rsvp).not.toMatch(/March|June|wave/i);
  });

  it("hides the wedding-time answer until the time zone is known", () => {
    const { hiddenQuestions } = buildContent(parseDetails(BASE));
    expect(hiddenQuestions).toContain("When is the wedding?");
  });

  it("uses short first names and keeps the contact placeholder visible", () => {
    const { content, warnings } = buildContent(parseDetails(BASE));
    expect(content.brideShort).toBe("Grace");
    expect(content.groomShort).toBe("Wesley");
    expect(content.contact).toBe("{{ COUPLE_CONTACT }}");
    expect(warnings.some((w) => w.includes("Couple contact"))).toBe(true);
  });

  it("leaves the page intros out until they are filled in", () => {
    const empty = buildContent(
      parseDetails(`${BASE}\nPhotos intro: {{ PHOTOS_INTRO }}\nLabyrinth intro: {{ X }}`),
    );
    expect(empty.content.photosIntro).toBeNull();
    expect(empty.content.labyrinthIntro).toBeNull();
    const filled = buildContent(
      parseDetails(`${BASE}\nPhotos intro: A few favorites.\nLabyrinth intro: Find the way in.`),
    );
    expect(filled.content.photosIntro).toBe("A few favorites.");
    expect(filled.content.labyrinthIntro).toBe("Find the way in.");
  });

  it("hides the countdown until the time zone is known", () => {
    expect(buildContent(parseDetails(BASE)).content.startsAt).toBeNull();
    const withZone = buildContent(parseDetails(`${BASE}\nWedding time zone: America/Chicago`));
    expect(withZone.content.startsAt).toBe("2027-10-23T22:00:00.000Z");
  });

  it("fails with the missing label when a required fact is absent", () => {
    expect(() =>
      buildContent(parseDetails(BASE.replace("Ceremony venue: All Saints Chapel", ""))),
    ).toThrow(/Ceremony venue/);
  });
});

describe("dates", () => {
  it("parses wall-clock date and time", () => {
    expect(parseLocalDateTime("October 23, 2027", "5:00 pm")).toEqual([2027, 9, 23, 17, 0]);
    expect(parseLocalDateTime("January 1, 2027", "12:30 am")).toEqual([2027, 0, 1, 0, 30]);
    expect(() => parseLocalDateTime("23/10/2027", "5pm")).toThrow(/Can't parse/);
  });

  it("converts across a DST boundary correctly", () => {
    expect(toInstant([2027, 0, 15, 17, 0], "America/Chicago")).toBe("2027-01-15T23:00:00.000Z");
  });

  it("accepts ordinal day suffixes", () => {
    expect(parseLocalDateTime("October 23rd, 2027", "5:00 pm")).toEqual([2027, 9, 23, 17, 0]);
    expect(parseLocalDateTime("June 1st, 2027", "5:00 pm")).toEqual([2027, 5, 1, 17, 0]);
  });

  it("explains a time zone it doesn't recognize", () => {
    expect(() => buildContent(parseDetails(`${BASE}\nWedding time zone: Central Time`))).toThrow(
      /"Wedding time zone: Central Time".*America\/Chicago/,
    );
  });
});
