import { describe, expect, it } from "vitest";
import { CAPTIONS_FILE, planGallery } from "./gallery.ts";

const CSV = `file,caption,alt
porch.jpg,On the porch,Grace and Wesley on a porch swing
"Bluff View.HEIC",,"Two people at an overlook, trees below"
`;

const files = (plan: ReturnType<typeof planGallery>) => plan.photos.map((p) => p.file);

describe("planGallery", () => {
  it("returns nothing when there are no photos", () => {
    expect(planGallery([], null)).toEqual({ photos: [], warnings: [] });
    expect(planGallery([".DS_Store", CAPTIONS_FILE], CSV).photos).toEqual([]);
  });

  it("shows every photo without a captions file, in natural name order", () => {
    const plan = planGallery(["b-15.jpg", "B-6.jpg", "a.png", "notes.txt"], null);
    expect(plan.photos).toEqual([
      { file: "a.png", slug: "a", alt: "Photo 1 of 3", caption: null },
      { file: "B-6.jpg", slug: "b-6", alt: "Photo 2 of 3", caption: null },
      { file: "b-15.jpg", slug: "b-15", alt: "Photo 3 of 3", caption: null },
    ]);
  });

  it("puts captioned photos first, in CSV order, then the rest by name", () => {
    const plan = planGallery(["z.jpg", "Bluff View.HEIC", "porch.jpg", "a.jpg"], CSV);
    expect(plan.photos).toEqual([
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
      { file: "a.jpg", slug: "a", alt: "Photo 3 of 4", caption: null },
      { file: "z.jpg", slug: "z", alt: "Photo 4 of 4", caption: null },
    ]);
  });

  it("keeps a row's order and caption when its alt text is blank", () => {
    const plan = planGallery(["a.jpg", "b.jpg"], "file,caption,alt\nb.jpg,Hi,\n");
    expect(files(plan)).toEqual(["b.jpg", "a.jpg"]);
    expect(plan.photos[0]).toMatchObject({ alt: "Photo 1 of 2", caption: "Hi" });
  });

  it("skips a row for a photo that was removed, with a warning", () => {
    const plan = planGallery(["porch.jpg"], "file,alt\nporch.jpg,A\ngone.jpg,B\n");
    expect(files(plan)).toEqual(["porch.jpg"]);
    expect(plan.warnings).toEqual([`${CAPTIONS_FILE} line 3: no photo named "gone.jpg"; skipped.`]);
  });

  it("rejects a photo listed twice", () => {
    expect(() => planGallery(["porch.jpg"], "file,alt\nporch.jpg,A\nporch.jpg,B\n")).toThrow(
      /line 3: "porch\.jpg" is listed twice/,
    );
  });

  it("rejects a CSV without the needed columns", () => {
    expect(() => planGallery(["porch.jpg"], "name,caption\nporch.jpg,Hi\n")).toThrow(
      /missing the "file" column/,
    );
  });

  it("rejects two photos whose names collide once made web-safe", () => {
    expect(() => planGallery(["Porch.jpg", "porch.png"], null)).toThrow(/both become "porch"/);
  });
});
