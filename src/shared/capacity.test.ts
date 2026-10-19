import { describe, expect, it } from "vitest";
import { computeCapacity, type CapacityGuest } from "@shared/capacity.ts";

const guest = (
  id: string,
  attending: boolean | null,
  extra: Partial<CapacityGuest> = {},
): CapacityGuest => ({
  id,
  attending,
  plusOneAllowed: false,
  plusOneOf: null,
  ...extra,
});

describe("computeCapacity", () => {
  it("starts with every seat open", () => {
    expect(computeCapacity([], 90)).toEqual({
      target: 90,
      confirmed: 0,
      declined: 0,
      pending: 0,
      open: 90,
      forecast: 0,
    });
  });

  it("holds a seat for each unanswered guest and their plus-one allowance", () => {
    const result = computeCapacity(
      [guest("a", null, { plusOneAllowed: true }), guest("b", null)],
      90,
    );
    expect(result.pending).toBe(3);
    expect(result.open).toBe(87);
  });

  it("frees the allowance when the guest answers without bringing anyone", () => {
    const result = computeCapacity([guest("a", true, { plusOneAllowed: true })], 90);
    expect(result).toMatchObject({ confirmed: 1, pending: 0, open: 89 });
  });

  it("counts a named plus-one as confirmed instead of pending", () => {
    const result = computeCapacity(
      [guest("a", true, { plusOneAllowed: true }), guest("p", true, { plusOneOf: "a" })],
      90,
    );
    expect(result).toMatchObject({ confirmed: 2, pending: 0, open: 88 });
  });

  it("frees the seats of declined guests", () => {
    const result = computeCapacity(
      [guest("a", false, { plusOneAllowed: true }), guest("b", false)],
      2,
    );
    expect(result).toMatchObject({ declined: 2, pending: 0, open: 2 });
  });

  it("goes negative when overbooked", () => {
    expect(computeCapacity([guest("a", true), guest("b", true)], 1).open).toBe(-1);
  });

  it("forecasts from the acceptance rate so far", () => {
    const guests = [
      guest("a", true),
      guest("b", false),
      ...["c", "d", "e", "f"].map((id) => guest(id, null)),
    ];
    expect(computeCapacity(guests, 90).forecast).toBe(3);
  });
});
