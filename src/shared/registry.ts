export const MIN_CONTRIBUTION_CENTS = 1000;
/** Highest price an item can have, and the most one gift to an open fund can be: $100,000. */
export const MAX_PRICE_CENTS = 10_000_000;
/** Longest side of an item's picture. Cards show it at most 12rem square. */
export const REGISTRY_IMAGE_EDGE = 800;
/** Upload limit for an item's picture, already resized in the browser. */
export const MAX_REGISTRY_IMAGE_BYTES = 2 * 1024 * 1024;

/** "50", "50.5", "$1,000.25" → cents; NaN when it isn't a dollar amount. */
export function dollarsToCents(input: string): number {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

/**
 * The most one more gift can be: what's left of the price, or MAX_PRICE_CENTS for an open fund
 * (`priceCents` null), which never fills up.
 */
export function remainingCents(priceCents: number | null, raisedCents: number): number {
  if (priceCents === null) return MAX_PRICE_CENTS;
  return Math.max(0, priceCents - raisedCents);
}

/** Whole percent funded, capped at 100 so concurrent overfunding never overflows the bar. */
export function percentFunded(priceCents: number, raisedCents: number): number {
  if (priceCents <= 0) return 0;
  return Math.min(100, Math.floor((raisedCents / priceCents) * 100));
}

/**
 * Why a contribution can't be accepted, or null if it can.
 *
 * The cap is the remaining balance, or MAX_PRICE_CENTS for an open fund. When less than the
 * minimum remains, that remainder is the only amount accepted, so an item can always be finished.
 */
export function contributionProblem(
  amountCents: number,
  priceCents: number | null,
  raisedCents: number,
): string | null {
  const remaining = remainingCents(priceCents, raisedCents);
  if (remaining === 0) return "This gift has been fully given. Thank you!";
  if (!Number.isInteger(amountCents) || amountCents <= 0)
    return "Please enter an amount in dollars and cents.";
  if (amountCents > remaining) {
    return priceCents === null
      ? `The most one gift can be is ${formatDollars(remaining)}.`
      : `The most this gift still needs is ${formatDollars(remaining)}.`;
  }
  const minimum = Math.min(MIN_CONTRIBUTION_CENTS, remaining);
  if (amountCents < minimum) return `The smallest gift is ${formatDollars(minimum)}.`;
  return null;
}

export function formatDollars(cents: number): string {
  const options = { style: "currency", currency: "USD" } as const;
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat(
    "en-US",
    whole ? { ...options, maximumFractionDigits: 0 } : options,
  ).format(cents / 100);
}

const TRACKING_PARAM =
  /^(utm_.+|gclid|gclsrc|gbraid|wbraid|gad_.+|fbclid|msclkid|tw_.+|pla_.+|campaignid|adgroupid|adpos|creative|device|matchtype|network|targetid|storeid|ag|a|pcat)$/i;

/** Drops ad and analytics parameters from a store link, keeping ones that pick a product variant. */
export function cleanRetailerLink(raw: string): string {
  const url = new URL(raw);
  for (const key of Array.from(url.searchParams.keys())) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}
