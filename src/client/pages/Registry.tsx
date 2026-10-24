import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { site } from "@client/site.ts";
import {
  contributionProblem,
  dollarsToCents,
  formatDollars,
  MIN_CONTRIBUTION_CENTS,
  percentFunded,
  remainingCents,
} from "@shared/registry.ts";
import {
  checkoutResponse,
  registryResponse,
  type RegistryItem,
  type RegistryResponse,
} from "@shared/schemas.ts";
import "@client/pages/registry.css";

/** A goal's bar, or for an open fund (no price) just what's been given so far. */
function ProgressBar({ item }: { item: RegistryItem }) {
  if (item.priceCents === null) {
    return (
      <div className="gift-progress">
        <p className="gift-amounts">
          <span>{formatDollars(item.raisedCents)} given so far</span>
        </p>
      </div>
    );
  }
  const percent = percentFunded(item.priceCents, item.raisedCents);
  return (
    <div className="gift-progress">
      <div
        className="gift-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${item.name}: ${percent}% funded`}
      >
        <div className="gift-bar-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="gift-amounts">
        <span>{formatDollars(item.raisedCents)} given</span>
        <span>{formatDollars(item.priceCents)} goal</span>
      </p>
    </div>
  );
}

function ContributeForm({ item, onCancel }: { item: RegistryItem; onCancel: () => void }) {
  const remaining = remainingCents(item.priceCents, item.raisedCents);
  const suggested = Math.min(remaining, 5000);
  const [amount, setAmount] = useState(String(suggested / 100));
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const amountCents = dollarsToCents(amount);
    const problem = Number.isNaN(amountCents)
      ? "Please enter an amount in dollars, like 50 or 50.25."
      : contributionProblem(amountCents, item.priceCents, item.raisedCents);
    if (problem !== null) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      const body = { itemId: item.id, amountCents, name, note };
      const { url } = await apiFetch("/api/registry/checkout", checkoutResponse, {
        method: "POST",
        body,
      });
      window.location.assign(url);
    } catch (e) {
      setError(
        e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  };

  const minimum = Math.min(MIN_CONTRIBUTION_CENTS, remaining);
  return (
    <form className="gift-form" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`amount-${item.id}`}>
          {item.priceCents === null
            ? `Amount (at least ${formatDollars(minimum)})`
            : `Amount (${formatDollars(minimum)} to ${formatDollars(remaining)})`}
        </label>
        <input
          id={`amount-${item.id}`}
          inputMode="decimal"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`giver-${item.id}`}>Your name</label>
        <input
          id={`giver-${item.id}`}
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`note-${item.id}`}>A note for the couple (optional)</label>
        <textarea
          id={`note-${item.id}`}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      {error !== null && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="button secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button" type="submit" disabled={busy}>
          {busy ? "Opening checkout…" : "Continue to payment"}
        </button>
      </div>
      <p className="gift-secure">Payment is handled securely by Stripe.</p>
    </form>
  );
}

function GiftDetails({ item }: { item: RegistryItem }) {
  return (
    <>
      <h2>{item.name}</h2>
      {item.description !== null && <p className="gift-description">{item.description}</p>}
      {item.link !== null && (
        <a className="gift-link" href={item.link} target="_blank" rel="noreferrer">
          View item
        </a>
      )}
    </>
  );
}

function GiftAction({ item, acceptingGifts }: { item: RegistryItem; acceptingGifts: boolean }) {
  const [giving, setGiving] = useState(false);
  if (remainingCents(item.priceCents, item.raisedCents) === 0) {
    return <p className="gift-funded">Fully gifted. Thank you!</p>;
  }
  if (giving) return <ContributeForm item={item} onCancel={() => setGiving(false)} />;
  return (
    <div className="actions">
      <button
        className="button"
        type="button"
        disabled={!acceptingGifts}
        onClick={() => setGiving(true)}
      >
        Contribute
      </button>
    </div>
  );
}

function GiftCard({ item, acceptingGifts }: { item: RegistryItem; acceptingGifts: boolean }) {
  return (
    <article className="gift panel">
      {item.image !== null && <img className="gift-image" src={item.image} alt="" loading="lazy" />}
      <div className="gift-body">
        <GiftDetails item={item} />
        <ProgressBar item={item} />
        <GiftAction item={item} acceptingGifts={acceptingGifts} />
      </div>
    </article>
  );
}

function Notices({ registry, error }: { registry: RegistryResponse | null; error: string | null }) {
  const [params] = useSearchParams();
  return (
    <>
      {params.get("thanks") === "1" && (
        <p className="notice" role="status">
          Thank you for your gift! It can take a moment to show on the bar.
        </p>
      )}
      {registry !== null && !registry.acceptingGifts && (
        <p className="notice">Gifts open soon. Please check back.</p>
      )}
      {error !== null && <p className="notice error">{error}</p>}
      {registry === null && error === null && <p className="lede">Loading…</p>}
    </>
  );
}

export function Registry() {
  const [registry, setRegistry] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/registry", registryResponse)
      .then(setRegistry)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : "Couldn't load the registry."),
      );
  }, []);

  return (
    <>
      <section className="page registry">
        <h1>Registry</h1>
        {site.registryIntro !== null && <p className="lede">{site.registryIntro}</p>}
        <Notices registry={registry} error={error} />
        <div className="gift-list">
          {registry?.items.map((item) => (
            <GiftCard key={item.id} item={item} acceptingGifts={registry.acceptingGifts} />
          ))}
        </div>
      </section>
    </>
  );
}
