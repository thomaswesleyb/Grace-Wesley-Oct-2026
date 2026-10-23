import { useEffect, useState } from "react";
import { TOPICS } from "@content/qa.ts";
import { apiFetch } from "@client/api.ts";
import { site } from "@client/site.ts";
import { questionsResponse, type AddedQuestion } from "@shared/schemas.ts";
import "@client/pages/qa.css";

export function QA() {
  const [added, setAdded] = useState<AddedQuestion[]>([]);

  useEffect(() => {
    apiFetch("/api/questions", questionsResponse)
      .then(({ questions }) => setAdded(questions))
      .catch((e: unknown) =>
        console.warn("Couldn't load added questions; showing DETAILS.md ones only.", e),
      );
  }, []);

  const all = [
    ...site.qa.map(({ topic, question, answer }) => ({ key: question, topic, question, answer })),
    ...added.map(({ id, topic, question, answer }) => ({ key: id, topic, question, answer })),
  ];
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
