export interface Env {
  DB: D1Database;
  /** Both copies of every photo, under `<photo id>/large` and `<photo id>/small`. */
  PHOTOS: R2Bucket;
  /** Per-IP limit on RSVP name lookups and submissions. */
  RSVP_LIMITER: RateLimit;
  /** Per-IP limit on guests' photo uploads. */
  PHOTO_LIMITER: RateLimit;
  /** Per-guest limit on saving labyrinth times. */
  LABYRINTH_LIMITER: RateLimit;
  /** Cloudflare Access team domain, e.g. "parkhillbailey.cloudflareaccess.com". */
  ACCESS_TEAM_DOMAIN: string;
  /** Cloudflare Access application audience (AUD) tag for /admin. */
  ACCESS_AUD: string;
  /** Local development only: "1" skips the Access check, and only for localhost requests. */
  ADMIN_DEV_BYPASS?: string;
  /** Resend API key (secret). Alerts are skipped with a logged warning when unset. */
  RESEND_API_KEY?: string;
  /** Stripe secret key (secret). Gifts are refused with a friendly message when unset. */
  STRIPE_SECRET_KEY?: string;
  /** Signing secret of the Stripe webhook endpoint for /api/stripe/webhook (secret). */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Comma-separated addresses that receive RSVP and gift alerts. */
  ALERT_TO: string;
  /** Verified Resend sender, e.g. "RSVP <rsvp@parkhillbaileywedding.com>". */
  ALERT_FROM: string;
}
