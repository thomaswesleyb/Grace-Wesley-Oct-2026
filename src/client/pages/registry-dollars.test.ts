import { describe, expect, it } from "vitest";
import { dollarsToCents } from "@client/pages/Registry.tsx";

describe("dollarsToCents", () => {
  it("reads typical amounts", () => {
    expect(dollarsToCents("50")).toBe(5000);
    expect(dollarsToCents(" $1,000.25 ")).toBe(100025);
    expect(dollarsToCents("19.9")).toBe(1990);
  });

  it("rejects anything that isn't dollars and cents", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e3"]) expect(dollarsToCents(bad)).toBeNaN();
  });
});
