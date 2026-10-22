# Wedding Website Design Document
This document provides the basic wedding website design details. This includes basic desired components for the website. It serves as a starting point for Claude iteration.

## Components
The wedding website should include the following discrete page components:
1) A title page, which is an interactive version of the wedding invitation and may contain enough information on the page to overflow requiring scrolling.
2) A Q&A page, which includes important expected questions such as how to get to certain locations. If the details are not provided in DETAILS.md, the question is hidden until the answer is added.
3) A wedding registry page. This is the most technically involved page. It will include every item in wedding-registry.csv, and a visual horizontal bar with a progress marker that fills up as money is donated. This includes a donate button, and should be wired in with a payment platform using an API.
4) An RSVP page. Guests enter a shared code, then respond for everyone in their party.
5) A Photos page: the engagement photos and other pictures the couple picks.
6) A Labyrinth page: a small maze game modeled on the brick labyrinth in Abbo's Alley, Sewanee.

## Pages and navigation
Home (invitation), Info (Q&A), RSVP, Photos, Labyrinth, Registry. Registry stays out of the
navigation until payments ship. The nav links wrap onto a second line on narrow phones.
There is no separate Our Story or Travel & Stay page; travel and lodging live in Q&A.

## Visual style
- **Palette:** espresso-brown page, cream/ivory text, sepia accents. Measured from the
  invitation: text rgb(230 221 215), lattice rgb(196 188 180), filigree rgb(250 241 228).
- **Photo:** the original couple photo (`image0.png`, unmodified) is cropped to the photo area and
  toned to match the invitation (black point rgb(35 20 4), white point rgb(90 72 49)), saved as
  `public/photos/couple-sepia.webp`.
- **Page backdrops:** a photo sits behind each page's content, toned the same way everywhere
  (blurred, dimmed, pulled toward sepia, darker toward the bottom) by the shared `Backdrop`
  component. Home always uses All Saints Chapel (`all-saints.png`). Every other page except
  admin shows a random photo from `background-images/`, picked again on each page visit and
  never the same as the previous page's (decided 2026-10-21). `pnpm gen:backdrops` (also run by
  `pnpm dev` and `pnpm build`) makes 1280 px WebP copies in `public/photos/backdrops/` and lists
  them in `content/backdrops.json`. Use only photos the couple has rights to. Originals stay
  unmodified.
- **Type:** Playfair Display SC for names and body text. UnifrakturMaguntia (blackletter) for the
  date and time only. Both fonts are self-hosted.
- **Ornament:** SVG lattice side borders and filigree corner pieces traced from the invitation.

## Title page
The invitation is rebuilt in live HTML/CSS as a faithful copy of the printed card: the toned
photo, traced lattice and filigree, and every text line placed at the print's measured size and
position (in container units, so it scales like the print). UnifrakturMaguntia stays for the
date and time: of the free blackletters tested it overlaps the printed date best (the print's
face looks like Old English Text MT, which is a licensed font). On load the ornaments draw in and the text fades up.
"All Saints Chapel" links to a map, and "Kindly RSVP" goes to the RSVP page. Scrolling past the
card shows the day's details and a countdown to October 23, 2027.

## Q&A topics
Getting there and parking; lodging; day-of (dress code, arrival, kids, plus-ones, weather,
accessibility); registry and other. Each entry appears only when its answer is in DETAILS.md.

## Registry
- Each item is its own cash fund with a progress bar ($ raised / price), a photo, a short
  description, and a "View item" link to the retailer (tracking parameters removed).
- Guests choose an amount: $10 minimum, maximum = the item's remaining balance. A fully funded
  item shows "Fully gifted" and its button is disabled.
- Items load from `wedding-registry.csv` (optional `Image` and `Description` columns). The page
  is in the navigation now; remove the nav link before launch to hide it.
- Payments run through Stripe Checkout. Contributor names, notes, and emails are visible only to
  the couple. The public sees bars and dollar amounts.

## RSVP
- The form is unlocked with one shared code (decided 2026-10-21; it replaced a name lookup
  against a guest list with waves). The code is checked on the server and never ships to the
  browser.
- Only the RSVP form is behind the code. Home, Q&A, Photos and Labyrinth stay public.
- One person answers for their party, up to 6 people: each person's name, accept or decline,
  and dietary needs, plus an email, song request and note.
- No deadline is shown on the site. The couple gives each group its date when inviting them,
  and closes the form when they're done.
- Each RSVP is saved and listed in admin, and emailed to the couple. To change an answer, guests
  contact the couple.

## Photos
- Every photo in `images/` (JPEG, PNG, WebP or HEIC; never modified) is shown. Adding or
  removing a file is all it takes (decided 2026-10-21, replacing a required CSV row per photo).
- `images/captions.csv` (`file,caption,alt`) is optional. Photos with a row come first, in CSV
  order, with that caption and alt text. The rest follow in natural file-name order with the
  alt text "Photo N of M". Captions and descriptions come only from the couple.
- `pnpm gen:gallery` (also run by `pnpm dev` and `pnpm build`) makes WebP copies in
  `public/photos/gallery/` (up to 1600 px, plus an 800 px copy for wider photos) in the photos'
  own colors, with no sepia toning, unlike the page backdrops. It fixes camera rotation and
  strips metadata, including GPS location, and skips photos whose copies are up to date. It
  writes `content/gallery.json`, which is committed. If `images/` has no photos (e.g. a fresh
  clone without the originals), it leaves the current gallery as it is.
- The page is a column grid (one column on phones, up to three on desktop) of cream-framed
  photos. Tapping one opens it full size in a lightbox with Previous/Next, arrow keys, swipe and
  Esc; focus returns to the photo's thumbnail.
- Optional `Photos intro` in DETAILS.md shows above the grid. With no photos the page says
  "Photos coming soon".

## Labyrinth
- The real Abbo's Alley labyrinth is a classical 7-circuit brick labyrinth: one path, no wrong
  turns. The game keeps its round 7-ring look but is a true maze, with branches and dead ends,
  so there is something to solve.
- The player chooses the fox or the deer and enters at the bottom of the outer ring, where the
  real labyrinth's mouth is. The other animal waits in the center; reaching it ends the game
  with a heart and the move count. "Walk it again" starts a new maze.
- Brick-red walls (like the real labyrinth's brick lines) on an espresso ground inside a thin
  cream rim. Arrow keys/WASD, swipe, or the on-screen pad move the animal.
- On a circle "up" means different passages in different places, so each cell pairs its open
  passages with the arrow keys that point most nearly along them, one key per passage. To make
  that always possible, a cell has at most one outward passage (four passages at most), and the
  center has exactly one way in.
- Optional `Labyrinth intro` in DETAILS.md shows on the start screen.

## Privacy
The site is hidden from search engines (`noindex` and robots.txt).
