import { describe, expect, it } from "vitest";
import { toCsv } from "@client/pages/Admin.tsx";

describe("toCsv", () => {
  it("writes one row per guest, names the plus-one's host, and escapes cells", () => {
    const csv = toCsv([
      {
        id: "i",
        label: "Lee, Sam",
        wave: 1,
        priority: 1,
        status: "sent",
        sentAt: null,
        respondedAt: "2026-10-24",
        email: "sam@example.com",
        note: 'He said "yes"',
        songRequest: null,
        guests: [
          {
            id: "a",
            firstName: "Sam",
            lastName: "Lee",
            plusOneAllowed: true,
            plusOneOf: null,
            attending: true,
            dietary: null,
            inviteEmail: "sam.lee@example.com",
          },
          {
            id: "p",
            firstName: "Pat",
            lastName: "Doe",
            plusOneAllowed: false,
            plusOneOf: "a",
            attending: true,
            dietary: "vegan",
            inviteEmail: null,
          },
        ],
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe(
      '"Lee, Sam",1,sent,Sam,Lee,,Yes,,sam.lee@example.com,sam@example.com,,"He said ""yes""",2026-10-24',
    );
    expect(lines[2]).toContain("Pat,Doe,Sam Lee,Yes,vegan,,sam@example.com");
  });
});
