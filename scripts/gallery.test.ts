import { describe, expect, it } from "vitest";
import { CAPTIONS_FILE, planGallery } from "./gallery.ts";

const CSV = `file,caption,alt
porch.jpg,On the porch,Grace and Wesley on a porch swing
"Bluff View.HEIC",,"Two people at an overlook, trees below"
`;

describe("planGallery", () => {
  it("returns nothing when there are no photos and no captions file", () => {
    expect(planGallery([], null)).toEqual([]);
    expect(planGallery([".DS_Store"], null)).toEqual([]);
  });

  it("follows the CSV order and makes web-safe names", () => {
    expect(planGallery(["Bluff View.HEIC", "porch.jpg", CAPTIONS_FILE], CSV)).toEqual([
      {
        file: "porch.jpg",
        slug: "porch",
        alt: "Grace and Wesley on a porch swing",
        caption: "On the porch",
      },
      {
        file: "Bluff View.HEIC",
        slug: "bluff-view",
        alt: "Two people at an overlook, trees below",
        caption: null,
      },
    ]);
  });

  it("requires a captions file once there are photos", () => {
    expect(() => planGallery(["porch.jpg"], null)).toThrow(/no captions\.csv/);
  });

  it("names every photo missing from the captions file", () => {
    expect(() => planGallery(["porch.jpg", "Bluff View.HEIC", "a.png", "b.webp"], CSV)).toThrow(
      /for: a\.png, b\.webp/,
    );
  });

  it("rejects rows without alt text, unknown files and duplicates", () => {
    expect(() => planGallery(["porch.jpg"], "file,caption,alt\nporch.jpg,Hi,\n")).toThrow(
      /line 2: "porch\.jpg" needs alt text/,
    );
    expect(() => planGallery(["porch.jpg"], "file,alt\nporch.jpg,A\nmissing.jpg,B\n")).toThrow(
      /line 3: no photo named "missing\.jpg"/,
    );
    expect(() => planGallery(["porch.jpg"], "file,alt\nporch.jpg,A\nporch.jpg,B\n")).toThrow(
      /listed twice/,
    );
  });

  it("rejects a CSV without the needed columns", () => {
    expect(() => planGallery(["porch.jpg"], "name,caption\nporch.jpg,Hi\n")).toThrow(
      /missing the "file" column/,
    );
  });

  it("rejects two photos whose names collide once made web-safe", () => {
    expect(() =>
      planGallery(["Porch.jpg", "porch.png"], "file,alt\nPorch.jpg,A\nporch.png,B\n"),
    ).toThrow(/both become "porch"/);
  });
});
