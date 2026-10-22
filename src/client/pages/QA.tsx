import type { Topic } from "@content/qa.ts";
import { site } from "@client/site.ts";
import "@client/pages/qa.css";

const TOPIC_ORDER: Topic[] = ["Getting there", "Lodging", "The day of", "Registry & more"];

export function QA() {
  const topics = TOPIC_ORDER.map((topic) => ({
    topic,
    entries: site.qa.filter((entry) => entry.topic === topic),
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
              <details key={entry.question} className="qa-item">
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
