import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { TOPICS, type Topic } from "@content/qa.ts";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { site } from "@client/site.ts";
import { shownBuilt, type BuiltQuestion } from "@shared/questions.ts";
import {
  addedQuestion,
  okResponse,
  questionsResponse,
  type AddedQuestion,
  type BuiltEdit,
  type BuiltEditFields,
  type QuestionFields,
  type QuestionsResponse,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";
import "@client/pages/qa.css";

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

const questionPath = (q: AddedQuestion) => `/api/admin/questions/${encodeURIComponent(q.id)}`;
const builtPath = (key: string) => `/api/admin/questions/built/${encodeURIComponent(key)}`;

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
  onSaveBuilt: (key: string, fields: BuiltEditFields) => Promise<boolean>;
  onResetBuilt: (key: string) => Promise<boolean>;
}

/** A DETAILS.md question with the couple's edit, if any; `edit` decides its topic. */
interface BuiltItem {
  entry: BuiltQuestion;
  edit: BuiltEdit | undefined;
}

const sameText = (a: QuestionFields, b: QuestionFields) =>
  a.topic === b.topic && a.question === b.question && a.answer === b.answer;

function builtStatus({ entry, edit }: BuiltItem): string {
  if (edit === undefined) {
    return entry.answer === null
      ? "Not on the Q&A page: DETAILS.md doesn't have this answer yet. Answer it here to show it."
      : "From DETAILS.md.";
  }
  return edit.hidden ? "Hidden from the Q&A page." : "Edited here. Reset to use DETAILS.md again.";
}

function BuiltButtons(props: {
  busy: boolean;
  answered: boolean;
  hidden: boolean;
  edited: boolean;
  onEdit: () => void;
  onToggleHidden: () => void;
  onReset: () => void;
}) {
  return (
    <>
      <button
        className="button secondary admin-delete"
        type="button"
        disabled={props.busy}
        onClick={props.onEdit}
      >
        {props.answered ? "Edit" : "Answer"}
      </button>
      {props.answered && (
        <button
          className="button secondary admin-delete"
          type="button"
          disabled={props.busy}
          onClick={props.onToggleHidden}
        >
          {props.hidden ? "Show" : "Hide"}
        </button>
      )}
      {props.edited && (
        <button
          className="button secondary admin-delete"
          type="button"
          disabled={props.busy}
          onClick={props.onReset}
        >
          Reset
        </button>
      )}
    </>
  );
}

function ConfirmReset(props: { busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <span className="admin-confirm" role="group" aria-label="Confirm reset">
      <span>Discard your edits and use DETAILS.md?</span>
      <button
        className="button admin-delete"
        type="button"
        disabled={props.busy}
        onClick={props.onConfirm}
      >
        Yes, reset
      </button>
      <button
        className="button secondary admin-delete"
        type="button"
        disabled={props.busy}
        onClick={props.onCancel}
      >
        Cancel
      </button>
    </span>
  );
}

/** The text the couple sees and edits: theirs if edited, else DETAILS.md's (blank if missing). */
function builtFields({ entry, edit }: BuiltItem): QuestionFields {
  const { topic, question, answer } = edit ?? { ...entry, answer: entry.answer ?? "" };
  return { topic, question, answer };
}

/** True when the question's text, hidden or not, still matches DETAILS.md. */
const matchesDetails = (item: BuiltItem) =>
  item.entry.answer !== null &&
  sameText(builtFields(item), { ...item.entry, answer: item.entry.answer });

function BuiltText({ item }: { item: BuiltItem }) {
  const { question, answer } = builtFields(item);
  const original = item.edit === undefined ? null : item.entry.answer;
  return (
    <>
      <p className="admin-question-q">{question}</p>
      {answer !== "" && <p className="admin-question-a">{answer}</p>}
      <p className="admin-muted">{builtStatus(item)}</p>
      {original !== null && <p className="admin-muted">DETAILS.md says: {original}</p>}
    </>
  );
}

