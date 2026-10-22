import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  addPerson,
  canAddPerson,
  removePerson,
  respondProblem,
  updatePerson,
  type Draft,
  type PersonDraft,
} from "@client/pages/rsvp-state.ts";
import { site } from "@client/site.ts";
import { MAX_PARTY, type RsvpResult } from "@shared/schemas.ts";

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName.trim()} ${p.lastName.trim()}`.trim();

export function CodeStep({ busy, onUnlock }: { busy: boolean; onUnlock: (code: string) => void }) {
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onUnlock(code);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">Enter your RSVP code</h2>
      <p className="rsvp-muted">Don't have it? Contact us: {site.contact}</p>
      <div className="field">
        <label htmlFor="rsvp-code">RSVP code</label>
        <input
          id="rsvp-code"
          autoComplete="off"
          inputMode="numeric"
          required
          maxLength={40}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </div>
      <div className="actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Checking…" : "Continue"}
        </button>
      </div>
    </form>
  );
}

interface PersonProps {
  person: PersonDraft;
  index: number;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

function NameFields({ person, draft, onChange }: PersonProps) {
  const id = person.key;
  return (
    <div className="row">
      <div className="field">
        <label htmlFor={`first-${id}`}>First name</label>
        <input
          id={`first-${id}`}
          required
          maxLength={60}
          value={person.firstName}
          onChange={(e) => onChange(updatePerson(draft, id, { firstName: e.target.value }))}
        />
      </div>
      <div className="field">
        <label htmlFor={`last-${id}`}>Last name</label>
        <input
          id={`last-${id}`}
          required
          maxLength={60}
          value={person.lastName}
          onChange={(e) => onChange(updatePerson(draft, id, { lastName: e.target.value }))}
        />
      </div>
    </div>
  );
}

function PersonCard(props: PersonProps) {
  const { person, index, draft, onChange } = props;
  const id = person.key;
  const update = (patch: Partial<PersonDraft>) => onChange(updatePerson(draft, id, patch));
  return (
    <fieldset className="rsvp-guest">
      <legend>{fullName(person) || (index === 0 ? "You" : "Another guest")}</legend>
      <NameFields {...props} />
      <div className="rsvp-choice" role="radiogroup">
        <label data-selected={person.attending === true}>
          <input
            type="radio"
            name={`attend-${id}`}
            checked={person.attending === true}
            onChange={() => update({ attending: true })}
          />
          Joyfully accepts
        </label>
        <label data-selected={person.attending === false}>
          <input
            type="radio"
            name={`attend-${id}`}
            checked={person.attending === false}
            onChange={() => update({ attending: false })}
          />
          Regretfully declines
        </label>
      </div>
      {person.attending === true && (
        <div className="field">
          <label htmlFor={`diet-${id}`}>Dietary needs (optional)</label>
          <input
            id={`diet-${id}`}
            maxLength={200}
            value={person.dietary}
            onChange={(e) => update({ dietary: e.target.value })}
          />
        </div>
      )}
      {index > 0 && (
        <div className="actions">
          <button
            className="button secondary"
            type="button"
            onClick={() => onChange(removePerson(draft, id))}
          >
            Remove
          </button>
        </div>
      )}
    </fieldset>
  );
}

interface RespondProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onNext: () => void;
  onError: (message: string) => void;
}

export function RespondStep({ draft, onChange, onNext, onError }: RespondProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = respondProblem(draft);
    if (problem === null) onNext();
    else onError(problem);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">Who's responding?</h2>
      <p className="rsvp-muted">
        Add everyone on your invitation, up to {MAX_PARTY} people, so we can count each seat.
      </p>
      {draft.people.map((person, index) => (
        <PersonCard
          key={person.key}
          person={person}
          index={index}
          draft={draft}
          onChange={onChange}
        />
      ))}
      <div className="actions">
        {canAddPerson(draft) && (
          <button
            className="button secondary"
            type="button"
            onClick={() => onChange(addPerson(draft))}
          >
            Add another person
          </button>
        )}
        <button className="button" type="submit">
          Continue
        </button>
      </div>
    </form>
  );
}

interface DetailsProps {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onBack: () => void;
  onNext: () => void;
}

export function DetailsStep({ draft, onChange, onBack, onNext }: DetailsProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onNext();
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">A few details</h2>
      <div className="field">
        <label htmlFor="email">Email, for wedding updates</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={draft.email}
          onChange={(e) => onChange({ ...draft, email: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="song">A song that will get you dancing (optional)</label>
        <input
          id="song"
          maxLength={200}
          value={draft.songRequest}
          onChange={(e) => onChange({ ...draft, songRequest: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="note">A note for the couple (optional)</label>
        <textarea
          id="note"
          maxLength={1000}
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
        />
      </div>
      <div className="actions">
        <button className="button secondary" type="button" onClick={onBack}>
          Back
        </button>
        <button className="button" type="submit">
          Review
        </button>
      </div>
    </form>
  );
}

interface ReviewProps {
  draft: Draft;
  busy: boolean;
  onEdit: (step: "respond" | "details") => void;
  onSubmit: () => void;
}

export function ReviewStep({ draft, busy, onEdit, onSubmit }: ReviewProps) {
  return (
    <div className="panel">
      <h2 className="rsvp-label">Review your RSVP</h2>
      <dl className="rsvp-review">
        {draft.people.map((person) => (
          <div key={person.key}>
            <dt>{fullName(person)}</dt>
            <dd>
              {person.attending ? "Joyfully accepts" : "Regretfully declines"}
              {person.attending && person.dietary.trim() ? ` · ${person.dietary.trim()}` : ""}
            </dd>
          </div>
        ))}
        <div>
          <dt>Email</dt>
          <dd>{draft.email}</dd>
        </div>
        {draft.songRequest.trim() && (
          <div>
            <dt>Song request</dt>
            <dd>{draft.songRequest.trim()}</dd>
          </div>
        )}
        {draft.note.trim() && (
          <div>
            <dt>Note</dt>
            <dd>{draft.note.trim()}</dd>
          </div>
        )}
      </dl>
      <div className="actions">
        <button className="button secondary" type="button" onClick={() => onEdit("respond")}>
          Edit responses
        </button>
        <button className="button secondary" type="button" onClick={() => onEdit("details")}>
          Edit details
        </button>
        <button className="button" type="button" disabled={busy} onClick={onSubmit}>
          {busy ? "Sending…" : "Send RSVP"}
        </button>
      </div>
    </div>
  );
}

export function DoneStep({ result }: { result: RsvpResult }) {
  const parts = [
    result.attending > 0 ? `${result.attending} attending` : null,
    result.declining > 0 ? `${result.declining} declining` : null,
  ].filter(Boolean);
  return (
    <div className="panel rsvp-done">
      <h2 className="rsvp-label">Thank you</h2>
      <p>We've received your RSVP: {parts.join(", ")}.</p>
      {result.attending > 0 ? (
        <p>We can't wait to celebrate with you.</p>
      ) : (
        <p>You'll be missed, and we're grateful you let us know.</p>
      )}
      <p className="rsvp-muted">To change your RSVP, please contact us: {site.contact}</p>
      <div className="actions">
        <Link className="button secondary" to="/qa">
          Questions &amp; Answers
        </Link>
      </div>
    </div>
  );
}
