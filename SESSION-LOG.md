# Session log

A record of how the site was planned and built, so later sessions (and later you) know what
was decided and why. Newest session first. Design decisions live in `wedding-design.md`, the
setup steps in `README.md`, and your step-by-step launch plan in `LAUNCH-TODO.md`.

---

## 2026-10-19 (later): Photos and Labyrinth pages

Both pages ship at the Oct 23 launch. Neither needs the backend or the database.

### Decisions (and why)

- **Labyrinth: a real maze in the shape of the Abbo's Alley labyrinth.** The real one is a
  classical 7-circuit brick labyrinth with a single path, which would make no puzzle. The game
  keeps the round 7-ring look and adds branches and dead ends.
  - The player chooses the fox or the deer; the other waits in the center, and reaching it ends
    the game. *Why:* one animal for each of you.
  - Each maze is random (a seeded depth-first search), so "Walk it again" gives a new one.
  - **Arrow keys on a circle.** Picking the passage nearest the pressed direction left some
    passages that no key could reach, which stranded the player (a test caught it). Now each
    cell has at most four passages (at most one leading outward), and each passage is paired
    with its own key.
- **Photos: the couple picks and describes every photo.** Originals go in `images/`
  with a `captions.csv`, and alt text is required for each one. `pnpm gen:gallery` makes the
  web copies (rotation fixed, location data stripped). No sepia toning: these are the couple's
  photos, not backdrops.
- **Intros come from DETAILS.md** (`Photos intro`, `Labyrinth intro`) and stay hidden until set.
- **Nav:** Home · Info · RSVP · Photos · Labyrinth · Registry. The links wrap onto a second line
  on phones.

### What was built

| Area | Where |
|---|---|
| Maze generation, movement and walls | `src/client/labyrinth/` (`maze.ts`, `walls.ts`, `animals.tsx`) |
| Labyrinth page | `src/client/pages/Labyrinth.tsx`, `labyrinth.css` |
| Photo pipeline | `scripts/gallery.ts`, `scripts/gen-gallery.ts`, `content/gallery.json` |
| Photos page and lightbox | `src/client/pages/Photos.tsx`, `photos.css` |

Tests: 125 (22 new). Breaking `move` so it ignored walls, removing the one-outward-passage rule,
and removing the key pairing each made a test fail.

---

## 2026-10-19: Planning and the first full build

Starting point: the repo held only `DETAILS.md`, `TEMPLATE.md`, the invitation image, and a
three-item `wedding-design.md`. By the end it had the full site running locally, with the
invitation home page, Q&A, RSVP, registry and admin, plus 103 passing tests.

### Decisions (and why)

**Launch scope**
- **Phased launch.** Oct 23, 2026: Home, Q&A and RSVP. The registry and payments follow once
  tested. *Why:* four days isn't enough to build and test payments, and guests won't need the
  registry for months.
- **RSVP at launch.** *Why:* the printed invitation tells guests to RSVP on the website.
- **Pages:** Home (the invitation), Q&A (travel and lodging included), RSVP, Registry. No Our
  Story or Travel page.

**Registry and payments**
- **Per-item cash funds.** Each item has its own progress bar and a "Contribute" button with an
  amount the guest chooses. The couple buys the items. $10 minimum, capped at the remaining
  balance, then "Fully gifted". Concurrent overfunding is accepted, and the bar caps at 100%.
- **Contributor details are private** (name, optional note, email). The public sees the bars and
  dollar amounts only.
- **Stripe Checkout + webhook.**
  - The couple compared every platform on cost. On the then-$1,830 registry:
    - Stripe: about $59–64 (2.9% + 30¢).
    - Honeyfund: $0 via gift cards, up to about $86 to a bank.
    - Zola: about $46.
    - PayPal: about $73–82.
  - Stripe won for real-time bars and a clean API.
  - **Accepted risk:** Stripe's terms (§1.2(a)(i)) exclude "personal, family, or household
    purposes", so the account could be reviewed or held.
  - Rejected: Honeyfund, Zola, The Knot and Joy (no API, so bars would need manual updates),
    PayPal (business account, higher fees, and its API forbids passing fees to the payer), and
    Venmo or Zelle (no API).

**RSVP**
- **Guest-list name lookup.** The guest gives their full first and last name. Matching ignores
  case and accents and tolerates a small typo (on longer names). It returns only that one
  invitation, is rate-limited, and has no autocomplete.
- **Grouped by invitation.** One person answers for everyone on their invitation.
- **Fields:**
  - Per person: attending and dietary needs.
  - Per invitation: email (required), song request and note.
  - Plus-one name: only where the guest list allows one.
- **Waves (decided during the build):**
  - The guest list is split into waves 1, 2 and 3 against a 90-seat target.
  - Unanswered seats count as taken (conservative). Admin also shows a forecast for
    information only.
  - The couple releases each invitation by hand with "Mark sent", helped by suggestions, and
    orders invitations within a wave with an optional `priority` column.
  - Each wave has its own deadline (now Mar 30, Jun 30 and Aug 30, 2027).
  - **Guests in an unsent wave get exactly the same "not found" reply as a stranger, and the
    wave number never reaches the browser.**
