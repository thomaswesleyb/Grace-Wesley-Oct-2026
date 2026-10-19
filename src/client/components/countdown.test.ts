import { describe, expect, it } from "vitest";
import { remainingUntil } from "@client/components/Countdown.tsx";

describe("remainingUntil", () => {
  it("splits the gap into days, hours and minutes", () => {
    const now = Date.parse("2027-10-20T12:00:00Z");
    expect(remainingUntil(Date.parse("2027-10-23T22:30:59Z"), now)).toEqual({
      days: 3,
      hours: 10,
      minutes: 30,
    });
  });

  it("returns null once the moment has passed", () => {
    expect(remainingUntil(1000, 1000)).toBeNull();
    expect(remainingUntil(1000, 2000)).toBeNull();
  });
});
