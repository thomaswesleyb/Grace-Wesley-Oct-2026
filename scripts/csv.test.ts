import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";

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
