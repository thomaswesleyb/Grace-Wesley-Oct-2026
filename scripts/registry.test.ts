import { describe, expect, it } from "vitest";
import { buildRegistryItems, buildRegistrySql, parsePriceCents, slugify } from "./registry.ts";

describe("buildRegistryItems", () => {
  it("reads the couple's CSV format and cleans links", () => {
    const items = buildRegistryItems(
      "Item,Price,Link\nEspresso Machine,700,https://shop.test/e?utm_source=g&gclid=1\nHigh Quality Luggage,1130,",
    );
    expect(items).toEqual([
      {
        id: "espresso-machine",
        name: "Espresso Machine",
        priceCents: 70000,
        link: "https://shop.test/e",
        image: null,
        description: null,
        sort: 0,
      },
      {
        id: "high-quality-luggage",
        name: "High Quality Luggage",
        priceCents: 113000,
        link: null,
        image: null,
        description: null,
        sort: 1,
      },
    ]);
  });

  it("accepts optional image and description columns", () => {
    const [item] = buildRegistryItems(
      'Item,Price,Link,Image,Description\nKettle,"$45.50",,public/registry/kettle.webp,For tea',
    );
    expect(item).toMatchObject({
      priceCents: 4550,
      image: "/registry/kettle.webp",
      description: "For tea",
    });
  });

  it("explains bad rows with the line number", () => {
    expect(() => buildRegistryItems("Item,Price\nA,1")).toThrow(/missing columns: link/);
    expect(() => buildRegistryItems("Item,Price,Link\nA,free,")).toThrow(/Line 2: price/);
    expect(() => buildRegistryItems("Item,Price,Link\n,10,")).toThrow(/Line 2: Item is required/);
    expect(() => buildRegistryItems("Item,Price,Link\nA,10,\na,20,")).toThrow(
      /Line 3: "a" duplicates line 2/,
    );
    expect(() => buildRegistryItems("Item,Price,Link\nA,10,nope")).toThrow(/Line 2: link/);
  });
});

describe("helpers", () => {
  it("slugifies names and parses prices", () => {
    expect(slugify("Crème Brûlée Torch!")).toBe("creme-brulee-torch");
    expect(parsePriceCents("$1,130.00", 2)).toBe(113000);
    expect(() => parsePriceCents("0", 2)).toThrow(/above zero/);
  });

  it("upserts so re-seeding updates items, escaping quotes", () => {
    const sql = buildRegistrySql(buildRegistryItems("Item,Price,Link\nGrace's Kettle,45,"));
    expect(sql).toContain("'Grace''s Kettle'");
    expect(sql).toContain("ON CONFLICT (id) DO UPDATE SET");
  });
});
