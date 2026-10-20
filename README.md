# parkhillbaileywedding.com

Wedding site for Grace Parkhill and Wesley Bailey: the invitation, Q&A, RSVP, photos, and a
labyrinth maze game. It runs as one Cloudflare Worker (React app + small API) with a D1
database.

## Commands

Requires Node 22 (`nvm use 22`) and pnpm 12.

| Command | What it does |
|---|---|
| `pnpm install` | Install pinned dependencies (install scripts blocked) |
| `pnpm dev` | Local site + API at http://localhost:5173 (local D1) |
| `pnpm gen` | Rebuild `content/details.json` from `DETAILS.md`; lists hidden Q&A entries |
| `pnpm gen:gallery` | Make web copies of `images/` (listed in its `captions.csv`) and rebuild `content/gallery.json`; needs ImageMagick |
| `pnpm check` | Lint, format check, type check, tests |
| `pnpm db:migrate:local` / `db:migrate:remote` | Apply `migrations/` to the local or production database |
| `pnpm seed:guests <file.csv> --local\|--remote [--release-wave 1]` | Load the guest list |
| `pnpm seed:registry --local\|--remote [file.csv]` | Load or update registry items (default `wedding-registry.csv`) |
| `pnpm deploy` | Build and deploy to Cloudflare |

Site facts come from `DETAILS.md`. Edit it, then run `pnpm gen` (dev and build run it for you).

## Guest list

CSV columns: `invitation,first_name,last_name,plus_one_allowed,wave,priority`, plus an optional
`email` column.

- One row per person. Rows sharing an `invitation` value are answered together. A blank
  `invitation` makes a solo invitation named after the guest.
- `plus_one_allowed`: yes/no. `wave`: 1, 2 or 3. `priority`: optional, 1 = send first.
- `email`: optional, one per person, for emailing invitations later. Blank is fine (kids, no
  address yet). It shows in admin and the CSV export as `invite_email`, and never on the RSVP
  page. It's separate from the email guests type when they RSVP (`rsvp_email`).
- Keep the file outside git. Names matching `guests*.csv` are gitignored and blocked by the hook.
- Seeding refuses to run if the database already has invitations, so it can't duplicate guests.
- Only invitations marked sent can be found on the RSVP page. Everyone else, held waves included,
  gets the same "we couldn't find that name" reply.

Wave deadlines come from `RSVP deadline, wave N: March 1, 2027` lines in `DETAILS.md`.

## Registry

`wedding-registry.csv` columns: `Item,Price,Link`, plus optional `Image` (a path under `public/`,
e.g. `registry/espresso.webp`) and `Description`. Re-run `pnpm seed:registry` after editing; items
are matched by name, so gifts already given stay attached. Ad-tracking parameters are stripped
from links.

Guests give through Stripe Checkout. A gift counts toward its bar only after Stripe's webhook
confirms payment. Contributions are $10 minimum (or whatever is left, if less) and capped at the
remaining balance. Until `STRIPE_SECRET_KEY` is set, the page shows "Gifts open soon" and the
Contribute buttons are disabled.

To hide the page before launch, remove the Registry link in `src/client/components/Layout.tsx`
(the route in `src/client/main.tsx` can stay).

## First deploy (one time)

1. Register `parkhillbaileywedding.com` (Cloudflare Registrar) and add it to the Cloudflare account.
2. `pnpm exec wrangler login`
3. `pnpm exec wrangler d1 create wedding`, then paste the printed `database_id` into
   `wrangler.jsonc`.
4. `pnpm db:migrate:remote`
5. `pnpm seed:guests path/to/guests.csv --remote --release-wave 1`
6. `pnpm deploy`, then attach the custom domain to the Worker in the Cloudflare dashboard.
7. **Protect admin:** Zero Trust → Access → Applications → self-hosted app for
   `parkhillbaileywedding.com/admin*` and `parkhillbaileywedding.com/api/admin*`, policy "Emails"
   with your two addresses. Copy the team domain and the app's AUD tag into `ACCESS_TEAM_DOMAIN`
   and `ACCESS_AUD` in `wrangler.jsonc`, then deploy again. Until both are set, admin returns 503.
8. **RSVP alerts (optional):** verify the domain in Resend, set `ALERT_TO` and `ALERT_FROM` in
   `wrangler.jsonc`, and run `pnpm exec wrangler secret put RESEND_API_KEY`. Without them,
   alerts are skipped and logged.

9. **Registry payments:** in the Stripe dashboard, add a webhook endpoint for
   `https://parkhillbaileywedding.com/api/stripe/webhook` with the events
   `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Then run
   `pnpm exec wrangler secret put STRIPE_SECRET_KEY` and
   `pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET` (the endpoint's signing secret), and
   `pnpm seed:registry --remote`. To try it locally with test cards, put test-mode keys in
   `.dev.vars` and forward events with `stripe listen --forward-to localhost:5173/api/stripe/webhook`.

## Local admin

`.dev.vars` (gitignored) with `ADMIN_DEV_BYPASS=1` skips the Access check, and only for
requests to `localhost`. The deploy script deletes the copy the build makes of this file.
