import { useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { Backdrop } from "@client/components/Backdrop.tsx";
import {
  DetailsStep,
  DoneStep,
  FindStep,
  RespondStep,
  ReviewStep,
} from "@client/pages/RsvpSteps.tsx";
import { emptyDraft, formatDate, toSubmission, type Draft } from "@client/pages/rsvp-state.ts";
import { site } from "@client/site.ts";
import {
  lookupResponse,
  rsvpResult,
  type InvitationView,
  type RsvpResult,
} from "@shared/schemas.ts";
import "@client/pages/rsvp.css";

type Step = "find" | "respond" | "details" | "review" | "done";

const STEP_LABELS: [Step, string][] = [
  ["respond", "Respond"],
  ["details", "Details"],
  ["review", "Review"],
];

function Progress({ step }: { step: Step }) {
  const current = STEP_LABELS.findIndex(([s]) => s === step);
  return (
    <ol className="rsvp-progress" aria-label="RSVP steps">
      {STEP_LABELS.map(([s, label], index) => (
        <li
          key={s}
          aria-current={index === current ? "step" : undefined}
          data-done={index < current}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}

function Locked({ invitation }: { invitation: InvitationView }) {
  const attending = invitation.guests.filter((g) => g.attending === true);
  const declining = invitation.guests.filter((g) => g.attending === false);
  return (
    <div className="panel">
      <h2 className="rsvp-label">{invitation.label}</h2>
      {invitation.responded ? (
        <>
          <p>Thank you, we have your RSVP.</p>
          {attending.length > 0 && (
            <p>Attending: {attending.map((g) => `${g.firstName} ${g.lastName}`).join(", ")}</p>
          )}
          {declining.length > 0 && (
            <p>Declining: {declining.map((g) => `${g.firstName} ${g.lastName}`).join(", ")}</p>
          )}
          <p className="rsvp-muted">To change your RSVP, please contact us: {site.contact}</p>
        </>
      ) : (
        <p>
          RSVPs for this invitation closed
          {invitation.respondBy === null ? "" : ` on ${formatDate(invitation.respondBy)}`}. Please
          contact us: {site.contact}
        </p>
      )}
    </div>
  );
}

function useRsvpFlow() {
  const [step, setStep] = useState<Step>("find");
  const [invitation, setInvitation] = useState<InvitationView | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [result, setResult] = useState<RsvpResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  const find = (firstName: string, lastName: string) =>
    run(async () => {
      const body = { firstName, lastName };
      const reply = await apiFetch("/api/rsvp/lookup", lookupResponse, { method: "POST", body });
      if (!reply.found) {
        setError(
          `We couldn't find that name. Try it exactly as written on your invitation, or contact us: ${site.contact}`,
        );
        return;
      }
      setInvitation(reply.invitation);
      setDraft(emptyDraft(reply.invitation));
      goTo("respond");
    });

  const submit = (current: InvitationView, currentDraft: Draft) =>
    run(async () => {
      const path = `/api/rsvp/${encodeURIComponent(current.id)}`;
      setResult(
        await apiFetch(path, rsvpResult, { method: "POST", body: toSubmission(currentDraft) }),
      );
      goTo("done");
    });

  const updateDraft = (next: Draft) => {
    setError(null);
    setDraft(next);
  };

  return {
    step,
    invitation,
    draft,
    result,
    busy,
    error,
    updateDraft,
    setError,
    goTo,
    find,
    submit,
  };
}

type Flow = ReturnType<typeof useRsvpFlow>;

interface StepProps {
  flow: Flow;
  invitation: InvitationView;
  draft: Draft;
}

function StepBody({ flow, invitation, draft }: StepProps) {
  switch (flow.step) {
    case "respond":
      return (
        <RespondStep
          invitation={invitation}
          draft={draft}
          onChange={flow.updateDraft}
          onNext={() => flow.goTo("details")}
          onError={flow.setError}
        />
      );
    case "details":
      return (
        <DetailsStep
          draft={draft}
          onChange={flow.updateDraft}
          onBack={() => flow.goTo("respond")}
          onNext={() => flow.goTo("review")}
        />
      );
    case "review":
      return (
        <ReviewStep
          invitation={invitation}
          draft={draft}
          busy={flow.busy}
          onEdit={flow.goTo}
          onSubmit={() => flow.submit(invitation, draft)}
        />
      );
    case "done":
      return flow.result === null ? null : <DoneStep result={flow.result} />;
    case "find":
      return null;
  }
}

function StepView(props: StepProps) {
  const { invitation, flow } = props;
  if (invitation.responded || invitation.closed) return <Locked invitation={invitation} />;
  return (
    <>
      {flow.step !== "done" && <Progress step={flow.step} />}
      <StepBody {...props} />
    </>
  );
}

export function Rsvp() {
  const flow = useRsvpFlow();
  const { invitation, draft } = flow;
  return (
    <>
      <Backdrop src="/photos/bridal-veil.webp" position="center 40%" />
      <section className="page rsvp">
        <h1>RSVP</h1>
        <p className="lede">We would be honored by your presence.</p>
        {flow.error !== null && (
          <p className="notice error" role="alert">
            {flow.error}
          </p>
        )}
        {flow.step === "find" || invitation === null || draft === null ? (
          <FindStep busy={flow.busy} onFind={flow.find} />
        ) : (
          <StepView flow={flow} invitation={invitation} draft={draft} />
        )}
      </section>
    </>
  );
}
