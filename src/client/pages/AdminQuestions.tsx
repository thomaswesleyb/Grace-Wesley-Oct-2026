import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { TOPICS, type Topic } from "@content/qa.ts";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { site } from "@client/site.ts";
import {
  addedQuestion,
  okResponse,
  questionsResponse,
  type AddedQuestion,
  type QuestionFields,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";
import "@client/pages/qa.css";

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

const questionPath = (q: AddedQuestion) => `/api/admin/questions/${encodeURIComponent(q.id)}`;

const BLANK: QuestionFields = { topic: TOPICS[0], question: "", answer: "" };

/** Topic, question and answer fields; used both to add a question and to edit one. */
function QuestionForm(props: {
  id: string;
  initial: QuestionFields;
  submitLabel: string;
  busy: boolean;
  onSubmit: (fields: QuestionFields) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [fields, setFields] = useState(props.initial);
  const set = (change: Partial<QuestionFields>) => setFields({ ...fields, ...change });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if ((await props.onSubmit(fields)) && props.onCancel === undefined) setFields(props.initial);
  };
  return (
    <form className="admin-question-form" onSubmit={(e) => void submit(e)}>
      <div className="field">
        <label htmlFor={`${props.id}-topic`}>Topic</label>
        <select
          id={`${props.id}-topic`}
          value={fields.topic}
          disabled={props.busy}
          onChange={(e) => set({ topic: e.target.value as Topic })}
        >
          {TOPICS.map((topic) => (
            <option key={topic}>{topic}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${props.id}-question`}>Question</label>
        <input
          id={`${props.id}-question`}
          required
          maxLength={200}
          value={fields.question}
          disabled={props.busy}
          onChange={(e) => set({ question: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${props.id}-answer`}>Answer</label>
        <textarea
          id={`${props.id}-answer`}
          required
          maxLength={2000}
          rows={4}
          value={fields.answer}
          disabled={props.busy}
          onChange={(e) => set({ answer: e.target.value })}
        />
      </div>
      <div className="admin-photo-actions">
        <button className="button" type="submit" disabled={props.busy}>
          {props.submitLabel}
        </button>
        {props.onCancel !== undefined && (
          <button
            className="button secondary"
            type="button"
            disabled={props.busy}
            onClick={props.onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

interface RowActions {
  busy: boolean;
  onSave: (question: AddedQuestion, fields: QuestionFields) => Promise<boolean>;
  onDelete: (question: AddedQuestion) => void;
}

function AddedRow({ question, busy, onSave, onDelete }: { question: AddedQuestion } & RowActions) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  if (mode === "edit") {
    return (
      <li className="admin-question">
        <QuestionForm
          id={`edit-${question.id}`}
          initial={question}
          submitLabel="Save"
          busy={busy}
          onSubmit={async (fields) => {
            const saved = await onSave(question, fields);
            if (saved) setMode("view");
            return saved;
          }}
          onCancel={() => setMode("view")}
        />
      </li>
    );
  }
  return (
    <li className="admin-question">
      <p className="admin-question-q">{question.question}</p>
      <p className="admin-question-a">{question.answer}</p>
      <div className="admin-photo-actions">
        {mode === "view" ? (
          <>
            <button
              className="button secondary admin-delete"
              type="button"
              disabled={busy}
              onClick={() => setMode("edit")}
            >
              Edit
            </button>
            <button
              className="button secondary admin-delete"
              type="button"
              disabled={busy}
              onClick={() => setMode("confirm")}
            >
              Delete
            </button>
          </>
        ) : (
          <span className="admin-confirm" role="group" aria-label="Confirm delete">
            <span>Delete this question?</span>
            <button
              className="button admin-delete"
              type="button"
              disabled={busy}
              onClick={() => onDelete(question)}
            >
              Yes, delete
            </button>
            <button
              className="button secondary admin-delete"
              type="button"
              disabled={busy}
              onClick={() => setMode("view")}
            >
              Cancel
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/** One topic: the DETAILS.md questions (read-only), then the added ones. */
function TopicSection(props: { topic: Topic; added: AddedQuestion[] } & RowActions) {
  const { topic, added, ...actions } = props;
  const built = site.qa.filter((entry) => entry.topic === topic);
  return (
    <section className="admin-guests">
      <h2>{topic}</h2>
      {built.length === 0 && added.length === 0 && (
        <p className="admin-muted">No questions in this topic yet.</p>
      )}
      <ul className="admin-question-list">
        {built.map((entry) => (
          <li key={entry.question} className="admin-question built">
            <p className="admin-question-q">{entry.question}</p>
            <p className="admin-question-a">{entry.answer}</p>
            <p className="admin-muted">From DETAILS.md. Change it there and redeploy.</p>
          </li>
        ))}
        {added.map((question) => (
          <AddedRow key={question.id} question={question} {...actions} />
        ))}
      </ul>
    </section>
  );
}

export function AdminQuestions() {
  const [added, setAdded] = useState<AddedQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/api/admin/questions", questionsResponse)
        .then(({ questions }) => setAdded(questions))
        .catch((e: unknown) => setError(errorMessage(e, "Couldn't load the questions."))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one change, shows its error if it fails, then reloads. Resolves true on success. */
  const run = async (change: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    let ok = true;
    try {
      await change();
    } catch (e) {
      ok = false;
      setError(errorMessage(e, fallback));
    }
    await load();
    setBusy(false);
    return ok;
  };

  const create = (body: QuestionFields) =>
    run(
      () => apiFetch("/api/admin/questions", addedQuestion, { method: "POST", body }),
      "Couldn't add that question.",
    );
  const save = (question: AddedQuestion, body: QuestionFields) =>
    run(
      () => apiFetch(questionPath(question), okResponse, { method: "PATCH", body }),
      "Couldn't save that change.",
    );
  const remove = (question: AddedQuestion) =>
    void run(
      () => apiFetch(questionPath(question), okResponse, { method: "DELETE" }),
      "Couldn't delete that question.",
    );

  return (
    <section className="page admin">
      <h1>Q&amp;A</h1>
      <p className="admin-nav">
        <Link to="/admin">← RSVPs</Link> · <Link to="/qa">See the Q&amp;A page</Link>
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {added === null && error === null && <p className="lede">Loading…</p>}
      {added !== null && (
        <>
          <section className="admin-guests" aria-labelledby="add-heading">
            <h2 id="add-heading">Add a question</h2>
            <p className="admin-muted">It shows on the Q&amp;A page as soon as you add it.</p>
            <QuestionForm
              id="new"
              initial={BLANK}
              submitLabel="Add question"
              busy={busy}
              onSubmit={create}
            />
          </section>
          {TOPICS.map((topic) => (
            <TopicSection
              key={topic}
              topic={topic}
              added={added.filter((q) => q.topic === topic)}
              busy={busy}
              onSave={save}
              onDelete={remove}
            />
          ))}
        </>
      )}
    </section>
  );
}