function BuiltRow({ item, ...actions }: { item: BuiltItem } & RowActions) {
  const { entry, edit } = item;
  const { busy, onSaveBuilt, onResetBuilt } = actions;
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const fields = builtFields(item);
  const hidden = edit?.hidden ?? false;
  /** Showing a hidden question whose text matches DETAILS.md drops the edit altogether. */
  const toggleHidden = () =>
    void (hidden && matchesDetails(item)
      ? onResetBuilt(entry.key)
      : onSaveBuilt(entry.key, { ...fields, hidden: !hidden }));
  if (mode === "edit") {
    return (
      <li className="admin-question built">
        <QuestionForm
          id={`built-${entry.key}`}
          initial={fields}
          submitLabel="Save"
          busy={busy}
          onSubmit={async (changed) => {
            const saved = await onSaveBuilt(entry.key, { ...changed, hidden });
            if (saved) setMode("view");
            return saved;
          }}
          onCancel={() => setMode("view")}
        />
      </li>
    );
  }
  return (
    <li className={`admin-question built${shownBuilt(entry, edit) === null ? " off" : ""}`}>
      <BuiltText item={item} />
      <div className="admin-photo-actions">
        {mode === "view" ? (
          <BuiltButtons
            busy={busy}
            answered={fields.answer !== ""}
            hidden={hidden}
            edited={edit !== undefined}
            onEdit={() => setMode("edit")}
            onToggleHidden={toggleHidden}
            onReset={() => setMode("confirm")}
          />
        ) : (
          <ConfirmReset
            busy={busy}
            onConfirm={() => void onResetBuilt(entry.key).then(() => setMode("view"))}
            onCancel={() => setMode("view")}
          />
        )}
      </div>
    </li>
  );
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

/** One topic: the DETAILS.md questions, then the added ones, in Q&A page order. */
function TopicSection(
  props: { topic: Topic; built: BuiltItem[]; added: AddedQuestion[] } & RowActions,
) {
  const { topic, built, added, ...actions } = props;
  return (
    <section className="admin-guests">
      <h2>{topic}</h2>
      {built.length === 0 && added.length === 0 && (
        <p className="admin-muted">No questions in this topic yet.</p>
      )}
      <ul className="admin-question-list">
        {built.map((item) => (
          <BuiltRow key={item.entry.key} item={item} {...actions} />
        ))}
        {added.map((question) => (
          <AddedRow key={question.id} question={question} {...actions} />
        ))}
      </ul>
    </section>
  );
}

export function AdminQuestions() {
  const [data, setData] = useState<QuestionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/api/admin/questions", questionsResponse)
        .then(setData)
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
  const saveBuilt = (key: string, body: BuiltEditFields) =>
    run(
      () => apiFetch(builtPath(key), okResponse, { method: "PATCH", body }),
      "Couldn't save that change.",
    );
  const resetBuilt = (key: string) =>
    run(
      () => apiFetch(builtPath(key), okResponse, { method: "DELETE" }),
      "Couldn't reset that question.",
    );

  const editByKey = new Map(data?.edits.map((edit) => [edit.key, edit]));
  const builtItems: BuiltItem[] = site.qa.map((entry) => ({
    entry,
    edit: editByKey.get(entry.key),
  }));

  return (
    <section className="page admin">
      <h1>Q&amp;A</h1>
      <p className="admin-nav">
        <Link to="/admin">← RSVPs</Link> · <Link to="/qa">See the Q&amp;A page</Link>
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {data === null && error === null && <p className="lede">Loading…</p>}
      {data !== null && (
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
              built={builtItems.filter((item) => (item.edit ?? item.entry).topic === topic)}
              added={data.questions.filter((q) => q.topic === topic)}
              busy={busy}
              onSave={save}
              onDelete={remove}
              onSaveBuilt={saveBuilt}
              onResetBuilt={resetBuilt}
            />
          ))}
        </>
      )}
    </section>
  );
}