- **Edits:** allowed until the deadline through an emailed link. A decline can become an
  accept only while seats are open. The link-based edits are deferred to week 1, so at launch
  returning guests see "contact us to change".
- **Guest emails** (added later): an optional per-person `email` column for sending invitations
  by email in future. Admin-only, never returned by the RSVP lookup, and kept separate from the
  email guests type when they RSVP.

**Platform**
- **Hosting:** Cloudflare's free tier.
  - One Worker serves the React app and the API, with a D1 (SQLite) database.
  - Cloudflare Access protects `/admin` with an email one-time code.
  - Resend sends alerts.
  - Cost: $0 for hosting, plus the domain.
  - *Why not GitHub Pages or an Arduino:* GitHub Pages can't run server code or hold secrets,
    and an Arduino can't reliably do HTTPS or stay up.
  - Accepted free-tier gaps: 10 ms of CPU per request, a 7-day database undo window, no SLA.
- **Domain:** the cheapest registrars (Cloudflare, Porkbun, Dynadot) were compared and found to
  be within about $1 a year of each other. The couple has since bought the domain, and it uses
  Cloudflare nameservers.
- **Stack:** Vite, React, TypeScript, React Router, Hono, D1 with plain SQL, and zod. Node 22,
  pnpm 12, with pinned versions, a 24-hour release-age gate and install scripts blocked. Tools:
  oxlint (fails on warnings), oxfmt, vitest and prek.
- **Search engines:** `noindex` plus a robots.txt disallow.

**Design**
- **Home** is a faithful rebuild of the printed invitation:
  - The couple photo (`image0.png`) is toned to the print's exact sepia.
  - The lattice and filigree are traced from the invitation into SVG.
  - Every text line sits at the print's measured size and position, scaling with the card.
- **Fonts:** Playfair Display SC, plus UnifrakturMaguntia for the date and time. Four free
  blackletters were scored against the printed date, and Maguntia matched best. The print looks
  like Old English Text MT, a licensed font.
- **Page backgrounds:** one shared, toned treatment on every page.
  - Home: All Saints Chapel.
  - Q&A: Natural Bridge.
  - RSVP: Bridal Veil Falls (the replacement photo; the first had a photographer's watermark).
  - Registry: the Greens View overlook.

### What was built

| Area | Where |
|---|---|
| Invitation home page and ornaments | `src/client/pages/Home.tsx`, `home.css`, `public/ornaments/` |
| Shared page background | `src/client/components/Backdrop.tsx`, `src/client/styles.css` |
| Q&A built from DETAILS.md facts | `content/qa.ts`, `scripts/content.ts`, `scripts/gen-content.ts` |
| RSVP flow (find → respond → details → review → done) | `src/client/pages/Rsvp*.tsx`, `src/worker/rsvp.ts` |
| Name matching and seat math | `src/shared/names.ts`, `src/shared/capacity.ts` |
| Registry page and Stripe checkout/webhook | `src/client/pages/Registry.tsx`, `src/worker/registry.ts`, `src/worker/stripe.ts` |
| Admin (seats, invitations, gifts, CSV) | `src/client/pages/Admin.tsx`, `src/worker/admin.ts` |
| Database | `migrations/0001`–`0003` |
| Guest and registry loading | `scripts/seed-guests.ts`, `scripts/seed-registry.ts` |

### Things learned the hard way

- **The domain was unregistered** at first (2026-10-19). Now bought.
- `@cloudflare/vitest-pool-workers` is deprecated; the repo uses `@cloudflare/vitest-plugin`.
- pnpm 12 fails installs on ignored build scripts. `allowBuilds: { esbuild: false, workerd:
  false }` in `pnpm-workspace.yaml` keeps scripts blocked; both packages work without them.
- **The Cloudflare Vite plugin copies `.dev.vars` into `dist/`.** The admin bypass only works
  on localhost anyway, and `pnpm deploy` deletes the copy before uploading.
- oxlint exits 0 on warnings, which once hid about 20 warnings. `pnpm lint` now uses
  `--deny-warnings`.
- `DETAILS.md` needs IANA time zones (`America/Chicago`, not "Central Time") and labels exactly
  as in `TEMPLATE.md` (`RSVP deadline, wave 1:`). Otherwise deadlines were silently ignored.
- Deliberately breaking the code confirmed the tests catch it. One gap that turned up: a held
  guest's similar name could block a sent guest's typo match. There's now a test for it.

### Still open

- **Before launch:** everything in Part 1 of `LAUNCH-TODO.md` (Cloudflare database and domain,
  Resend, Access, guest list, deploy, smoke test).
- **Week 1:** email-link edits, Mark sent and next-to-send suggestions, the weekly CSV backup.
- **Registry go-live:** a Stripe account, item photos and descriptions, a registry intro, and
  the webhook and secrets. The Registry link is in the nav for preview; hide it before launch if
  Stripe isn't ready.
- **Missing facts in DETAILS.md:** reception details, the ceremony street address, dress code,
  lodging, parking, airports, kids and plus-one policies, and others (`pnpm gen` lists the
  hidden questions).
- **Phone nav** wraps to two lines (six links since the Photos and Labyrinth pages).
