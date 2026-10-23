import { describe, expect, it } from "vitest";
import { planBackdrops } from "./backdrops.ts";

describe("planBackdrops", () => {
  it("lists only photos, in natural name order, with web-safe names", () => {
    expect(
      planBackdrops([
        "img10.jpg",
        "IMG_7865.JPG",
        "img2.png",
        "notes.txt",
        "x.jpg:Zone.Identifier",
      ]),
    ).toEqual([
      { file: "IMG_7865.JPG", slug: "img-7865" },
      { file: "img2.png", slug: "img2" },
      { file: "img10.jpg", slug: "img10" },
    ]);
  });

  it("returns nothing for an empty folder", () => {
    expect(planBackdrops([])).toEqual([]);
  });

  it("rejects two photos whose names collide once made web-safe", () => {
    expect(() => planBackdrops(["Chapel.jpg", "chapel.png"])).toThrow(/both become "chapel"/);
  });
});
