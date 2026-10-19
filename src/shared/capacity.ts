/** A guest row on an invitation that has been sent. */
export interface CapacityGuest {
  id: string;
  attending: boolean | null;
  plusOneAllowed: boolean;
  plusOneOf: string | null;
}

export interface Capacity {
  target: number;
  confirmed: number;
  declined: number;
  /** Seats held for guests who haven't replied, including their allowed plus-ones. */
  pending: number;
  /** Conservative: target − confirmed − pending. Can go negative if overbooked. */
  open: number;
  /** Informational: confirmed + pending × the acceptance rate seen so far. */
  forecast: number;
}

/** Seats this guest holds as [confirmed, declined, pending]. */
function seatsFor(guest: CapacityGuest, claimedHosts: Set<string>): [number, number, number] {
  const holdsAllowance =
    guest.plusOneOf === null && guest.plusOneAllowed && !claimedHosts.has(guest.id);
  if (guest.attending === true) return [1, 0, 0];
  if (guest.attending === false) return [0, 1, 0];
  return [0, 0, holdsAllowance ? 2 : 1];
}

/**
 * Counts seats across sent invitations.
 *
 * An unanswered guest holds a seat, and so does their plus-one allowance. Once the guest
 * answers, the allowance turns into a confirmed plus-one row or frees up.
 */
export function computeCapacity(guests: CapacityGuest[], target: number): Capacity {
  const claimedHosts = new Set(guests.flatMap((g) => (g.plusOneOf === null ? [] : [g.plusOneOf])));
  let confirmed = 0;
  let declined = 0;
  let pending = 0;
  for (const guest of guests) {
    const [c, d, p] = seatsFor(guest, claimedHosts);
    confirmed += c;
    declined += d;
    pending += p;
  }
  const answered = confirmed + declined;
  const acceptRate = answered === 0 ? 1 : confirmed / answered;
  return {
    target,
    confirmed,
    declined,
    pending,
    open: target - confirmed - pending,
    forecast: Math.round(confirmed + pending * acceptRate),
  };
}
