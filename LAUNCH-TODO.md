# Launch to-do: parkhillbaileywedding.com

Start: the domain is bought (it already uses Cloudflare nameservers), and the site runs locally.
Launch: **Friday, October 23, 2026**. Work top to bottom. Each step has:

- **What it is:** the tool or thing the step is about.
- **Why:** what it's for, and what breaks without it.
- The tasks for you, then the prompt to give Claude to carry on.

**Rules for every step**

- Never paste a secret (API key, signing secret) into the chat. When a step needs one, type the
  command with a `!` in front (e.g. `! pnpm exec wrangler secret put STRIPE_SECRET_KEY`). It runs
  in the terminal and asks for the value without the chat ever seeing it.
- Claude doesn't commit. You commit whenever you like, at minimum where a step says so.
- Keep any guest list you make for yourselves outside the repo, or name it `guests….csv`
  (gitignored and blocked by the commit hook). The site doesn't use one.

---

## Where things stand (as of Thu, Oct 22, evening)

**Live:** the site at parkhillbaileywedding.com and www, the production database, Resend alerts,
and Access on `/admin`. The Registry link is hidden.

**Deployed Oct 22 (not yet committed):** the RSVP now works from the guest list instead of a
shared code. Guests find their own name, and each can answer for up to their
`total_guest_spots`. Production has migration 0005 and all 59 guests (94 places).

**Built Oct 22, not deployed:** guest sessions (an RSVP signs the guest in for Labyrinth times,
the leaderboard and photo credit). Needs `! pnpm db:migrate:remote` (migration 0008), then `! pnpm deploy`.

**Built Oct 23, not deployed:** every Q&A question is editable on `/admin/questions`, including
the `DETAILS.md` ones. Needs `! pnpm db:migrate:remote` (migration 0009), then `! pnpm deploy`.

**Left before invitations go out:**

1. Commit and push the guest-list RSVP work.
2. Delete the old code secret (step 11).
3. Smoke-test with a real name (step 12). Review the guest list (step 5) any time, then reseed.
4. Optional: fill in `DETAILS.md` (step 3). Only 4 of 18 Q&A answers show.
5. Install prek (step 1).

**Decide:** the GitHub repo `thomaswesleyb/Grace-Wesley-Oct-2026` is **public**, and
`background-images/IMG_7865.JPG` in it still has GPS location data. Making the repo private
fixes both: GitHub → Settings → Danger Zone → Change visibility.

---

## Part 1: Before launch (Oct 19–22)

### 1. Save the current work

**What it is:** *Git* records snapshots ("commits") of the code. *GitHub* stores a copy online.
*prek* is a fast tool (written in Rust) that runs checks automatically every time you commit.
Here those are the linter, the formatter, the type checker, and a block on committing guest-list
files. It reads the same `.pre-commit-config.yaml` format as the older `pre-commit` tool.

**Why:** everything built so far exists only in this folder. Committing and pushing means a lost
laptop doesn't mean a lost website. prek stops a broken change or a guest list from being
committed by accident.

- [x] Review the changes (`git status`), commit them on the `template` branch, and push.
- [ ] Install prek (see its README), then run `prek install` in the repo.

> Prompt: *none, this one is yours.*

### 2. Confirm the domain in Cloudflare

**What it is:** *Cloudflare* is the free hosting platform the site runs on. A domain's
*nameservers* say which company answers "where is this website?" for it. Yours already point at
Cloudflare. *Active* in the dashboard means Cloudflare has confirmed it controls the domain's DNS.
*Auto-renew* is a setting at the registrar (the company you bought the domain from).

**Why:** the site can only be attached to a domain that is Active on the same Cloudflare account
you deploy from. Auto-renew matters because the printed invitations carry this address for a
year. If it lapsed, someone else could buy it.

- [ ] Log in at dash.cloudflare.com and check that **parkhillbaileywedding.com** shows as
      **Active** on the account you'll deploy from.
- [ ] Turn on **auto-renew** for the domain at your registrar.

> Prompt: *none.*

### 3. Fill in the wedding facts

**What it is:** `DETAILS.md` is the single source of every wedding fact on the site. Lines look
like `Label: value`, and `TEMPLATE.md` lists every label the site understands. A script turns
the file into the site's content.

**Why:** the site never invents facts. A Q&A question stays hidden until its answer is in
`DETAILS.md`, so right now only 4 of 18 show. Guests will look for travel, lodging and dress-code
answers first.

