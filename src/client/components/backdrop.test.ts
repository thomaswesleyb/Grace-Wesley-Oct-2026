import { describe, expect, it } from "vitest";
import { pickBackdrop } from "@client/components/Backdrop.tsx";

const SOURCES = ["/a.webp", "/b.webp", "/c.webp"];

describe("pickBackdrop", () => {
  it("can pick any backdrop when there was none before", () => {
    expect(pickBackdrop(SOURCES, null, () => 0)).toBe("/a.webp");
    expect(pickBackdrop(SOURCES, null, () => 0.99)).toBe("/c.webp");
  });

  it("never repeats the previous backdrop when there's another", () => {
    for (const r of [0, 0.34, 0.67, 0.99]) {
      expect(pickBackdrop(SOURCES, "/b.webp", () => r)).not.toBe("/b.webp");
    }
    expect(pickBackdrop(["/a.webp", "/b.webp"], "/a.webp", () => 0)).toBe("/b.webp");
  });

  it("reuses the only backdrop, and returns null when there are none", () => {
    expect(pickBackdrop(["/a.webp"], "/a.webp", () => 0.5)).toBe("/a.webp");
    expect(pickBackdrop([], null, () => 0.5)).toBeNull();
  });
});
