import { describe, expect, it } from "vitest";
import { toCsv } from "@client/pages/Admin.tsx";
import type { AdminGuest, AdminRsvp } from "@shared/schemas.ts";

const sam: AdminGuest = {
  id: "g1",
  firstName: "Sam",
  lastName: "Lee",
  spots: 2,
  answeredAt: "2026-10-24T10:00:00Z",
  attending: 1,
};

const rsvp = (overrides: Partial<AdminRsvp> = {}): AdminRsvp => ({
  id: "r1",
  guestId: "g1",
  createdAt: "2026-10-24T10:00:00Z",
  replacedAt: null,
  email: "sam@example.com",
  songRequest: null,
  note: 'He said "yes", twice',
  people: [
    { id: "p1", firstName: "Sam", lastName: "Lee", attending: true, dietary: null },
    { id: "p2", firstName: "Pat", lastName: "Doe", attending: false, dietary: null },
  ],
  ...overrides,
});

describe("toCsv", () => {
  it("writes one row per person with the guest and escapes cells", () => {
    const lines = toCsv([rsvp()], [sam]).split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "rsvp_id,guest,spots,current,first_name,last_name,attending,dietary,email,song_request,note,submitted_at",
    );
    expect(lines[1]).toBe(
      'r1,Sam Lee,2,Yes,Sam,Lee,Yes,,sam@example.com,,"He said ""yes"", twice",2026-10-24T10:00:00Z',
    );
    expect(lines[2]).toContain("r1,Sam Lee,2,Yes,Pat,Doe,No,");
  });

  it("marks replaced answers and leaves the guest blank on unlinked ones", () => {
    const csv = toCsv(
      [rsvp({ replacedAt: "2026-10-25T00:00:00Z" }), rsvp({ id: "r0", guestId: null })],
      [sam],
    );
    const lines = csv.split("\n");
    expect(lines[1]).toMatch(/^r1,Sam Lee,2,No,/);
    expect(lines[3]).toMatch(/^r0,,,Yes,/);
  });

  it("writes only the header when there are no RSVPs", () => {
    expect(toCsv([], []).split("\n")).toHaveLength(1);
  });
});
