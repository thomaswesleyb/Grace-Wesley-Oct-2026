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
| `pnpm seed:guests --local\|--remote [file.csv]` | Load or update the guest list (default `guest-list.csv`) |
| `pnpm seed:registry --local\|--remote [file.csv]` | Load or update registry items (default `wedding-registry.csv`) |
| `pnpm deploy` | Build and deploy to Cloudflare |

Site facts come from `DETAILS.md`. Edit it, then run `pnpm gen` (dev and build run it for you).

## RSVP

Guests find their own name on the guest list, then answer for up to their number of places.

- The guest list is `guest-list.csv` (gitignored; the commit hook blocks it). Columns:
  `firstname,lastname,total_guest_spots`, plus an optional `aliases` column of other names
  separated by `;` (`Bill; Will Smith-Jones`). A one-word alias is a first name and takes the
  guest's last name. `total_guest_spots` is the most people on that guest's RSVP, themselves
  included (0 to 6). 0 means invited but can't attend, and looking them up says "not found".
- `pnpm seed:guests --local|--remote` loads it. It checks every row first and changes nothing if
  any is wrong. It's safe to re-run after edits, since guests are matched by name. It refuses to
  drop a guest who has answered: to rename one, keep the old spelling and add the new one as an
  alias.
- Lookup ignores case, accents, punctuation and hyphens. It allows 1 typo in names of 8 to 13
  characters and 2 typos from 14, and knows common nicknames (`src/shared/nicknames.ts`). A name
  that two guests match equally well is "not found" rather than a guess.
- The server checks the guest and the party size on every submit. The listed guest is always
  saved under their name from the list. Lookups and submits share a limit of 10 a minute per IP
  address.
- Sending again replaces the guest's earlier RSVP. Admin keeps the old one (marked "Replaced"),
  totals count only current answers, and the alert subject says "(changed)".
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
5. `pnpm seed:guests --remote` to load `guest-list.csv`.
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
