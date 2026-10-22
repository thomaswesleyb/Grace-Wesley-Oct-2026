import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  aliasKey,
  allowedTypos,
  editDistance,
  matchGuest,
  nameKey,
  normalizeName,
  typedKeys,
  type NameCandidate,
} from "@shared/names.ts";
import { nicknamesOf } from "@shared/nicknames.ts";

describe("normalizeName", () => {
  it("strips accents, case, apostrophes and extra spaces", () => {
    expect(normalizeName("  Zoë  O'Brien ")).toBe("zoe obrien");
    expect(normalizeName("JOSÉ")).toBe("jose");
  });

  it("treats hyphens and dots as word breaks", () => {
    expect(normalizeName("Smith-Jones")).toBe("smith jones");
    expect(normalizeName("Smith – Jones")).toBe("smith jones");
    expect(normalizeName("St. John")).toBe("st john");
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string(), (s) => normalizeName(normalizeName(s)) === normalizeName(s)),
    );
  });
});

describe("aliasKey", () => {
  it("gives a one-word alias the guest's last name", () => {
    expect(aliasKey("Bill", "Smith")).toBe("bill smith");
  });

  it("keeps a full-name alias as written", () => {
    expect(aliasKey("Jane Doe-Smith", "Smith")).toBe("jane doe smith");
  });
});

describe("nicknames", () => {
  it("goes both ways", () => {
    expect(nicknamesOf("bob")).toContain("robert");
    expect(nicknamesOf("robert")).toContain("bob");
    expect(nicknamesOf("robert")).not.toContain("robert");
  });

  it("returns nothing for a name with no nicknames", () => {
    expect(nicknamesOf("wesley")).toEqual([]);
  });

  it("puts the typed key first and adds a variant per nickname", () => {
    const keys = typedKeys("Liz", "Lee");
    expect(keys[0]).toBe("liz lee");
    expect(keys).toContain("elizabeth lee");
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions, substitutions and transpositions", () => {
    expect(editDistance("anne", "ann")).toBe(1);
    expect(editDistance("jon", "joan")).toBe(1);
    expect(editDistance("smith", "smyth")).toBe(1);
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

const asTyped = (guestId: string) => ({ guestId, exact: true });
const toConfirm = (guestId: string) => ({ guestId, exact: false });

describe("matchGuest", () => {
  const candidates: NameCandidate[] = [
    { guestId: "margaret", nameKey: nameKey("Margaret", "Parkhill") },
    { guestId: "margaret", nameKey: aliasKey("Peggy", "Parkhill") },
    { guestId: "tom", nameKey: nameKey("Tom", "Parkhill") },
    { guestId: "al", nameKey: nameKey("Al", "Li") },
    { guestId: "robert", nameKey: nameKey("Robert", "Hughes") },
    { guestId: "ann", nameKey: nameKey("Ann", "Smith-Jones") },
  ];
  const find = (first: string, last: string) => matchGuest(typedKeys(first, last), candidates);

  it("matches exactly, ignoring case", () => {
    expect(find("tom", "PARKHILL")).toEqual(asTyped("tom"));
  });

  it("tolerates typos in longer names", () => {
    expect(find("Margret", "Parkhil")).toEqual(toConfirm("margaret"));
  });

  it("does not guess for short names", () => {
    expect(find("Al", "Lu")).toBeNull();
  });

  it("treats an alias as an exact match", () => {
    expect(find("Peggy", "Parkhill")).toEqual(asTyped("margaret"));
  });

  it("finds a guest by a nickname from the table, as a match to confirm", () => {
    expect(find("Bob", "Hughes")).toEqual(toConfirm("robert"));
    expect(find("Thomas", "Parkhill")).toEqual(toConfirm("tom"));
    expect(find("Bob", "Hughs")).toEqual(toConfirm("robert"));
  });

  it("matches a hyphenated last name typed with a space, joined, or alone", () => {
    expect(find("Ann", "Smith Jones")).toEqual(asTyped("ann"));
    expect(find("Ann", "SmithJones")).toEqual(toConfirm("ann"));
  });

  it("returns null for empty input or no match", () => {
    expect(matchGuest([], candidates)).toBeNull();
    expect(matchGuest([""], candidates)).toBeNull();
    expect(find("Someone", "Else")).toBeNull();
  });

  it("returns null when an exact name belongs to two guests", () => {
    const dupes = [
      { guestId: "x", nameKey: "pat lee" },
      { guestId: "y", nameKey: "pat lee" },
    ];
    expect(matchGuest(["pat lee"], dupes)).toBeNull();
  });

  it("returns null when two guests are equally close", () => {
    const close = [
      { guestId: "x", nameKey: "jane parker" },
      { guestId: "y", nameKey: "jane porter" },
    ];
    expect(matchGuest(["jane parter"], close)).toBeNull();
  });

  it("prefers an exact match over a closer typo for another guest", () => {
    const list = [
      { guestId: "anne", nameKey: "anne miller" },
      { guestId: "ann", nameKey: "ann miller" },
    ];
    expect(matchGuest(["ann miller"], list)).toEqual({ guestId: "ann", exact: true });
  });

  it("prefers the name as typed over a nickname of another guest", () => {
    const list = [
      { guestId: "will", nameKey: "will reed" },
      { guestId: "william", nameKey: "william reed" },
    ];
    expect(matchGuest(typedKeys("Will", "Reed"), list)).toEqual({ guestId: "will", exact: true });
  });

  it("always finds every guest by their exact name", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[a-z]{2,10} [a-z]{2,10}$/), {
          minLength: 1,
          maxLength: 20,
        }),
        (keys) => {
          const list = keys.map((key, i) => ({ guestId: `g${i}`, nameKey: key }));
          for (const [i, key] of keys.entries()) {
            expect(matchGuest([key], list)).toEqual({ guestId: `g${i}`, exact: true });
          }
        },
      ),
    );
  });
});
