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

## Where things stand and the schedule to launch (as of Wed, Oct 21)

**Done:** step 1 (committed and pushed), step 4 (32 photos in the gallery, built from `images/`; the
web copies carry no location data). The RSVP page now uses a shared code instead of a guest list
(built Oct 21, not yet committed), so there's no guest list to load.

**Not started:** Wrangler isn't logged in, so there's no production database or domain yet.
Alerts, Access, the RSVP code secret and the deploy are still to do. Only 4 of 18 Q&A answers
show.

**Required for launch:** steps 6, 10 and 11. Without them there's no site, or every RSVP is
refused. Step 8 is needed to *see* RSVPs in admin. Step 7 matters more now: the alert email is
how you hear about each RSVP, though every one is also saved in admin. Step 3 can follow launch,
since hidden Q&A answers simply don't show.

**Decide now:** the GitHub repo `thomaswesleyb/Grace-Wesley-Oct-2026` is **public**. Anyone can
read `DETAILS.md`, the design files and the photo originals. The RSVP code isn't in the repo.
To make the repo private: GitHub → Settings → Danger Zone → Change visibility.

### Wed, Oct 21 (today): start the steps that have to wait on someone else

Resend's DNS check and the Zero Trust signup can take hours, so start them first.

1. Step 1, second half: install prek and run `prek install`.
2. Step 2: confirm the domain is Active, and turn on auto-renew.
3. Step 6: `! pnpm exec wrangler login`, then send the step 6 prompt.
4. Step 7: create the Resend account and add the DNS records. Come back to it once it's verified.
5. Step 8: set up Zero Trust and the Access app, then send the step 8 prompt.
6. Step 9: decide whether the Registry link shows.
7. Step 5: decide how guests will get the RSVP code. The printed invitation doesn't show it.

### Thu, Oct 22: content, deploy, rehearsal

1. Step 3: fill in `DETAILS.md`, at least the reception venue, address and time, plus the dress
   code.
2. Step 7: once Resend says verified, set the key and send the step 7 prompt.
3. Step 10: deploy, then check the site on your phone and confirm admin turns away a stranger.
4. Step 11: set the RSVP code in production.
5. Step 12: send a test RSVP, delete it, then commit and push.

### Fri, Oct 23: launch

Step 13: send the invitations with the code, and watch `/admin` and your email.

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
`DETAILS.md`, so right now only 2 of 16 show. Guests will look for travel, lodging and dress-code
answers first.

- [ ] Add every fact you know to `DETAILS.md`. The ones that matter most to guests:
      `Nearest airports`, `Parking`, `Lodging recommendations`, `Hotel room block`,
      `Dress code`, `Guest arrival time`, `Children policy`, `Plus-one policy`,
      `Indoor or outdoor`, `Accessibility`, and the reception venue, address and time.
- [ ] Optional now, needed for the registry later: `Registry intro`.

> Prompt: **"I updated DETAILS.md. Regenerate the content, tell me which Q&A questions are still
> hidden, and check that every new line parses."**

### 4. Add your photos

**What it is:** the Photos page shows your engagement photos and any other pictures you pick.
*ImageMagick* (already installed) makes small, fast-loading WebP copies of each photo for the
site. Your originals are never changed.

**Why:** the page says "Photos coming soon" until there are photos. Every photo in `images/`
is shown automatically, and `pnpm dev` and `pnpm build` refresh the gallery. Captions and alt
text come only from you. Alt text is a short description of each photo that screen readers read
aloud to guests who can't see it. Photos you haven't described are read as "Photo 12 of 32".

- [x] Put the originals in `images/` (JPEG, PNG, WebP, or iPhone HEIC). 32 are in.
- [ ] Optional: in `images/captions.csv` (columns `file,caption,alt`), add a row for any photo
      you want to caption, describe, or move to the front. Listed photos come first, in the
      CSV's order. The rest follow by file name.
- [ ] Decide whether to commit the originals (307 MB for the 24 new ones). The site only needs
      the generated copies in `public/photos/gallery/` (14 MB) and `content/gallery.json`. The
      copies have location data removed. `IMG_7865.JPG`'s original still has GPS coordinates,
      and the repo is public.
- [ ] Optional: add `Photos intro: …` and `Labyrinth intro: …` to `DETAILS.md`.

> Prompt: **"Photos are in. Build the gallery copies and show me the page."**

### 5. Decide how guests get the RSVP code

**What it is:** the RSVP form opens only after a guest enters the shared code (10232027). The
site ignores dashes, slashes and spaces, so `10/23/2027` works too.

