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
import type { ListedGuest, RsvpResult } from "@shared/schemas.ts";

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.firstName.trim()} ${p.lastName.trim()}`.trim();

interface FindProps {
  busy: boolean;
  notFound: boolean;
  /** What the guest typed last time, so going back doesn't make them retype it. */
  initial: { firstName: string; lastName: string };
  onFind: (firstName: string, lastName: string) => void;
}

export function FindStep({ busy, notFound, initial, onFind }: FindProps) {
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onFind(firstName, lastName);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">Find your invitation</h2>
      <p className="rsvp-muted">Enter your name as it appears on your invitation.</p>
      {notFound && (
        <p className="notice error" role="alert">
          We couldn't find that name on our guest list. Please try it exactly as it's written on
          your invitation, or contact us: {site.contact}
        </p>
      )}
      <div className="row">
        <div className="field">
          <label htmlFor="find-first">First name</label>
          <input
            id="find-first"
            autoComplete="given-name"
            required
            maxLength={60}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="find-last">Last name</label>
          <input
            id="find-last"
            autoComplete="family-name"
            required
            maxLength={60}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>
      <div className="actions">
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Looking…" : "Find my invitation"}
        </button>
      </div>
    </form>
  );
}

interface ConfirmProps {
  guest: ListedGuest;
  onYes: () => void;
  onNo: () => void;
}

/** Shown when the typed name only matched through a typo or nickname. */
export function ConfirmStep({ guest, onYes, onNo }: ConfirmProps) {
  return (
    <div className="panel">
      <h2 className="rsvp-label">
        Did you mean {guest.firstName} {guest.lastName}?
      </h2>
      <p className="rsvp-muted">That's the closest name on our guest list.</p>
      <div className="actions">
        <button className="button secondary" type="button" onClick={onNo}>
          No, that's not me
        </button>
        <button className="button" type="button" onClick={onYes}>
          Yes, that's me
        </button>
      </div>
    </div>
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
      <legend>{fullName(person) || "Another guest"}</legend>
      {index > 0 && <NameFields {...props} />}
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
  guest: ListedGuest;
  /** The guest already has an RSVP, which this one will replace. */
  answered: boolean;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onNext: () => void;
  /** Drops this unsent RSVP and goes back to the name lookup. */
  onCancel: () => void;
  onError: (message: string) => void;
}

const placesLeft = (left: number) => (left === 1 ? "1 place left" : `${left} places left`);

function placesLine(spots: number): string {
  if (spots === 1) return "We've saved a place for you.";
  if (spots === 2) return "We've saved 2 places: one for you and one for a guest.";
  return `We've saved ${spots} places for your party.`;
}

export function RespondStep(props: RespondProps) {
  const { guest, answered, draft, onChange, onNext, onCancel, onError } = props;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = respondProblem(draft);
    if (problem === null) onNext();
    else onError(problem);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">
        Welcome, {guest.firstName} {guest.lastName}
      </h2>
      <p className="rsvp-muted">
        {placesLine(guest.spots)}
        {guest.spots > 1 &&
          " Add anyone joining you. If you don't know their name yet, write “Guest”."}
      </p>
      {answered && (
        <p className="notice">We already have an RSVP from you. Sending this one replaces it.</p>
      )}
      {draft.people.map((person, index) => (
        <PersonCard
          key={person.key}
          person={person}
          index={index}
          draft={draft}
          onChange={onChange}
        />
      ))}
      {canAddPerson(draft, guest.spots) && (
        <button
          className="rsvp-add"
          type="button"
          onClick={() => onChange(addPerson(draft, guest.spots))}
        >
          + Add a guest
          <span className="rsvp-add-hint">{placesLeft(guest.spots - draft.people.length)}</span>
        </button>
      )}
      <div className="actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
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
      <p className="rsvp-muted">
        To change your answer, look up your name again and send a new RSVP. It replaces this one.
      </p>
      <div className="actions">
        <Link className="button secondary" to="/qa">
          Questions &amp; Answers
        </Link>
      </div>
    </div>
  );
}
