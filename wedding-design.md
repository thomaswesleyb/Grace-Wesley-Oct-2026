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
  "and" between the names, the date and time, and the venue and city, as on the invitation.
  Both fonts are self-hosted.
- **Ornament:** SVG lattice side borders and filigree corner pieces traced from the invitation.

## Title page
The invitation is rebuilt in live HTML/CSS as a faithful copy of the printed card
(`invitation.jpeg`, 2026-10-22): the light rgb(222 217 214) border, the toned photo, traced
lattice and filigree, and every text line placed at the print's measured size and position (in
container units, so it scales like the print). UnifrakturMaguntia stays for the
blackletter lines: of the free blackletters tested it overlaps the printed date best (the print's
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
- The couple adds items on `/admin/registry` (decided 2026-10-24, replacing the CSV seed): name,
  short description are required; cost, link and picture are optional. No cost = an open fund
  (honeymoon fund) that shows "$X given so far" with no bar. The Registry link is in
  the navigation; before Stripe is connected the page says "Gifts open soon".
- Payments run through Stripe Checkout. Contributor names, notes, and emails are visible only to
  the couple. The public sees bars and dollar amounts.

## RSVP
- Guests find their own name on the guest list (decided 2026-10-22, replacing the shared code
  of 2026-10-21). Typos, aliases and common nicknames still match. A typo or nickname match asks
  "Did you mean {listed name}?" first (decided 2026-10-22). A name that isn't found shows the
  couple's contact address.
- Each guest has a number of places (`total_guest_spots`). The form opens with the guest's own
  name locked, says how many places are saved, and lets them add people up to that number.
  Each person gets accept or decline and dietary needs, plus one email, song request and note.
- Answering again replaces the earlier RSVP. Earlier answers are never shown on the page.
- Only the RSVP form is behind the lookup. Home, Q&A, Photos and Labyrinth stay public.
- No deadline is shown on the site. The couple gives each group its date when inviting them,
  and closes the form when they're done.
- Each RSVP is saved and listed in admin, and emailed to the couple. Admin also lists every guest
  and who hasn't answered.

## Photos
- Photos live in Cloudflare (R2 for the files, D1 for captions and order), not in the build, so
  adding one needs no deploy (decided 2026-10-22, replacing the `images/` folder and
  `pnpm gen:gallery`).
- The couple adds photos by dragging them onto `/admin/photos`. Their browser makes the copies:
  up to 1600 px, plus an 800 px copy for wider photos, in the photos' own colors, with no sepia
  toning, unlike the page backdrops. Redrawing them fixes camera rotation and drops metadata,
  including GPS location. New photos go last; the admin page reorders them.
- Photos without a description are read as "Photo N of M". Captions and descriptions come only
  from the couple.
- Guests can share photos after the wedding, once the couple opens sharing in admin. A guest
  gives their guest-list name; each photo waits for the couple's approval. Approved ones appear
  under "From our guests", after the couple's photos, oldest first, credited "Shared by <name>".
- Storage stays inside R2's free tier: 8 GB in all, and 300 MB or 500 photos per guest
  (decided 2026-10-22, so the couple can't be billed).
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
  cream rim.
- The player drags their animal anywhere it fits. Walls are solid: the animal is a circle that
  stops at a wall and slides along it when dragged at an angle, the way a marble rolls along an
  edge. The collision lines are the drawn walls, thickness included. A drag has to start on
  the animal. Arrow keys/WASD nudge it in screen directions, with the same collisions, for
  keyboard users. Reaching the center with the ring wins; the message gives the time in seconds.
- Each cell has at most one outward passage, so the center has exactly one way in.
- A gold wedding ring, glowing softly, waits at the end of a side branch off the route to the
  center. The branch is the dead end whose length off the route comes closest to a third of the
  route (at least 4 cells), so it's a real detour but not a second maze. A gold-barred gate
  shuts the center's doorway until the animal picks up the ring; then the gate disappears and
  the animal carries the ring to the center. Bumping the shut gate says "Find the ring first."
- Status messages call the maze's rings "circuits" (the labyrinth word), so "ring" only ever
  means the wedding ring.
- Fall leaves (about 150, in rust, amber, ochre and oxblood, slightly see-through) lie on the
  floor, clear of the walls and the center cell. The animal kicks the ones in its path: they
  skid the way it moved, scatter a little to the sides, spin, and settle within about a second.
  Walls stop them just as they stop the animal. They are scattered fresh for each maze.
- Optional `Labyrinth intro` in DETAILS.md shows on the start screen.

## Privacy
The site is hidden from search engines (`noindex` and robots.txt).
