import type { Topic } from "@content/qa.ts";

/** Shape of content/details.json, generated from DETAILS.md by scripts/gen-content.ts. */
export interface SiteContent {
  brideShort: string;
  groomShort: string;
  brideFormal: string;
  groomFormal: string;
  dateText: string;
  timeText: string;
  ceremonyVenue: string;
  ceremonyCityState: string;
  ceremonyAddress: string | null;
  mapUrl: string;
  website: string;
  /** ISO instant of the ceremony start; null until the time zone is in DETAILS.md. */
  startsAt: string | null;
  contact: string;
  /** "Registry intro" from DETAILS.md; the registry page omits the intro until it's set. */
  registryIntro: string | null;
  qa: { topic: Topic; question: string; answer: string }[];
}
