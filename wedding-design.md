# Wedding Website Design Document
This document provides the basic wedding website design details. This includes basic desired components for the website. It serves as a starting point for Claude iteration.

## Components
The wedding website should include the following discrete page components:
1) A title page, which is an interactive version of the wedding invitation and may contain enough information on the page to overflow requiring scrolling.
2) A Q&A page, which includes important expected questions such as how to get to certain locations. If the details are not provided in DETAILS.md, the question is hidden until the answer is added.
3) A wedding registry page. This is the most technically involved page. It will include every item in wedding-registry.csv, and a visual horizontal bar with a progress marker that fills up as money is donated. This includes a donate button, and should be wired in with a payment platform using an API.
4) An RSVP page. Guests find their invitation by name and respond for everyone on it.

## Pages and navigation
Home (invitation), Q&A, RSVP, Registry. Registry stays out of the navigation until payments ship.
There is no separate Our Story or Travel & Stay page; travel and lodging live in Q&A.

## Visual style
- **Palette:** espresso-brown page, cream/ivory text, sepia accents. Measured from the
  invitation: text rgb(230 221 215), lattice rgb(196 188 180), filigree rgb(250 241 228).
- **Photo:** the original couple photo (`image0.png`, unmodified) is cropped to the photo area and
  toned to match the invitation (black point rgb(35 20 4), white point rgb(90 72 49)), saved as
  `public/photos/couple-sepia.webp`.
- **Page backdrops:** each page has a fixed photo behind its content, all toned the same way
  (blurred, dimmed, pulled toward sepia, darker toward the bottom) by the shared `Backdrop`
  component. Home: All Saints Chapel (`all-saints.png`). Q&A: Natural Bridge
  (`natural-bridge.png`, downscaled to 800 px wide). RSVP: Bridal Veil Falls
  (`bridal-veil.png`). Registry: the overlook (`greensview.png`). Use only photos the couple has rights to (the first bridal-veil photo
  carried a photographer's watermark and was replaced). Originals stay unmodified; the site serves
  WebP copies from `public/photos/`.
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
- The guest list is split into waves 1, 2 and 3 against a 90-seat target. The couple sends later
  waves as seats open, and marks each invitation "sent" in the admin page.
- A guest enters their full first and last name. Invitations that haven't been sent yet get the
  same "not found" message as a stranger, so no guest can tell which wave they're in.
- One person answers for everyone on the invitation: accept/decline and dietary needs per
  person, a plus-one where allowed, and an email, song request and note per invitation.
- Each wave has its own respond-by date. Guests can edit until then through a link emailed to
  them. Changing a decline to an accept only works while seats are open.

## Privacy
The site is hidden from search engines (`noindex` and robots.txt).
