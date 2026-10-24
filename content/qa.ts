/** Labels exactly as they appear in DETAILS.md (`Label: value`). */
export type FactLabel =
  | "Wedding date"
  | "Ceremony start time"
  | "Wedding time zone"
  | "Website URL"
  | "Couple contact"
  | "Ceremony venue"
  | "Ceremony address line"
  | "Ceremony city, state"
  | "Reception venue"
  | "RSVP method"
  | "Registry intro"
  | "Nearest airports"
  | "Parking"
  | "Ceremony to reception transport"
  | "Lodging recommendations"
  | "Hotel room block"
  | "Guest arrival time"
  | "Dress code"
  | "Children policy"
  | "Welcome statement"
  | "Plus-one policy"
  | "Indoor or outdoor"
  | "Accessibility"
  | "Photo policy"
  | "Things to do nearby"
  | "Places to eat";

/** Q&A page sections, in page order. */
export const TOPICS = ["Getting there", "Lodging", "The day of", "Registry & more"] as const;
export type Topic = (typeof TOPICS)[number];

export interface QaEntry {
  /** Stable id that admin edits are saved under; keep it when rewording the question. */
  key: string;
  topic: Topic;
  question: string;
  requires: FactLabel[];
  answer: (fact: (label: FactLabel) => string | undefined) => string;
}

/** "America/Chicago" → "Central Time", so travelers near a zone line know which clock to use. */
const zoneName = (timeZone: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longGeneric" })
    .formatToParts(0)
    .find((part) => part.type === "timeZoneName")?.value ?? timeZone;

const passthrough = (label: FactLabel) => (fact: (l: FactLabel) => string | undefined) =>
  fact(label) ?? "";

export const QA_ENTRIES: QaEntry[] = [
  {
    topic: "Getting there",
    key: "ceremony-location",
    question: "Where is the ceremony?",
    requires: ["Ceremony venue", "Ceremony city, state"],
    answer: (fact) =>
      [fact("Ceremony venue"), fact("Ceremony address line"), fact("Ceremony city, state")]
        .filter(Boolean)
        .join(", "),
  },
  {
    topic: "The day of",
    key: "wedding-time",
    question: "When is the wedding?",
    requires: ["Wedding date", "Ceremony start time", "Wedding time zone"],
    answer: (fact) =>
      `${fact("Wedding date")}. The ceremony begins at ${fact("Ceremony start time")} ` +
      `${zoneName(fact("Wedding time zone") ?? "")}.`,
  },
  {
    topic: "Getting there",
    key: "airports",
    question: "Which airports are closest?",
    requires: ["Nearest airports"],
    answer: passthrough("Nearest airports"),
  },
  {
    topic: "Getting there",
    key: "parking",
    question: "Where should I park?",
    requires: ["Parking"],
    answer: passthrough("Parking"),
  },
  {
    topic: "Getting there",
    key: "ceremony-to-reception",
    question: "How do I get from the ceremony to the reception?",
    requires: ["Reception venue", "Ceremony to reception transport"],
    answer: passthrough("Ceremony to reception transport"),
  },
  {
    topic: "Lodging",
    key: "lodging",
    question: "Where should I stay?",
    requires: ["Lodging recommendations"],
    answer: passthrough("Lodging recommendations"),
  },
  {
    topic: "Lodging",
    key: "hotel-block",
    question: "Is there a hotel room block?",
    requires: ["Hotel room block"],
    answer: passthrough("Hotel room block"),
  },
  {
    topic: "The day of",
    key: "arrival-time",
    question: "What time should I arrive?",
    requires: ["Guest arrival time"],
    answer: passthrough("Guest arrival time"),
  },
  {
    topic: "The day of",
    key: "dress-code",
    question: "What should I wear?",
    requires: ["Dress code"],
    answer: passthrough("Dress code"),
  },
  {
    topic: "The day of",
    key: "children",
    question: "Are children welcome?",
    requires: ["Children policy"],
    answer: passthrough("Children policy"),
  },
  {
    topic: "The day of",
    key: "welcome",
    question: "Who will be celebrating with you?",
    requires: ["Welcome statement"],
    answer: passthrough("Welcome statement"),
  },
  {
    topic: "The day of",
    key: "plus-one",
    question: "May I bring a guest?",
    requires: ["Plus-one policy"],
    answer: passthrough("Plus-one policy"),
  },
  {
    topic: "The day of",
    key: "indoor-outdoor",
    question: "Will the celebration be indoors or outdoors?",
    requires: ["Indoor or outdoor"],
    answer: passthrough("Indoor or outdoor"),
  },
  {
    topic: "The day of",
    key: "accessibility",
    question: "Are the venues accessible?",
    requires: ["Accessibility"],
    answer: passthrough("Accessibility"),
  },
  {
    topic: "Registry & more",
    key: "rsvp",
    question: "How do I RSVP?",
    requires: ["RSVP method", "Website URL"],
    answer: (fact) =>
      `RSVP ${fact("RSVP method")}: ${fact("Website URL")}. Find your name on the RSVP page, ` +
      "then tell us whether you and anyone on your invitation can attend.",
  },
  {
    topic: "Registry & more",
    key: "registry",
    question: "Do you have a registry?",
    requires: ["Registry intro"],
    answer: passthrough("Registry intro"),
  },
  {
    topic: "Registry & more",
    key: "photos",
    question: "May I take photos during the ceremony?",
    requires: ["Photo policy"],
    answer: passthrough("Photo policy"),
  },
  {
    topic: "Registry & more",
    key: "things-to-do",
    question: "What is there to do nearby?",
    requires: ["Things to do nearby"],
    answer: passthrough("Things to do nearby"),
  },
  {
    topic: "Registry & more",
    key: "places-to-eat",
    question: "Where should we eat?",
    requires: ["Places to eat"],
    answer: passthrough("Places to eat"),
  },
  {
    topic: "Registry & more",
    key: "contact",
    question: "Who can I contact with questions?",
    requires: ["Couple contact"],
    answer: (fact) => `Email us at ${fact("Couple contact")}.`,
  },
];
