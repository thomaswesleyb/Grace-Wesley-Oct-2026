import { describe, expect, it } from "vitest";
import { buildGuests, buildGuestSql, planSeed } from "./guests.ts";

const HEADER = "firstname,lastname,total_guest_spots";

describe("buildGuests", () => {
  it("reads the guest list and builds name keys", () => {
    const guests = buildGuests(`${HEADER}\nZoë,O'Brien,2\nSam,Lee,0\n`);
    expect(guests).toEqual([
      {
        firstName: "Zoë",
        lastName: "O'Brien",
        nameKey: "zoe obrien",
        spots: 2,
        aliasKeys: [],
        sort: 0,
      },
      { firstName: "Sam", lastName: "Lee", nameKey: "sam lee", spots: 0, aliasKeys: [], sort: 1 },
    ]);
  });

  it("reads aliases: first names take the guest's last name, full names stay whole", () => {
    const [guest] = buildGuests(
      `${HEADER},aliases\nWilliam,Smith,1,"Bill; Will Smith-Jones ;; William"\n`,
    );
    expect(guest?.aliasKeys).toEqual(["bill smith", "will smith jones"]);
  });

  it("accepts columns in any order and case", () => {
    const [guest] = buildGuests("Total_Guest_Spots,LastName,FirstName\n3,Lee,Sam\n");
    expect(guest).toMatchObject({ firstName: "Sam", lastName: "Lee", spots: 3 });
  });

  it("names the missing columns", () => {
    expect(() => buildGuests("firstname,lastname\nSam,Lee\n")).toThrow(/total_guest_spots/);
  });

  it("lists every bad row at once", () => {
    const text = `${HEADER}\n,Lee,1\nSam,Lee,two\nKim,Lee,7\nPat,Lee,-1\nAl,Li,1.5\n`;
    const error = (() => {
      try {
        buildGuests(text);
      } catch (e) {
        return String(e);
      }
      return "";
    })();
    for (const line of [2, 3, 4, 5, 6]) expect(error).toContain(`Line ${line}:`);
    expect(error).toContain("Nothing was changed");
  });

  it("refuses two guests with the same name", () => {
    expect(() => buildGuests(`${HEADER}\nSam,Lee,1\nsam,LEE,2\n`)).toThrow(/lines 2, 3/);
  });

  it("refuses an alias that is another guest's name", () => {
    expect(() => buildGuests(`${HEADER},aliases\nSam,Lee,1,\nSamuel,Lee,1,Sam\n`)).toThrow(
      /"sam lee" belongs to more than one guest/,
    );
  });
});

describe("planSeed", () => {
  const guests = buildGuests(`${HEADER}\nSam,Lee,1\nKim,Lee,2\n`);

  it("counts added, updated and removed guests", () => {
    const plan = planSeed(guests, [
      { nameKey: "sam lee", hasRsvp: true },
      { nameKey: "old guest", hasRsvp: false },
    ]);
    expect(plan).toEqual({ added: 1, updated: 1, removed: ["old guest"] });
  });

  it("refuses to remove a guest who has answered", () => {
    expect(() => planSeed(guests, [{ nameKey: "gone guest", hasRsvp: true }])).toThrow(
      /gone guest.*Nothing was changed/,
    );
  });
});

describe("buildGuestSql", () => {
  it("upserts by name key, replaces aliases and escapes quotes", () => {
    const guests = buildGuests(`${HEADER},aliases\nZoë,O'Brien,2,Zo\n`);
    let n = 0;
    const text = buildGuestSql(guests, ["old guest"], () => `id-${++n}`);
    expect(text).toContain("DELETE FROM guests WHERE name_key IN ('old guest');");
    expect(text).toContain(
      "VALUES ('id-1', 'Zoë', 'O''Brien', 'zoe obrien', 2, 0) ON CONFLICT (name_key) DO UPDATE",
    );
    expect(text).toContain(
      "INSERT INTO guest_aliases (guest_id, name_key) SELECT id, 'zo obrien' FROM guests WHERE name_key = 'zoe obrien';",
    );
    expect(text.indexOf("DELETE FROM guest_aliases;")).toBeLessThan(
      text.indexOf("INSERT INTO guest_aliases"),
    );
  });

  it("deletes nothing when no guest was removed", () => {
    const text = buildGuestSql(buildGuests(`${HEADER}\nSam,Lee,1\n`), [], () => "id");
    expect(text).not.toContain("DELETE FROM guests");
  });
});