**Why:** the printed invitation doesn't mention a code, so guests need another way to learn it.
Without the code they reach a dead end, apart from the contact address shown on the page. The
code is the wedding date, which keeps out bots and strangers but not anyone who has seen an
invitation.

- [ ] Choose how to share it: an insert card, a text or email with the invitation, or word of
      mouth.
- [ ] Optional: pick a less guessable code. Changing it later takes one command (step 11).

> Prompt: *none.*

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

- [ ] Cloudflare dashboard → **Zero Trust**. Pick a team name and the free plan (it may ask for
      a card even on the free plan).
- [ ] Access → Applications → **Add a self-hosted application** covering
      `parkhillbaileywedding.com/admin` and `parkhillbaileywedding.com/api/admin`. Policy: Allow,
      Emails = your two addresses.
- [ ] Copy the **team domain** (`<team>.cloudflareaccess.com`) and the app's **Application
      Audience (AUD) tag**. Neither is secret.

> Prompt: **"Access is set up. Team domain: <…>, AUD: <…>. Put them in the config."**

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

### 11. Set the RSVP code in production

**What it is:** the code is stored as a Cloudflare *secret* named `RSVP_CODE`: encrypted, and
never in the code, the repo or the page guests download.

**Why:** until it's set, the RSVP page answers every code with "RSVPs aren't open yet." That's
deliberate: a missing setting locks the form rather than leaving it open.

- [ ] Run: `! pnpm exec wrangler secret put RSVP_CODE` and type `10232027` (or your own code)
      when asked. Run the same command again any time to change it. It takes effect at once,
      with no deploy.
- [ ] On the live RSVP page, a wrong code should be refused and the real one should open the
      form.

### 12. Test a real RSVP end to end

**What it is:** a *smoke test*: one real RSVP through the live site under the name "Test
Guest".

**Why:** it proves the whole chain works on the real setup: the code, saving, the admin view,
and the alert email. Deleting it afterwards keeps your counts accurate.

- [ ] RSVP as "Test Guest" with the code. Check that the alert email arrives and the response
      shows in admin.

> Prompt: **"I'm done testing. Delete the Test Guest RSVP from production."**

- [ ] Commit and push everything.

---

## Part 2: Launch and the first week (Oct 23–30)

### 13. Launch day

**What it is:** sending the invitations, which point guests to the site, along with the RSVP
code.

**Why:** RSVPs start arriving immediately. Watching admin and the alert emails on day one means
any problem shows up after a handful of guests, not after everyone.

- [ ] Send the invitations, and the code the way you chose in step 5.
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

**What it is:** `wedding-registry.csv` lists each gift: name, price and store link, with
optional photo and description. *Reseeding* loads your edits into the database. It's safe to
repeat, and gifts already given stay attached.

**Why:** photos and a line of description make the cards inviting and show guests what they're
contributing toward. The intro line also turns on the "Do you have a registry?" Q&A answer.

- [ ] Add `Image` and `Description` columns to `wedding-registry.csv`. Put the photos in
      `public/registry/`. Add any more items.
- [ ] Add `Registry intro: …` to `DETAILS.md` if you haven't already.

> Prompt: **"I updated the registry CSV and photos. Reseed the local registry and show me the
> page."**

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

> Prompt: **"Live Stripe secrets are set. Seed the registry to production, show the Registry
> link again, and deploy."**

- [ ] Give yourselves a real $10 gift, check that it lands, then refund it in Stripe.

---

## Part 4: Until the wedding (through Oct 2027)

### 19. Invite later groups

**What it is:** the site no longer tracks waves or seats. You decide who to invite next from
the Attending and Declining totals in `/admin`, and send them the same code.

**Why:** the site doesn't show a deadline, so the date you give each group is what they go by.
Your own dates are in `DETAILS.md` (Mar 30, Jun 30, Aug 30, 2027).

- [ ] After each of your deadlines, check the totals in `/admin` against your seat target.
- [ ] Send the next invitations along with the code.
- [ ] Watch for a household that RSVPs twice. Admin lists both, so delete the extra one.

> Prompt (when you're done taking RSVPs): **"Close RSVPs in production."**

### 20. Final numbers

**What it is:** the RSVP export from admin: one row per person, with attendance, dietary needs
and notes. Rows from the same form share an `rsvp_id`.

**Why:** the caterer, venue and seating chart need final headcounts and dietary needs. The site
has no guest list, so compare the export against your own list to find anyone who never replied.

- [ ] After your last deadline, download the RSVP CSV from `/admin`.

> Prompt: **"Here's the RSVP export and my guest list (outside the repo). Give me final counts,
> dietary needs, possible duplicate RSVPs, and anyone on my list who never replied."**
