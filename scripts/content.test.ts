import { describe, expect, it } from "vitest";
import {
  buildContent,
  parseDetails,
  parseIsoDate,
  parseLocalDateTime,
  toInstant,
  waveDeadlines,
} from "./content.ts";

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

  it("uses short first names and keeps the contact placeholder visible", () => {
    const { content, warnings } = buildContent(parseDetails(BASE));
    expect(content.brideShort).toBe("Grace");
    expect(content.groomShort).toBe("Wesley");
    expect(content.contact).toBe("{{ COUPLE_CONTACT }}");
    expect(warnings.some((w) => w.includes("Couple contact"))).toBe(true);
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
    expect(parseIsoDate("March 30th, 2027")).toBe("2027-03-30");
    expect(parseIsoDate("June 1st, 2027")).toBe("2027-06-01");
  });

  it("explains a time zone it doesn't recognize", () => {
    expect(() => buildContent(parseDetails(`${BASE}\nWedding time zone: Central Time`))).toThrow(
      /"Wedding time zone: Central Time".*America\/Chicago/,
    );
  });

  it("parses wave deadlines", () => {
    expect(parseIsoDate("March 1, 2027")).toBe("2027-03-01");
    const deadlines = waveDeadlines(parseDetails("RSVP deadline, wave 2: May 15, 2027"));
    expect([...deadlines]).toEqual([[2, "2027-05-15"]]);
  });
});
