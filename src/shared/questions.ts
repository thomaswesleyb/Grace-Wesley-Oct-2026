import type { Topic } from "@content/qa.ts";
import type { AddedQuestion, BuiltEdit } from "@shared/schemas.ts";
import type { SiteContent } from "@shared/site.ts";

export type BuiltQuestion = SiteContent["qa"][number];

export interface QaItem {
  key: string;
  topic: Topic;
  question: string;
  answer: string;
}

const pickFields = ({ topic, question, answer }: Omit<QaItem, "key">) => ({
  topic,
  question,
  answer,
});

/** A DETAILS.md question as the Q&A page shows it, or null when it's hidden or unanswered. */
export function shownBuilt(entry: BuiltQuestion, edit: BuiltEdit | undefined): QaItem | null {
  if (edit !== undefined) {
    return edit.hidden ? null : { key: entry.key, ...pickFields(edit) };
  }
  return entry.answer === null ? null : { ...entry, answer: entry.answer };
}

/** The Q&A page's entries: DETAILS.md ones with the couple's edits applied, then added ones. */
export function qaItems(
  built: BuiltQuestion[],
  added: AddedQuestion[],
  edits: BuiltEdit[],
): QaItem[] {
  const editByKey = new Map(edits.map((edit) => [edit.key, edit]));
  const items: QaItem[] = [];
  for (const entry of built) {
    const item = shownBuilt(entry, editByKey.get(entry.key));
    if (item !== null) items.push(item);
  }
  for (const question of added) items.push({ key: question.id, ...pickFields(question) });
  return items;
}