- [ ] Add every fact you know to `DETAILS.md`. The ones that matter most to guests:
      `Nearest airports`, `Parking`, `Lodging recommendations`, `Hotel room block`,
      `Dress code`, `Guest arrival time`, `Children policy`, `Plus-one policy`,
      `Indoor or outdoor`, `Accessibility`, and the reception venue, address and time.
- [ ] Optional now, needed for the registry later: `Registry intro`.

> Prompt: **"I updated DETAILS.md. Regenerate the content, tell me which Q&A questions are still
> hidden, and check that every new line parses."**

### 4. Add your photos

**What it is:** the Photos page shows your engagement photos and any other pictures you add.
*R2* is Cloudflare's file storage (free up to 10 GB); the photos live there, so adding one
needs no deploy. You add them by dragging them onto `/admin/photos`.

**Why:** the page says "Photos coming soon" until there are photos. Captions and alt text come
only from you. Alt text is a short description of each photo that screen readers read aloud to
guests who can't see it. Photos you haven't described are read as "Photo 12 of 32".

- [x] Pick the photos. 20 are on the site today (built in, from `images/`).
- [ ] Move them to R2 (one time): `! pnpm exec wrangler r2 bucket create wedding-photos`, then
      `! pnpm db:migrate:remote`, `! pnpm photos:import --remote`, and `! pnpm deploy`.
- [ ] After that, `content/gallery.json`, `public/photos/gallery/`, `scripts/import-gallery.ts`
      and its `photos:import` script can be deleted. `images/` isn't used by the site any more.
- [ ] Optional: add captions and descriptions on `/admin/photos`.
- [ ] Optional: add `Photos intro: …` and `Labyrinth intro: …` to `DETAILS.md`.
- [ ] After the wedding: press "Open guest sharing" on `/admin/photos`, and approve guests'
      photos there as they arrive.

> Prompt: **"Move the photos to R2 and deploy."**

### 5. Review the guest list

**What it is:** `guest-list.csv` (in the repo folder, never committed) lists every guest:
`firstname,lastname,total_guest_spots`, and optionally `aliases`. A guest's spots is the most
people their RSVP can include, themselves included. 0 means invited but can't attend.

**Why:** a guest who isn't on the list, or is listed under a name they won't type, can't RSVP.
They see your contact address instead. Typos, accents, hyphens and common nicknames (Bob/Robert,
Liz/Elizabeth…) already match, so aliases are only for other names: maiden names, unusual
nicknames, a name they go by.

- [ ] Check each name is spelled as on the envelope, and each spots number is right.
- [ ] Optional: add an `aliases` column. Separate names with `;`. A single word is a first name
      (`Bill`), and anything longer is a full name (`Jane Doe-Smith`).

> Prompt: **"I updated guest-list.csv. Check it and reseed locally."**

### 6. Connect Wrangler to Cloudflare

**What it is:** *Wrangler* is Cloudflare's command-line tool for deploying and managing the site.
*D1* is Cloudflare's database, which stores RSVPs and gifts. *Migrations* are the
SQL files in `migrations/` that create its tables. A *custom domain* tells Cloudflare to serve
the site at your address instead of a `workers.dev` one.

**Why:** so far the database only exists on this laptop. Logging in lets Claude create the real
one and point both `parkhillbaileywedding.com` and `www.` at the site. Cloudflare then issues
the HTTPS certificate automatically.

- [ ] Run: `! pnpm exec wrangler login` and approve it in the browser.

> Prompt: **"Wrangler is logged in. Create the production D1 database, put its ID in
> wrangler.jsonc, apply all migrations to it, and attach parkhillbaileywedding.com and
> www.parkhillbaileywedding.com as custom domains for the Worker."**

### 7. Set up email alerts (Resend)

**What it is:** *Resend* is an email-sending service (free up to 3,000 emails a month). A
*sending domain* proves to inbox providers that mail "from" your domain really comes from you.
You prove it with DNS records Resend gives you. An *API key* is the password the site uses to
send through Resend, stored as a Cloudflare *secret* (encrypted, never in the code).

