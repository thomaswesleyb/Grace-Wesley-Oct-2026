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
- Keep the guest list outside the repo, or name it `guests….csv` (gitignored and blocked by the
  commit hook).

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

- [ ] Review the changes (`git status`), commit them on the `template` branch, and push.
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

**Why:** the page says "Photos coming soon" until there are photos. Captions and alt text come
only from you. Alt text is a short description of each photo that screen readers read aloud
to guests who can't see it.

- [ ] Put the originals in `images/` (JPEG, PNG, WebP, or iPhone HEIC).
- [ ] Add `images/captions.csv` with the columns `file,caption,alt`: one row per photo,
      in the order you want them shown. `alt` is required and `caption` is optional. If a
      photo has no row, or a row has no alt text, the build stops and names the photo.
- [ ] Decide whether to commit the originals. The site only needs the generated copies in
      `public/photos/gallery/` and `content/gallery.json`. The copies have location data
      removed. The originals may still have it.
- [ ] Optional: add `Photos intro: …` and `Labyrinth intro: …` to `DETAILS.md`.

> Prompt: **"Photos are in. Build the gallery copies and show me the page."**

### 5. Finish the guest list

**What it is:** a CSV (spreadsheet saved as comma-separated text) with one row per invited
person. *Waves* are your invitation phases: wave 1 now, then waves 2 and 3 as seats open toward
the 90-person target. *Priority* orders invitations within a wave.

**Why:** the RSVP page only accepts guests on this list. A guest types their name and gets
their whole invitation (household, plus-one allowance). Guests in waves you haven't sent can't
find themselves, which keeps the waves private. A checked list now avoids "I can't find my name"
messages on launch day.

- [ ] Build the CSV with these columns:
      `invitation,first_name,last_name,plus_one_allowed,wave,priority,email`
      - One row per person. People on the same invitation share an `invitation` value. A blank
        `invitation` means a solo guest.
      - `plus_one_allowed`: yes/no. `wave`: 1, 2 or 3. `priority`: optional, 1 = send first.
        `email`: optional.
      - Names exactly as on the envelope. Guests type their name to find their invitation.
- [ ] Save it outside the repo (e.g. `~/wedding/guests.csv`).

> Prompt: **"Check my guest list at ~/wedding/guests.csv for problems without loading it
> anywhere: duplicate names, bad waves, bad emails, and the seat count per wave against 90."**

### 6. Connect Wrangler to Cloudflare

**What it is:** *Wrangler* is Cloudflare's command-line tool for deploying and managing the site.
*D1* is Cloudflare's database, which stores invitations, RSVPs and gifts. *Migrations* are the
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

**Why:** the site emails you each time someone RSVPs or gives a gift. Later it will also email
guests their edit links. Without a verified domain those emails land in spam or are refused.

- [ ] Create a free account at resend.com and add **parkhillbaileywedding.com** as a sending
      domain. Add the DNS records Resend lists in Cloudflare → DNS, then wait until Resend shows
      the domain as verified.
- [ ] Create an API key, then run: `! pnpm exec wrangler secret put RESEND_API_KEY`
- [ ] Decide which addresses get alerts and what the sender should be, e.g.
      `RSVP <rsvp@parkhillbaileywedding.com>`.

> Prompt: **"Resend is verified and the key is set. Send alerts to <your emails> from
> <sender>. Update the config."**

### 8. Protect the admin page (Cloudflare Access)

**What it is:** *Cloudflare Access* (part of the free *Zero Trust* plan) puts a login in front
of chosen pages. Visitors get a one-time code by email, and only the addresses you list get in.
The *team domain* identifies your Access account. The *AUD tag* identifies this one protected
app. The site checks both on every admin request.

**Why:** `/admin` shows every guest's name, answers, dietary needs, emails and gifts. Until
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

### 11. Load the guest list into production

**What it is:** *seeding* copies the guest CSV into the live database. Marking wave 1 *sent*
makes those guests findable on the RSVP page.

**Why:** the live site starts with an empty guest list. Until this step every name gets "we
couldn't find that name". Waves 2 and 3 stay hidden until you send their invitations.

> Prompt: **"Load ~/wedding/guests.csv into production and mark wave 1 as sent."**

- [ ] Look up two or three real wave-1 names on the live RSVP page. They should be found.
- [ ] Look up a wave-2 name. It should say it can't find the name.

### 12. Test a real RSVP end to end

**What it is:** a *smoke test*: one real run through the live site using a throwaway "Test
Guest" invitation.

**Why:** it proves the whole chain works on the real setup: lookup, saving, the admin view, and
the alert email. A test invitation keeps fake answers out of your real guest list, and deleting
it afterwards keeps your counts accurate.

> Prompt: **"Add a temporary test invitation called 'Test Guest' to production so I can try an
> RSVP. I'll tell you when I'm done."**

- [ ] RSVP as "Test Guest". Check that the alert email arrives and the response shows in admin.

> Prompt: **"I'm done testing. Delete the Test Guest invitation and its RSVP from production."**

- [ ] Commit and push everything.

---

## Part 2: Launch and the first week (Oct 23–30)

### 13. Launch day

**What it is:** sending the wave-1 invitations, which point guests to the site.

**Why:** RSVPs start arriving immediately. Watching admin and the alert emails on day one means
any problem shows up after a handful of guests, not after everyone.

- [ ] Send the invitations.
- [ ] Watch `/admin` and the alert emails as the first RSVPs arrive.

> Prompt (if anything looks wrong): **"A guest says <what happened>. Find out why."**

### 14. Build the deferred RSVP features

**What it is:** three features held back to make the launch date:

- *Email-link edits* let a guest change their RSVP through a private link sent to their email.
- *Mark sent* and *next-to-send* suggestions in admin are how you release waves 2 and 3.
- A *weekly CSV backup* keeps a copy of the RSVPs beyond the database's 7-day undo window.

**Why:** at launch, a guest who needs to change their answer has to contact you, and releasing
a wave needs Claude's help. These make both self-service before the first deadline.

> Prompt: **"Build the week-1 features from the plan: email-link RSVP edits (with the
> declined-to-accepted open-seat check), Mark sent and next-to-send suggestions in admin, and the
> weekly CSV backup."**

- [ ] Try editing your test RSVP through the emailed link, then deploy.

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

### 19. Run the waves

**What it is:** after each wave's RSVP deadline, the admin page shows how many of the 90 seats
are open. Unanswered invitations count as taken, so you never overbook. Admin then suggests
which held invitations fit next, in priority order.

**Why:** it's how declines in one wave turn into invitations for the next, while every guest
only ever sees their own invitation and deadline.

- [ ] After each deadline (Mar 30, Jun 30, Aug 30, 2027), check open seats in `/admin`.
- [ ] Send the next invitations from the suggested list, then click **Mark sent** for each.

> Prompt (if you change the plan): **"Move wave 2's deadline to <date>"** or **"Change the
> seat target to <number>."**

### 20. Final numbers

**What it is:** the RSVP export from admin: one row per guest, with attendance, plus-ones,
dietary needs and notes.

**Why:** the caterer, venue and seating chart need final headcounts and dietary needs, and
you'll want to follow up with anyone who never replied.

- [ ] After the last deadline, download the RSVP CSV from `/admin`.

> Prompt: **"Give me final counts: attending, plus-ones, dietary needs, and anyone who never
> replied."**
