import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  activePlusOne,
  formatDate,
  respondProblem,
  type Draft,
  type PlusOneDraft,
} from "@client/pages/rsvp-state.ts";
import type { InvitationGuest, InvitationView, RsvpResult } from "@shared/schemas.ts";

const fullName = (g: { firstName: string; lastName: string }) => `${g.firstName} ${g.lastName}`;

export function FindStep({
  busy,
  onFind,
}: {
  busy: boolean;
  onFind: (first: string, last: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onFind(firstName, lastName);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">Find your invitation</h2>
      <p className="rsvp-muted">Enter your name as it appears on your invitation.</p>
      <div className="row">
        <div className="field">
          <label htmlFor="first-name">First name</label>
          <input
            id="first-name"
            autoComplete="given-name"
            required
            maxLength={60}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="last-name">Last name</label>
          <input
            id="last-name"
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
          {busy ? "Searching…" : "Find my invitation"}
        </button>
      </div>
    </form>
  );
}

interface GuestProps {
  guest: InvitationGuest;
  draft: Draft;
  onChange: (draft: Draft) => void;
}

function PlusOneFields({ guest, draft, onChange }: GuestProps) {
  const plusOne = draft.plusOnes[guest.id];
  if (plusOne === undefined || draft.answers[guest.id]?.attending !== true) return null;
  const update = (patch: Partial<PlusOneDraft>) =>
    onChange({ ...draft, plusOnes: { ...draft.plusOnes, [guest.id]: { ...plusOne, ...patch } } });
  return (
    <div className="rsvp-plus-one">
      <label className="rsvp-check">
        <input
          type="checkbox"
          checked={plusOne.bringing}
          onChange={(e) => update({ bringing: e.target.checked })}
        />
        I'm bringing a guest
      </label>
      {plusOne.bringing && (
        <div className="row">
          <div className="field">
            <label htmlFor={`p1-first-${guest.id}`}>Guest's first name</label>
            <input
              id={`p1-first-${guest.id}`}
              required
              maxLength={60}
              value={plusOne.firstName}
              onChange={(e) => update({ firstName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={`p1-last-${guest.id}`}>Guest's last name</label>
            <input
              id={`p1-last-${guest.id}`}
              required
              maxLength={60}
              value={plusOne.lastName}
              onChange={(e) => update({ lastName: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor={`p1-diet-${guest.id}`}>Guest's dietary needs</label>
            <input
              id={`p1-diet-${guest.id}`}
              maxLength={200}
              value={plusOne.dietary}
              onChange={(e) => update({ dietary: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function GuestCard({ guest, draft, onChange }: GuestProps) {
  const answer = draft.answers[guest.id];
  if (answer === undefined) return null;
  const update = (patch: Partial<typeof answer>) =>
    onChange({ ...draft, answers: { ...draft.answers, [guest.id]: { ...answer, ...patch } } });
  return (
    <fieldset className="rsvp-guest">
      <legend>{fullName(guest)}</legend>
      <div className="rsvp-choice" role="radiogroup">
        <label data-selected={answer.attending === true}>
          <input
            type="radio"
            name={`attend-${guest.id}`}
            checked={answer.attending === true}
            onChange={() => update({ attending: true })}
          />
          Joyfully accepts
        </label>
        <label data-selected={answer.attending === false}>
          <input
            type="radio"
            name={`attend-${guest.id}`}
            checked={answer.attending === false}
            onChange={() => update({ attending: false })}
          />
          Regretfully declines
        </label>
      </div>
      {answer.attending === true && (
        <div className="field">
          <label htmlFor={`diet-${guest.id}`}>Dietary needs (optional)</label>
          <input
            id={`diet-${guest.id}`}
            maxLength={200}
            value={answer.dietary}
            onChange={(e) => update({ dietary: e.target.value })}
          />
        </div>
      )}
      <PlusOneFields guest={guest} draft={draft} onChange={onChange} />
    </fieldset>
  );
}

interface RespondProps {
  invitation: InvitationView;
  draft: Draft;
  onChange: (draft: Draft) => void;
  onNext: () => void;
  onError: (message: string) => void;
}

export function RespondStep({ invitation, draft, onChange, onNext, onError }: RespondProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const problem = respondProblem(draft);
    if (problem === null) onNext();
    else onError(problem);
  };
  return (
    <form className="panel" onSubmit={submit}>
      <h2 className="rsvp-label">{invitation.label}</h2>
      {invitation.respondBy !== null && (
        <p className="rsvp-muted">Kindly respond by {formatDate(invitation.respondBy)}.</p>
      )}
      {invitation.guests
        .filter((g) => !g.isPlusOne)
        .map((guest) => (
          <GuestCard key={guest.id} guest={guest} draft={draft} onChange={onChange} />
        ))}
      <div className="actions">
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
  invitation: InvitationView;
  draft: Draft;
  busy: boolean;
  onEdit: (step: "respond" | "details") => void;
  onSubmit: () => void;
}

export function ReviewStep({ invitation, draft, busy, onEdit, onSubmit }: ReviewProps) {
  const active = activePlusOne(draft);
  const guests = invitation.guests.filter((g) => !g.isPlusOne);
  return (
    <div className="panel">
      <h2 className="rsvp-label">Review your RSVP</h2>
      <dl className="rsvp-review">
        {guests.map((guest) => {
          const answer = draft.answers[guest.id];
          return (
            <div key={guest.id}>
              <dt>{fullName(guest)}</dt>
              <dd>
                {answer?.attending ? "Joyfully accepts" : "Regretfully declines"}
                {answer?.attending && answer.dietary.trim() ? ` · ${answer.dietary.trim()}` : ""}
              </dd>
            </div>
          );
        })}
        {active !== null && (
          <div>
            <dt>{fullName(active.plusOne)} (guest)</dt>
            <dd>
              Joyfully accepts
              {active.plusOne.dietary.trim() ? ` · ${active.plusOne.dietary.trim()}` : ""}
            </dd>
          </div>
        )}
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
      <div className="actions">
        <Link className="button secondary" to="/qa">
          Questions &amp; Answers
        </Link>
      </div>
    </div>
  );
}