**Why:** the site emails you each time someone RSVPs (with everyone's answers) or gives a
gift. Without a verified domain those emails land in spam or are refused. Every RSVP is also
saved in admin, so a lost email doesn't lose the RSVP.

- [x] Alerts go to `parkhill.bailey.wedding@gmail.com` from
      `RSVP <rsvp@parkhillbaileywedding.com>` (set in `wrangler.jsonc` on Oct 21).
- [ ] Create a free account at resend.com and add **parkhillbaileywedding.com** as a sending
      domain. Add the DNS records Resend lists in Cloudflare → DNS, then wait until Resend shows
      the domain as verified.
- [ ] Create an API key with "Sending access" for that domain only, then run:
      `! pnpm exec wrangler secret put RESEND_API_KEY`

> Prompt: **"Resend is verified and the key is set. Deploy, then send a test RSVP and check
> that the alert arrives."**

### 8. Protect the admin page (Cloudflare Access)

**What it is:** *Cloudflare Access* (part of the free *Zero Trust* plan) puts a login in front
of chosen pages. Visitors get a one-time code by email, and only the addresses you list get in.
The *team domain* identifies your Access account. The *AUD tag* identifies this one protected
app. The site checks both on every admin request.

**Why:** `/admin` shows every RSVP's names, answers, dietary needs, emails, and gifts. Until
Access is set up, the live admin page refuses to open at all. That's deliberate: it's locked
rather than left exposed.

- [x] Cloudflare dashboard → **Zero Trust**. Pick a team name and the free plan (it may ask for
      a card even on the free plan).
- [x] Access → Applications → **Add a self-hosted application** covering
      `parkhillbaileywedding.com/admin` and `parkhillbaileywedding.com/api/admin`. Policy: Allow,
      Emails = your two addresses.
- [x] Copy the **team domain** (`<team>.cloudflareaccess.com`) and the app's **Application
      Audience (AUD) tag**. Neither is secret.

> Done Oct 21: team `parkhillbailey`, admin at https://parkhillbaileywedding.com/admin. The AUD tag is
> the 64-character `aud` value, not the 32-character application ID.

### 9. Decide whether the registry shows at launch

**What it is:** the Registry page lists your gift items with progress bars. Guests pay through
*Stripe* (see Part 3).

**Why:** until Stripe is connected the page can't take gifts. It shows "Gifts open soon" with
disabled buttons, so you choose whether guests see it on day one.

- [ ] Decide: show it now as a preview, or hide it until Part 3.

> Prompt (to hide it): **"Hide the Registry link from the navigation for launch."**

### 10. First deploy

**What it is:** *deploying* builds the site and uploads it to Cloudflare, which then serves it
worldwide at your domain.

**Why:** this is the moment the site goes public. Checking it on a real phone, and confirming
admin refuses a stranger, catches problems before any guest sees them.

> Prompt: **"Deploy to production."**

- [ ] Open https://parkhillbaileywedding.com on your phone and laptop. Check the invitation,
      Q&A, RSVP, Photos and Labyrinth pages (play the maze once on the phone).
- [ ] Open https://parkhillbaileywedding.com/admin. It should ask for your email and send a
      code, and a different email should be refused.

### 11. Load the guest list and deploy

**What it is:** migration `0005` adds the guest tables. `pnpm seed:guests --remote` copies
`guest-list.csv` into the production database. It's safe to run again whenever the list changes,
and it never drops a guest who has answered.

**Why:** until the list is loaded, every name is "not found".

> Done Oct 22: migrated, seeded (59 guests) and deployed. A made-up name says "not found", a
> real one shows its places, and the old `/api/rsvp/unlock` route is gone.

- [ ] Afterwards, delete the old code secret: `! pnpm exec wrangler secret delete RSVP_CODE`.
- [x] On the live RSVP page, a made-up name should say "not found", and a real one should show
      that guest's number of places.

### 12. Test a real RSVP end to end

**What it is:** a *smoke test*: one real RSVP through the live site under the name "Test
Guest".

**Why:** it proves the whole chain works on the real setup: the name lookup, saving, the admin view,
and the alert email. Deleting it afterwards keeps your counts accurate.

- [ ] RSVP under one of your own names on the list. Check that the alert email arrives and
      the response shows in admin, then delete it there (Delete → Yes, delete).

- [ ] Commit and push everything.

---

## Part 2: Launch and the first week (Oct 23–30)

### 13. Launch day

**What it is:** sending the invitations, which point guests to the site, along with the RSVP
code.

**Why:** RSVPs start arriving immediately. Watching admin and the alert emails on day one means
any problem shows up after a handful of guests, not after everyone.

- [ ] Send the invitations.
- [ ] Watch `/admin` and the alert emails as the first RSVPs arrive.

> Prompt (if anything looks wrong): **"A guest says <what happened>. Find out why."**

### 14. Add the weekly backup

**What it is:** a *weekly CSV backup* keeps a copy of the RSVPs beyond the database's 7-day
undo window. It was held back to make the launch date.

**Why:** the alert emails already give you a copy of each RSVP. The backup covers the case
where an email was missed and the database is damaged.

> Prompt: **"Build the weekly CSV backup of RSVPs."**

---

## Part 3: Registry go-live (whenever you're ready)

### 15. Registry content

**What it is:** `/admin/registry` is where you add each gift: name, short description, cost, a
link to the item, and an optional picture. Items show on the Registry page as soon as you save
them. It needs migration `0010` in production first: `! pnpm db:migrate:remote`, then
`! pnpm deploy`.

**Why:** photos and a line of description make the cards inviting and show guests what they're
contributing toward. The intro line also turns on the "Do you have a registry?" Q&A answer.

- [ ] Add your items on `/admin/registry`.
- [ ] Add `Registry intro: …` to `DETAILS.md` if you haven't already.

> Prompt: *none; the admin page saves straight to the site.*

### 16. Stripe account

**What it is:** *Stripe* is the payment company that takes guests' cards on its own secure
checkout page. Card details never touch your site. It charges about 2.9% + 30¢ per gift and
pays out to your bank.

**Why:** gifts can't be accepted without it. Stripe also verifies your identity (required by
law for receiving payments), and that takes time, so start well before you want gifts to open.

