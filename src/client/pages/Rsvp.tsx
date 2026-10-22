import { useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import {
  CodeStep,
  DetailsStep,
  DoneStep,
  RespondStep,
  ReviewStep,
} from "@client/pages/RsvpSteps.tsx";
import { emptyDraft, toSubmission, type Draft } from "@client/pages/rsvp-state.ts";
import { rsvpResult, okResponse, type RsvpResult } from "@shared/schemas.ts";
import "@client/pages/rsvp.css";

type Step = "code" | "respond" | "details" | "review" | "done";

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
  const [step, setStep] = useState<Step>("code");
  const [code, setCode] = useState("");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
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

  const unlock = (typed: string) =>
    run(async () => {
      await apiFetch("/api/rsvp/unlock", okResponse, {
        method: "POST",
        body: { code: typed },
      });
      setCode(typed);
      goTo("respond");
    });

  const submit = () =>
    run(async () => {
      const body = toSubmission(code, draft);
      setResult(await apiFetch("/api/rsvp", rsvpResult, { method: "POST", body }));
      goTo("done");
    });

  const updateDraft = (next: Draft) => {
    setError(null);
    setDraft(next);
  };

  return { step, draft, result, busy, error, updateDraft, setError, goTo, unlock, submit };
}

function StepBody({ flow }: { flow: ReturnType<typeof useRsvpFlow> }) {
  switch (flow.step) {
    case "code":
      return <CodeStep busy={flow.busy} onUnlock={flow.unlock} />;
    case "respond":
      return (
        <RespondStep
          draft={flow.draft}
          onChange={flow.updateDraft}
          onNext={() => flow.goTo("details")}
          onError={flow.setError}
        />
      );
    case "details":
      return (
        <DetailsStep
          draft={flow.draft}
          onChange={flow.updateDraft}
          onBack={() => flow.goTo("respond")}
          onNext={() => flow.goTo("review")}
        />
      );
    case "review":
      return (
        <ReviewStep draft={flow.draft} busy={flow.busy} onEdit={flow.goTo} onSubmit={flow.submit} />
      );
    case "done":
      return flow.result === null ? null : <DoneStep result={flow.result} />;
  }
}

export function Rsvp() {
  const flow = useRsvpFlow();
  const showProgress = flow.step !== "code" && flow.step !== "done";
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
