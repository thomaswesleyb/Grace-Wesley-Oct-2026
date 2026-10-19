import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  allowedTypos,
  editDistance,
  matchInvitation,
  nameKey,
  normalizeName,
} from "@shared/names.ts";

describe("normalizeName", () => {
  it("strips accents, case, punctuation and extra spaces", () => {
    expect(normalizeName("  Zoë  O'Brien-Smith ")).toBe("zoe obriensmith");
    expect(normalizeName("JOSÉ")).toBe("jose");
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (s) => normalizeName(normalizeName(s)) === normalizeName(s)),
    );
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions, substitutions and transpositions", () => {
    expect(editDistance("anne", "ann")).toBe(1);
    expect(editDistance("jon", "joan")).toBe(1);
    expect(editDistance("smith", "smyth")).toBe(1);
    expect(editDistance("grace", "gracd")).toBe(1);
    expect(editDistance("wesley", "wesely")).toBe(1);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("is zero only for equal strings, symmetric, and bounded by the longer length", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), fc.string({ maxLength: 12 }), (a, b) => {
        const d = editDistance(a, b);
        expect(d === 0).toBe(a === b);
        expect(editDistance(b, a)).toBe(d);
        expect(d).toBeLessThanOrEqual(Math.max(a.length, b.length));
      }),
    );
  });
});

describe("allowedTypos", () => {
  it("scales with name length", () => {
    expect(allowedTypos("al li")).toBe(0);
    expect(allowedTypos("sam smith")).toBe(1);
    expect(allowedTypos("margaret parkhill")).toBe(2);
  });
});

describe("matchInvitation", () => {
  const candidates = [
    { guestId: "g1", invitationId: "inv-a", nameKey: nameKey("Margaret", "Parkhill") },
    { guestId: "g2", invitationId: "inv-a", nameKey: nameKey("Tom", "Parkhill") },
    { guestId: "g3", invitationId: "inv-b", nameKey: nameKey("Al", "Li") },
  ];

  it("matches exactly", () => {
    expect(matchInvitation(nameKey("tom", "PARKHILL"), candidates)).toBe("inv-a");
  });

  it("tolerates typos in longer names", () => {
    expect(matchInvitation(nameKey("Margret", "Parkhil"), candidates)).toBe("inv-a");
  });

  it("does not guess for short names", () => {
    expect(matchInvitation(nameKey("Al", "Lu"), candidates)).toBeNull();
  });

  it("returns null for empty input or no match", () => {
    expect(matchInvitation("", candidates)).toBeNull();
    expect(matchInvitation(nameKey("Someone", "Else"), candidates)).toBeNull();
  });

  it("returns null when an exact name appears on two invitations", () => {
    const dupes = [
      { guestId: "x", invitationId: "one", nameKey: "pat lee" },
      { guestId: "y", invitationId: "two", nameKey: "pat lee" },
    ];
    expect(matchInvitation("pat lee", dupes)).toBeNull();
  });

  it("always finds every guest by their exact name", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{2,10} [a-z]{2,10}$/), {
          minLength: 1,
          maxLength: 20,
        }),
        (keys) => {
          const list = keys.map((key, i) => ({
            guestId: `g${i}`,
            invitationId: `inv${i}`,
            nameKey: key,
          }));
          for (const [i, key] of keys.entries()) expect(matchInvitation(key, list)).toBe(`inv${i}`);
        },
      ),
    );
  });
});
