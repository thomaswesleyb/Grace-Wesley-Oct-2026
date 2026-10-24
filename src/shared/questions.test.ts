import { describe, expect, it } from "vitest";
import { qaItems, type BuiltQuestion } from "@shared/questions.ts";
import type { AddedQuestion, BuiltEdit } from "@shared/schemas.ts";

const parking: BuiltQuestion = {
  key: "parking",
  topic: "Getting there",
  question: "Where should I park?",
  answer: "Behind the chapel.",
};
const dress: BuiltQuestion = {
  key: "dress-code",
  topic: "The day of",
  question: "What should I wear?",
  answer: null,
};
const pets: AddedQuestion = {
  id: "q1",
  topic: "The day of",
  question: "Can I bring my dog?",
  answer: "Sorry, no pets.",
  createdAt: "2026-10-23T00:00:00Z",
};

const edit = (key: string, overrides: Partial<BuiltEdit> = {}): BuiltEdit => ({
  key,
  topic: "Lodging",
  question: "Edited?",
  answer: "Edited.",
  hidden: false,
  updatedAt: "2026-10-23T00:00:00Z",
  ...overrides,
});

describe("qaItems", () => {
  it("shows answered DETAILS.md questions, then added ones, and skips unanswered ones", () => {
    expect(qaItems([parking, dress], [pets], [])).toEqual([
      parking,
      {
        key: "q1",
        topic: "The day of",
        question: "Can I bring my dog?",
        answer: "Sorry, no pets.",
      },
    ]);
  });

  it("replaces a DETAILS.md question's topic, question and answer with the couple's edit", () => {
    expect(qaItems([parking], [], [edit("parking")])).toEqual([
      { key: "parking", topic: "Lodging", question: "Edited?", answer: "Edited." },
    ]);
  });

  it("shows a question DETAILS.md can't answer yet once the couple answers it", () => {
    expect(qaItems([dress], [], [edit("dress-code")])).toHaveLength(1);
  });

  it("leaves out hidden questions, and ignores edits to keys no longer in content/qa.ts", () => {
    expect(qaItems([parking], [], [edit("parking", { hidden: true }), edit("gone")])).toEqual([]);
    expect(qaItems([parking], [], [edit("gone")])).toEqual([parking]);
  });
});
