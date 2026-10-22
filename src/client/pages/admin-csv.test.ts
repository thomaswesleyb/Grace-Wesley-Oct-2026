import { describe, expect, it } from "vitest";
import { toCsv } from "@client/pages/Admin.tsx";

describe("toCsv", () => {
  it("writes one row per person and escapes cells", () => {
    const csv = toCsv([
      {
        id: "r1",
        createdAt: "2026-10-24T10:00:00Z",
        email: "sam@example.com",
        songRequest: null,
        note: 'He said "yes", twice',
        people: [
          { id: "p1", firstName: "Sam", lastName: "Lee", attending: true, dietary: null },
          { id: "p2", firstName: "Pat", lastName: "Doe", attending: false, dietary: null },
        ],
      },
    ]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "rsvp_id,first_name,last_name,attending,dietary,email,song_request,note,submitted_at",
    );
    expect(lines[1]).toBe(
      'r1,Sam,Lee,Yes,,sam@example.com,,"He said ""yes"", twice",2026-10-24T10:00:00Z',
    );
    expect(lines[2]).toContain("r1,Pat,Doe,No,");
  });

  it("writes only the header when there are no RSVPs", () => {
    expect(toCsv([]).split("\n")).toHaveLength(1);
  });
});
