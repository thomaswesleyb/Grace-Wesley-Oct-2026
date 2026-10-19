# Wedding Website Details Template

Fill in every `{{ ... }}` placeholder below to personalize the site for a couple.
Each value maps to text shown on the wedding site (Home, Our Story,
Registry, Travel & Stay, and RSVP pages).

## Couple

Groom: {{ GROOM_FULL_NAME }}, {{ GROOM_PRONOUNS }}
Bride: {{ BRIDE_FULL_NAME }}, {{ BRIDE_PRONOUNS }}

Site title / couple banner: {{ COUPLE_DISPLAY_NAME }}   <!-- e.g. "MADISON & LENOIX" -->
Headline: {{ COUPLE_DISPLAY_NAME }} ARE TYING THE KNOT

## Home — Ceremony

Ceremony venue: {{ CEREMONY_VENUE_NAME }}
Ceremony address line: {{ CEREMONY_STREET }}
Ceremony city, state, zip: {{ CEREMONY_CITY }}, {{ CEREMONY_STATE }} {{ CEREMONY_ZIP }}
Ceremony start time: {{ CEREMONY_TIME }}

## Home — Reception

Reception venue: {{ RECEPTION_VENUE_NAME }}
Reception address line: {{ RECEPTION_STREET }}
Reception city, state, zip: {{ RECEPTION_CITY }}, {{ RECEPTION_STATE }} {{ RECEPTION_ZIP }}
Reception time range: {{ RECEPTION_START_TIME }} – {{ RECEPTION_END_TIME }}

## Our Story

Groom name (as shown): {{ GROOM_NAME }}
Bride name (as shown): {{ BRIDE_NAME }}
Story text: {{ STORY_PARAGRAPH }}
<!-- How the couple met, how long they've been together, and a closing line. -->

## Registry

Registry intro: {{ REGISTRY_INTRO }}
<!-- e.g. thanks for traveling to {{ WEDDING_LOCATION }}; presence is all we ask,
     but a registry / honeymoon fund link is below. -->
Registry button label: {{ REGISTRY_BUTTON_LABEL }}   <!-- e.g. "M&L REGISTRY" -->
Registry link URL: {{ REGISTRY_URL }}

## Travel & Stay

Wedding location (for travel context): {{ WEDDING_LOCATION }}

Bed & Breakfast recommendations link: {{ BNB_LISTINGS_URL }}

Cabin name: {{ CABIN_NAME }}
Cabin address line: {{ CABIN_STREET }}
Cabin city, state, zip: {{ CABIN_CITY }}, {{ CABIN_STATE }} {{ CABIN_ZIP }}
Cabin phone: {{ CABIN_PHONE }}

Hotel name: {{ HOTEL_NAME }}
Hotel address line: {{ HOTEL_STREET }}
Hotel city, state, zip: {{ HOTEL_CITY }}, {{ HOTEL_STATE }} {{ HOTEL_ZIP }}
Hotel phone: {{ HOTEL_PHONE }}

## RSVP

RSVP intro: {{ RSVP_INTRO }}   <!-- e.g. "We look forward to seeing you! Fill out the form on this page." -->
RSVP button label: {{ RSVP_BUTTON_LABEL }}   <!-- e.g. "I'LL BE THERE!" -->

## Wedding — scheduling

Wedding time zone: {{ WEDDING_TIME_ZONE }}   <!-- IANA name, e.g. "America/Chicago" -->
Couple contact: {{ COUPLE_CONTACT }}   <!-- shown when a guest can't find their invitation -->

## RSVP — waves

RSVP deadline, wave 1: {{ WAVE_1_DEADLINE }}   <!-- e.g. "March 1, 2027" -->
RSVP deadline, wave 2: {{ WAVE_2_DEADLINE }}
RSVP deadline, wave 3: {{ WAVE_3_DEADLINE }}

## Q&A

<!-- Each answer appears on the Q&A page only once it is filled in. -->
Nearest airports: {{ NEAREST_AIRPORTS }}
Parking: {{ PARKING }}
Ceremony to reception transport: {{ CEREMONY_TO_RECEPTION }}
Lodging recommendations: {{ LODGING }}
Hotel room block: {{ HOTEL_ROOM_BLOCK }}
Guest arrival time: {{ GUEST_ARRIVAL_TIME }}
Dress code: {{ DRESS_CODE }}
Children policy: {{ CHILDREN_POLICY }}
Plus-one policy: {{ PLUS_ONE_POLICY }}
Indoor or outdoor: {{ INDOOR_OR_OUTDOOR }}
Accessibility: {{ ACCESSIBILITY }}
Photo policy: {{ PHOTO_POLICY }}
Things to do nearby: {{ THINGS_TO_DO }}
