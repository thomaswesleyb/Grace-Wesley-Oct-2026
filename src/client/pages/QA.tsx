import { useEffect, useState } from "react";
import { TOPICS } from "@content/qa.ts";
import { apiFetch } from "@client/api.ts";
import { site } from "@client/site.ts";
import { qaItems, type QaItem } from "@shared/questions.ts";
import { questionsResponse } from "@shared/schemas.ts";
import "@client/pages/qa.css";

/** Waits for the couple's edits so an edited or hidden answer never flashes its old version. */
export function QA() {
  const [all, setAll] = useState<QaItem[] | null>(null);

  useEffect(() => {
    apiFetch("/api/questions", questionsResponse)
      .then(({ questions, edits }) => setAll(qaItems(site.qa, questions, edits)))
      .catch((e: unknown) => {
        console.warn("Couldn't load the admin's questions; showing DETAILS.md ones only.", e);
        setAll(qaItems(site.qa, [], []));
      });
  }, []);

  if (all === null) {
    return (
      <section className="page">
        <h1>Important Information</h1>
        <p className="lede">Loading…</p>
      </section>
    );
  }

  const topics = TOPICS.map((topic) => ({
    topic,
    entries: all.filter((entry) => entry.topic === topic),
  })).filter((group) => group.entries.length > 0);

  return (
    <>
      <section className="page">
        <h1>Important Information</h1>
        <p className="lede">More answers will appear here as plans come together.</p>
        {topics.map(({ topic, entries }) => (
          <section key={topic} className="qa-topic" aria-labelledby={`topic-${topic}`}>
            <h2 id={`topic-${topic}`}>{topic}</h2>
            {entries.map((entry) => (
              <details key={entry.key} className="qa-item">
                <summary>{entry.question}</summary>
                <p>{entry.answer}</p>
              </details>
            ))}
          </section>
        ))}
      </section>
    </>
  );
}
