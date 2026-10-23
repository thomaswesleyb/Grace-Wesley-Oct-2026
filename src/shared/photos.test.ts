import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { copySizes, fitWithin, LARGE_EDGE, SMALL_WIDTH, sniffPhotoType } from "@shared/photos.ts";

describe("fitWithin", () => {
  it("shrinks to the tighter limit, keeping the shape", () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1600, 1600)).toEqual({
      width: 1600,
      height: 1200,
    });
    expect(fitWithin({ width: 3000, height: 4000 }, 1600, 1600)).toEqual({
      width: 1200,
      height: 1600,
    });
  });

  it("never enlarges", () => {
    expect(fitWithin({ width: 300, height: 200 }, 1600, 1600)).toEqual({ width: 300, height: 200 });
  });

  it("keeps a very thin photo at least 1 px", () => {
    expect(fitWithin({ width: 10000, height: 2 }, 1600, 1600)).toEqual({ width: 1600, height: 1 });
  });
});

describe("copySizes", () => {
  it("makes a small copy only for photos wider than SMALL_WIDTH", () => {
    expect(copySizes({ width: 4032, height: 3024 })).toEqual({
      large: { width: 1600, height: 1200 },
      small: { width: 800, height: 600 },
    });
    expect(copySizes({ width: 800, height: 1200 }).small).toBeNull();
  });

  it("always fits both copies within the limits the server checks", () => {
    const side = fc.integer({ min: 1, max: 20000 });
    fc.assert(
      fc.property(side, side, (width, height) => {
        const { large, small } = copySizes({ width, height });
        expect(Math.max(large.width, large.height)).toBeLessThanOrEqual(LARGE_EDGE);
        expect(Math.min(large.width, large.height)).toBeGreaterThanOrEqual(1);
        expect(small === null).toBe(large.width <= SMALL_WIDTH);
        if (small !== null) expect(small.width).toBe(SMALL_WIDTH);
      }),
    );
  });
});

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])),
  );

describe("sniffPhotoType", () => {
  it("recognises JPEG and WebP by their first bytes", () => {
    expect(sniffPhotoType(bytes(0xff, 0xd8, 0xff, 0xe1))).toBe("image/jpeg");
    expect(sniffPhotoType(bytes("RIFF", 1, 2, 3, 4, "WEBP"))).toBe("image/webp");
  });

  it("refuses anything else, including other RIFF files and short input", () => {
    expect(sniffPhotoType(bytes("RIFF", 1, 2, 3, 4, "WAVE"))).toBeNull();
    expect(sniffPhotoType(bytes(0x89, "PNG"))).toBeNull();
    expect(sniffPhotoType(bytes("<svg"))).toBeNull();
    expect(sniffPhotoType(bytes("RIFF"))).toBeNull();
    expect(sniffPhotoType(new Uint8Array())).toBeNull();
  });
});
