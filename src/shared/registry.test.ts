import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  cleanRetailerLink,
  contributionProblem,
  formatDollars,
  percentFunded,
  remainingCents,
} from "@shared/registry.ts";

describe("progress", () => {
  it("never shows more than 100% or a negative remainder, even when overfunded", () => {
    expect(percentFunded(70000, 0)).toBe(0);
    expect(percentFunded(70000, 35000)).toBe(50);
    expect(percentFunded(70000, 90000)).toBe(100);
    expect(remainingCents(70000, 90000)).toBe(0);
  });
});

describe("contributionProblem", () => {
  it("accepts amounts from $10 up to what's left", () => {
    expect(contributionProblem(1000, 70000, 0)).toBeNull();
    expect(contributionProblem(70000, 70000, 0)).toBeNull();
  });

  it("rejects too little, too much, and non-cent amounts", () => {
    expect(contributionProblem(999, 70000, 0)).toMatch(/smallest gift is \$10/);
    expect(contributionProblem(60001, 70000, 10000)).toMatch(/still needs is \$600/);
    expect(contributionProblem(10.5, 70000, 0)).toMatch(/dollars and cents/);
    expect(contributionProblem(0, 70000, 0)).toMatch(/dollars and cents/);
  });

  it("lets the last few dollars be given even when under the minimum", () => {
    expect(contributionProblem(500, 70000, 69500)).toBeNull();
    expect(contributionProblem(400, 70000, 69500)).toMatch(/smallest gift is \$5/);
  });

  it("refuses gifts to a fully funded item", () => {
    expect(contributionProblem(1000, 70000, 70000)).toMatch(/fully given/);
  });

  it("never accepts an amount above the remaining balance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500000 }),
        fc.integer({ min: 0, max: 600000 }),
        fc.integer({ min: 1, max: 600000 }),
        (price, raised, amount) => {
          if (contributionProblem(amount, price, raised) === null) {
            expect(amount).toBeLessThanOrEqual(remainingCents(price, raised));
          }
        },
      ),
    );
  });
});

describe("formatDollars", () => {
  it("drops cents only when they're zero", () => {
    expect(formatDollars(113000)).toBe("$1,130");
    expect(formatDollars(2550)).toBe("$25.50");
  });
});

describe("cleanRetailerLink", () => {
  it("strips ad parameters but keeps the product variant", () => {
    const nobl =
      "https://nobltravel.com/products/carry-on-check-in?utm_source=google&utm_medium=product_sync&variant=51025307894060&tw_source=google&gad_source=1&gclid=abc";
    expect(cleanRetailerLink(nobl)).toBe(
      "https://nobltravel.com/products/carry-on-check-in?variant=51025307894060",
    );
    const crate =
      "https://www.crateandbarrel.com/x/s267619?a=1552&pla_sku=267619&pcat=HSW&ag=adult&storeid=609&gbraid=1";
    expect(cleanRetailerLink(crate)).toBe("https://www.crateandbarrel.com/x/s267619");
  });

  it("throws on something that isn't a URL", () => {
    expect(() => cleanRetailerLink("not a url")).toThrow();
  });
});
