import { useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import {
  DetailsStep,
  FindStep,
  DoneStep,
  RespondStep,
  ReviewStep,
} from "@client/pages/RsvpSteps.tsx";
import { draftFor, toSubmission, type Draft } from "@client/pages/rsvp-state.ts";
import { lookupResponse, rsvpResult, type ListedGuest, type RsvpResult } from "@shared/schemas.ts";
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

function useRsvpFlow() {
  const [step, setStep] = useState<Step>("find");
  const [guest, setGuest] = useState<ListedGuest | null>(null);
  const [answered, setAnswered] = useState(false);
  const [notFound, setNotFound] = useState(false);
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
      setNotFound(false);
      const reply = await apiFetch("/api/rsvp/lookup", lookupResponse, {
        method: "POST",
        body: { firstName, lastName },
      });
      if (!reply.found) {
        setNotFound(true);
        return;
      }
      setGuest(reply.guest);
      setAnswered(reply.answered);
      setDraft(draftFor(reply.guest));
      goTo("respond");
    });

  const submit = () =>
    run(async () => {
      if (guest === null || draft === null) return;
      const body = toSubmission(guest.id, draft);
      setResult(await apiFetch("/api/rsvp", rsvpResult, { method: "POST", body }));
      goTo("done");
    });

  const updateDraft = (next: Draft) => {
    setError(null);
    setDraft(next);
  };

  return {
    step,
    guest,
    answered,
    notFound,
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

/** The steps after the guest is found, so their invitation and draft are always there. */
function GuestStep({ flow, guest, draft }: { flow: Flow; guest: ListedGuest; draft: Draft }) {
  switch (flow.step) {
    case "find":
      return null;
    case "respond":
      return (
        <RespondStep
          guest={guest}
          answered={flow.answered}
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
        <ReviewStep draft={draft} busy={flow.busy} onEdit={flow.goTo} onSubmit={flow.submit} />
      );
    case "done":
      return flow.result === null ? null : <DoneStep result={flow.result} />;
  }
}

function StepBody({ flow }: { flow: Flow }) {
  const { guest, draft } = flow;
  if (flow.step === "find" || guest === null || draft === null) {
    return <FindStep busy={flow.busy} notFound={flow.notFound} onFind={flow.find} />;
  }
  return <GuestStep flow={flow} guest={guest} draft={draft} />;
}

export function Rsvp() {
  const flow = useRsvpFlow();
  const showProgress = flow.step !== "find" && flow.step !== "done";
  return (
    <>
      <section className="page rsvp">
        <h1>RSVP</h1>
        <p className="lede">We would be honored by your presence.</p>
        {flow.error !== null && (
          <p className="notice error" role="alert">
            {flow.error}
          </p>
        )}
        {showProgress && <Progress step={flow.step} />}
        <StepBody flow={flow} />
      </section>
    </>
  );
}
