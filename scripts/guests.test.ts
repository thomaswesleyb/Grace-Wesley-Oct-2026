import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildInvitations, buildSeedSql, parseCsv } from "./guests.ts";

const HEADER = "invitation,first_name,last_name,plus_one_allowed,wave,priority";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, commas and CRLF", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,2,3\n')).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "2", "3"],
    ]);
  });

  it("keeps a trailing empty field and drops blank lines", () => {
    expect(parseCsv("a,b,\n\n")).toEqual([["a", "b", ""]]);
  });

  it("rejects an unclosed quote", () => {
    expect(() => parseCsv('a,"open\n')).toThrow(/malformed/);
  });

  it("round-trips any grid of fields", () => {
    const cell = fc.string({ maxLength: 8 });
    fc.assert(
      fc.property(
        fc.array(fc.array(cell, { minLength: 2, maxLength: 4 }), { minLength: 1, maxLength: 5 }),
        (grid) => {
          const rows = grid.map((r) => [...r.slice(0, -1), `${r.at(-1)}x`]);
          const text = rows
            .map((r) => r.map((c) => `"${c.replaceAll('"', '""')}"`).join(","))
            .join("\n");
          expect(parseCsv(text)).toEqual(rows);
        },
      ),
    );
  });
});

describe("buildInvitations", () => {
  it("groups by invitation, names solo guests, and orders blank priorities after explicit ones", () => {
    const invitations = buildInvitations(
      `${HEADER}\nSmith household,John,Smith,no,1,\nSmith household,Jane,Smith,no,1,2\n,Jo,Bailey,yes,2,`,
    );
    expect(invitations).toHaveLength(2);
    expect(invitations[0]).toMatchObject({ label: "Smith household", wave: 1, priority: 2 });
    expect(invitations[0]?.guests.map((g) => g.firstName)).toEqual(["John", "Jane"]);
    expect(invitations[1]).toMatchObject({ label: "Jo Bailey", wave: 2 });
    expect(invitations[1]?.priority).toBeGreaterThan(2);
    expect(invitations[1]?.guests[0]?.plusOneAllowed).toBe(true);
  });

  it("names the missing columns", () => {
    expect(() => buildInvitations("first_name,last_name\nA,B")).toThrow(
      /missing columns: invitation/,
    );
  });

  it("rejects duplicate names, bad waves and bad yes/no values with the line number", () => {
    expect(() => buildInvitations(`${HEADER}\n,Ann,Lee,no,1,\n,ann,LEE,no,2,`)).toThrow(
      /Line 3.*duplicates line 2/,
    );
    expect(() => buildInvitations(`${HEADER}\n,Ann,Lee,no,4,`)).toThrow(/Line 2: wave/);
    expect(() => buildInvitations(`${HEADER}\n,Ann,Lee,maybe,1,`)).toThrow(
      /Line 2: plus_one_allowed/,
    );
    expect(() => buildInvitations(`${HEADER}\n,Ann,Lee,no,1,0`)).toThrow(/Line 2: priority/);
  });

  it("rejects one invitation split across waves", () => {
    expect(() => buildInvitations(`${HEADER}\nFam,A,Fam,no,1,\nFam,B,Fam,no,2,`)).toThrow(
      /wave 1 on an earlier line/,
    );
  });
});

describe("guest email", () => {
  it("is optional: a CSV without the column still loads", () => {
    const [invitation] = buildInvitations(`${HEADER}\n,Ann,Lee,no,1,`);
    expect(invitation?.guests[0]?.email).toBeNull();
  });

  it("is trimmed and lowercased, and a blank cell means no address", () => {
    const invitations = buildInvitations(
      `${HEADER},email\nLee,Ann,Lee,no,1,, Ann.Lee@Example.COM \nLee,Kid,Lee,no,1,,`,
    );
    expect(invitations[0]?.guests.map((g) => g.email)).toEqual(["ann.lee@example.com", null]);
  });

  it("rejects an invalid address with the line number", () => {
    expect(() => buildInvitations(`${HEADER},email\n,Ann,Lee,no,1,,not-an-email`)).toThrow(
      /Line 2: email "not-an-email"/,
    );
  });
});

describe("buildSeedSql", () => {
  it("releases waves up to --release-wave, sets deadlines, and escapes quotes", () => {
    let n = 0;
    const sql = buildSeedSql(buildInvitations(`${HEADER}\n,Pat,O'Neil,no,1,\n,Kim,Ng,no,2,`), {
      releaseWave: 1,
      deadlines: new Map([[1, "2027-03-01"]]),
      now: "2026-10-23T00:00:00Z",
      newId: () => `id${++n}`,
    });
    expect(sql).toContain("UPDATE waves SET respond_by = '2027-03-01' WHERE wave = 1;");
    expect(sql).toContain("'O''Neil'");
    expect(sql).toMatch(/'Pat O''Neil', 1, \d+, 'sent', '2026-10-23T00:00:00Z'/);
    expect(sql).toMatch(/'Kim Ng', 2, \d+, 'held', NULL/);
    expect(sql).toMatch(/'Pat', 'O''Neil', 'pat oneil', 0, NULL, 0\);/);
  });

  it("stores the invite email", () => {
    const sql = buildSeedSql(buildInvitations(`${HEADER},email\n,Ann,Lee,no,1,,ann@example.com`), {
      releaseWave: null,
      deadlines: new Map(),
      now: "2026-10-23T00:00:00Z",
      newId: () => "id",
    });
    expect(sql).toContain("'ann lee', 0, 'ann@example.com', 0);");
  });
});
