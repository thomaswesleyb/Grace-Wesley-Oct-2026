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
  | "Plus-one policy"
  | "Indoor or outdoor"
  | "Accessibility"
  | "Photo policy"
  | "Things to do nearby";

export type Topic = "Getting there" | "Lodging" | "The day of" | "Registry & more";

export interface QaEntry {
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
    question: "Where is the ceremony?",
    requires: ["Ceremony venue", "Ceremony city, state"],
    answer: (fact) =>
      [fact("Ceremony venue"), fact("Ceremony address line"), fact("Ceremony city, state")]
        .filter(Boolean)
        .join(", "),
  },
  {
    topic: "The day of",
    question: "When is the wedding?",
    requires: ["Wedding date", "Ceremony start time", "Wedding time zone"],
    answer: (fact) =>
      `${fact("Wedding date")}. The ceremony begins at ${fact("Ceremony start time")} ` +
      `${zoneName(fact("Wedding time zone") ?? "")}.`,
  },
  {
    topic: "Getting there",
    question: "Which airports are closest?",
    requires: ["Nearest airports"],
    answer: passthrough("Nearest airports"),
  },
  {
    topic: "Getting there",
    question: "Where should I park?",
    requires: ["Parking"],
    answer: passthrough("Parking"),
  },
  {
    topic: "Getting there",
    question: "How do I get from the ceremony to the reception?",
    requires: ["Reception venue", "Ceremony to reception transport"],
    answer: passthrough("Ceremony to reception transport"),
  },
  {
    topic: "Lodging",
    question: "Where should I stay?",
    requires: ["Lodging recommendations"],
    answer: passthrough("Lodging recommendations"),
  },
  {
    topic: "Lodging",
    question: "Is there a hotel room block?",
    requires: ["Hotel room block"],
    answer: passthrough("Hotel room block"),
  },
  {
    topic: "The day of",
    question: "What time should I arrive?",
    requires: ["Guest arrival time"],
    answer: passthrough("Guest arrival time"),
  },
  {
    topic: "The day of",
    question: "What should I wear?",
    requires: ["Dress code"],
    answer: passthrough("Dress code"),
  },
  {
    topic: "The day of",
    question: "Are children welcome?",
    requires: ["Children policy"],
    answer: passthrough("Children policy"),
  },
  {
    topic: "The day of",
    question: "May I bring a guest?",
    requires: ["Plus-one policy"],
    answer: passthrough("Plus-one policy"),
  },
  {
    topic: "The day of",
    question: "Will the celebration be indoors or outdoors?",
    requires: ["Indoor or outdoor"],
    answer: passthrough("Indoor or outdoor"),
  },
  {
    topic: "The day of",
    question: "Are the venues accessible?",
    requires: ["Accessibility"],
    answer: passthrough("Accessibility"),
  },
  {
    topic: "Registry & more",
    question: "How do I RSVP?",
    requires: ["RSVP method", "Website URL"],
    answer: (fact) =>
      `RSVP ${fact("RSVP method")}: ${fact("Website URL")}. Enter your first and last name on ` +
      "the RSVP page to find your invitation. Your respond-by date is shown there.",
  },
  {
    topic: "Registry & more",
    question: "Do you have a registry?",
    requires: ["Registry intro"],
    answer: passthrough("Registry intro"),
  },
  {
    topic: "Registry & more",
    question: "May I take photos during the ceremony?",
    requires: ["Photo policy"],
    answer: passthrough("Photo policy"),
  },
  {
    topic: "Registry & more",
    question: "What is there to do nearby?",
    requires: ["Things to do nearby"],
    answer: passthrough("Things to do nearby"),
  },
  {
    topic: "Registry & more",
    question: "Who can I contact with questions?",
    requires: ["Couple contact"],
    answer: (fact) => `Email us at ${fact("Couple contact")}.`,
  },
];