- [ ] Sign up at stripe.com as an individual and describe the use honestly (collecting wedding
      registry gifts). Remember the planning caveat: Stripe's terms exclude personal and family
      use, so the account could be reviewed or held.
- [ ] Finish identity verification and add the bank account for payouts.

### 17. Try it with Stripe test mode locally

**What it is:** *test mode* is a Stripe sandbox with fake money and test card numbers (e.g.
4242 4242 4242 4242). The *Stripe CLI* is a command-line tool, and its `stripe listen` command
forwards Stripe's "payment succeeded" messages (*webhooks*) to your laptop. `.dev.vars` is a
local, gitignored file for secrets used only on this machine.

**Why:** you can rehearse the full gift flow (checkout, payment, the bar filling, the admin
entry) without spending money or touching the live site.

- [ ] Install the Stripe CLI and run `! stripe login`.
- [ ] Put your **test** keys in `.dev.vars` by hand:
      `STRIPE_SECRET_KEY=sk_test_…` and, from `stripe listen`, `STRIPE_WEBHOOK_SECRET=whsec_…`.

> Prompt: **"Test keys are in .dev.vars. Walk me through a test gift with Stripe's test card
> and check that the bar and admin update."**

### 18. Turn on real gifts

**What it is:** a *webhook endpoint* is the address Stripe notifies when a payment succeeds.
The *signing secret* lets the site prove those notifications really came from Stripe. The *live
secret key* lets the site create real checkout sessions.

**Why:** a gift only counts toward its bar once Stripe confirms payment through the webhook. A
forged "payment succeeded" message is rejected because it can't carry the right signature. The
real $10 test proves the live setup end to end before guests use it.

- [ ] Stripe dashboard (live mode) → Webhooks → add endpoint
      `https://parkhillbaileywedding.com/api/stripe/webhook` with events
      `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
- [ ] Run `! pnpm exec wrangler secret put STRIPE_SECRET_KEY` (live `sk_live_…` key) and
      `! pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET` (the endpoint's signing secret).

> Prompt: **"Live Stripe secrets are set. Deploy and check that gifts are open."**

- [ ] Give yourselves a real $10 gift, check that it lands, then refund it in Stripe.

---

## Part 4: Until the wedding (through Oct 2027)

### 19. Invite later groups

**What it is:** the site no longer tracks waves or seats. You decide who to invite next from
the Attending, Declining and Not answered totals in `/admin`.

**Why:** the site doesn't show a deadline, so the date you give each group is what they go by.
Your own dates are in `DETAILS.md` (Mar 30, Jun 30, Aug 30, 2027).

- [ ] After each of your deadlines, check the totals in `/admin` against your seat target.
- [ ] Add the next group to `guest-list.csv`, run `pnpm seed:guests --remote`, then send
      their invitations.
- [ ] Two members of one household listed separately may each answer for the same people.
      Admin's guest list shows both, so check it for double counts.

> Prompt (when you're done taking RSVPs): **"Close RSVPs in production."**

### 20. Final numbers

**What it is:** the RSVP export from admin: one row per person, with attendance, dietary needs
and notes. Rows from the same form share an `rsvp_id`, and `current` is "No" on answers a guest
later replaced.

**Why:** the caterer, venue and seating chart need final headcounts and dietary needs. Admin's
guest list, filtered to "haven't answered", shows who never replied.

- [ ] After your last deadline, download the RSVP CSV from `/admin`.

> Prompt: **"Here's the RSVP export. Give me final counts and dietary needs from the current
> answers."**
