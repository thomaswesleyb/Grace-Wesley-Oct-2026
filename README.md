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
| `pnpm gen:gallery` | Make web copies of every photo in `images/` and rebuild `content/gallery.json` (`dev` and `build` run it too); needs ImageMagick. Optional `images/captions.csv` (`file,caption,alt`) adds captions, descriptions and order |
| `pnpm gen:backdrops` | Make blurred-backdrop copies of every photo in `background-images/` and rebuild `content/backdrops.json` (`dev` and `build` run it too). Every page except Home and admin picks one at random |
| `pnpm check` | Lint, format check, type check, tests |
| `pnpm db:migrate:local` / `db:migrate:remote` | Apply `migrations/` to the local or production database |
| `pnpm seed:registry --local\|--remote [file.csv]` | Load or update registry items (default `wedding-registry.csv`) |
| `pnpm deploy` | Build and deploy to Cloudflare |

Site facts come from `DETAILS.md`. Edit it, then run `pnpm gen` (dev and build run it for you).

## RSVP

Guests unlock the RSVP form with a shared code. There's no guest list on the site.

- The code is the `RSVP_CODE` secret (`pnpm exec wrangler secret put RSVP_CODE`; locally, a
  `RSVP_CODE=…` line in `.dev.vars`). It never reaches the browser or the repo. Case, spaces,
  dashes, slashes and dots are ignored, so `10/23/2027` matches `10232027`. While it's unset,
  every RSVP is refused with "RSVPs aren't open yet."
- The server checks the code when the form is unlocked and again on submit. Both share a limit
  of 10 tries a minute per IP address.
- One form covers up to 6 people: name, accept or decline, and dietary needs for each, plus an
  email, song request and note. Each submission is saved and emailed to `ALERT_TO`.
- Nothing stops a household from sending twice. Admin lists every submission, newest first.
- To close RSVPs, set `rsvp_open` to `0`:
  `pnpm exec wrangler d1 execute wedding --remote --command "UPDATE settings SET value = '0' WHERE key = 'rsvp_open'"`.

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
5. `pnpm exec wrangler secret put RSVP_CODE`, and type the code when asked.
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
