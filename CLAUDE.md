# CLAUDE.md — Grace & Wesley Wedding Website

This repo holds the content and design material for Grace Parkhill and Wesley Bailey's wedding
website, **parkhillbaileywedding.com**. Guests reach the site from the printed invitation to
read event details and RSVP.

## Key dates — don't mix these up

- **Wedding date: October 23, 2027, 5:00 pm.** Use this everywhere on the site.
- **Website launch: October 23, 2026.** The repo name (`Grace-Wesley-Oct-2026`) refers to the
  launch date, not the wedding. Never show 2026 to guests as the wedding date.

## Files and their roles

| File | Role | Edit? |
|------|------|-------|
| `DETAILS.md` | **Source of truth** for every wedding fact (names, pronouns, date, venues, links). | Yes, but only with facts the couple has confirmed |
| `TEMPLATE.md` | Placeholder schema (`{{ GROOM_FULL_NAME }}`, `{{ CEREMONY_VENUE_NAME }}`, …) listing every value the site needs, grouped by page. | Only to add or remove fields |
| `902C1C0C-…-DE2CB2E5FC43.jpeg` | The printed invitation. Shows wording and visual style, and backs up the facts in `DETAILS.md`. | Never |
| `wedding-design.md` | Empty for now. Use it for design decisions (palette, fonts, layout) when they're made. | Yes |

## Populating wedding data

1. **Take every couple-specific value from `DETAILS.md`**: Groom Name, Bride Name, pronouns,
   date, time, venues, addresses, registry and RSVP links, hotels, and so on. Don't hard-code a
   fact in site content when it isn't in `DETAILS.md`.
2. Use `TEMPLATE.md` as the checklist of required fields. Each `{{ PLACEHOLDER }}` corresponds
   to a value in `DETAILS.md`.
3. When a field has no value in `DETAILS.md`, **ask the user**. Never invent addresses, phone
   numbers, URLs, times, or story text. If you must leave a gap, keep the `{{ PLACEHOLDER }}`
   visible so it can't ship by accident. Don't fill it with something that looks real.
4. When the user gives you a new fact, record it in `DETAILS.md` first, then use it elsewhere.
   Keep `DETAILS.md` in the same `Label: value` format as `TEMPLATE.md`.
5. Use names as they appear on the invitation (**Grace A. Parkhill** and **T. Wesley Bailey**,
   bride listed first) for formal text. Use the short forms (Grace, Wesley) for casual text such
   as "Our Story".

### Still missing from `DETAILS.md`

Ask the user for these before building the pages that need them: reception venue, address and
time; the ceremony's street address; dress code; registry intro and URL; travel and lodging
(B&B, cabin, hotel); the wedding time zone; a contact for guests; and the RSVP deadline for each
wave.

## Design direction

Match the site to the invitation's look:

- **Palette:** dark sepia/espresso brown backgrounds, cream/ivory text, warm photo tint
- **Type:** small-caps serif for names and body text (Playfair Display SC style); blackletter
  (Old English/Fraktur style) for the date and time only
- **Ornament:** engraved filigree corner pieces and lattice side borders, in a vintage-formal
  style
- **Pages:** Home (invitation), Q&A (includes travel and lodging), RSVP, and Registry (phase 2)

Write design decisions to `wedding-design.md` so later sessions keep them consistent.

## Platform and repo structure

The site code lives in this repo. It's a **React frontend built like an enterprise app**, with
a **very light backend** (for example, for RSVP submissions). The site is not built on
Squarespace or Canva.

The approved plan: one Cloudflare Worker (free tier) serves the Vite + React + React Router
app and a Hono API, with data in D1. `/admin` sits behind Cloudflare Access. Payments (phase 2)
use Stripe Checkout. See `README.md` for commands and the one-time deploy steps.

- `src/client/` pages and components; `src/worker/` API; `src/shared/` zod schemas, name
  matching and capacity math shared by both; `scripts/` content generation and guest seeding;
  `content/qa.ts` Q&A definitions; `migrations/` D1 SQL.
- Site content comes only from `DETAILS.md` via `pnpm gen` → `content/details.json`
  (gitignored). Don't put wedding facts in components.
- Keep the backend minimal. Add server code only for things the frontend can't do on its own.
- Follow the global Node/TypeScript standards: Node 22 LTS, ESM, strict `tsconfig`, `oxlint`,
  `oxfmt`, `vitest`, pinned dependency versions, and `prek` hooks. `pnpm check` runs them all.
- RSVP waves: guests in unsent waves must get the same "not found" reply as strangers, and the
  wave must never reach the browser. Tests in `src/worker/rsvp.test.ts` guard this.

## Working conventions

- Use people's stated pronouns from `DETAILS.md`. For anyone else, use they/them unless told
  otherwise.
- Treat everything here as personal. Don't publish, upload, or share content (artifacts, gists,
  external services) without the user's explicit OK.
- Don't commit guest lists, phone numbers, or emails unless the user asks you to.
- **Never commit code, and don't offer or ask to.** The user makes all commits. The only
  exception is when the user explicitly asks you to commit, such as to resolve a merge
  conflict. That request covers that one commit only. Leave changes uncommitted in the working
  tree, and report what changed.
- Leave the invitation image unmodified.
