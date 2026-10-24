import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { isImageFile, resizedImage } from "@client/photos/upload.ts";
import {
  dollarsToCents,
  formatDollars,
  MAX_PRICE_CENTS,
  REGISTRY_IMAGE_EDGE,
} from "@shared/registry.ts";
import {
  createdRegistryItem,
  okResponse,
  registryResponse,
  type RegistryItem,
  type RegistryItemFields,
  type RegistryResponse,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";
import "@client/pages/registry.css";

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

const itemPath = (id: string) => `/api/admin/registry/${encodeURIComponent(id)}`;

/** The form's fields as typed; the price is in dollars. */
interface Draft {
  name: string;
  description: string;
  price: string;
  link: string;
}

const BLANK: Draft = { name: "", description: "", price: "", link: "" };

const draftOf = (item: RegistryItem): Draft => ({
  name: item.name,
  description: item.description ?? "",
  price: item.priceCents === null ? "" : String(item.priceCents / 100),
  link: item.link ?? "",
});

/** The fields to send, or why they can't be sent yet. A blank cost makes an open fund. */
function fieldsOf(draft: Draft): RegistryItemFields | string {
  const link = draft.link.trim() === "" ? null : draft.link;
  const fields = { name: draft.name, description: draft.description, link };
  if (draft.price.trim() === "") return { ...fields, priceCents: null };
  const priceCents = dollarsToCents(draft.price);
  if (Number.isNaN(priceCents) || priceCents <= 0) {
    return "Please enter the price in dollars, like 250 or 249.99.";
  }
  if (priceCents > MAX_PRICE_CENTS)
    return `The price can be at most ${formatDollars(MAX_PRICE_CENTS)}.`;
  return { ...fields, priceCents };
}

/** Saves the item's text and, when one was chosen, its new picture. Resolves true on success. */
type SubmitItem = (fields: RegistryItemFields, picture: File | null) => Promise<boolean>;

function TextFields(props: {
  id: string;
  draft: Draft;
  busy: boolean;
  set: (d: Partial<Draft>) => void;
}) {
  const { id, draft, busy, set } = props;
  return (
    <>
      <div className="field">
        <label htmlFor={`${id}-name`}>Item name</label>
        <input
          id={`${id}-name`}
          required
          maxLength={120}
          value={draft.name}
          disabled={busy}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-description`}>Short description</label>
        <textarea
          id={`${id}-description`}
          required
          maxLength={500}
          rows={3}
          value={draft.description}
          disabled={busy}
          onChange={(e) => set({ description: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${id}-price`}>Cost in dollars (optional)</label>
        <input
          id={`${id}-price`}
          inputMode="decimal"
          aria-describedby={`${id}-price-hint`}
          value={draft.price}
          disabled={busy}
          onChange={(e) => set({ price: e.target.value })}
        />
        <p id={`${id}-price-hint`} className="admin-muted">
          Leave blank for an open fund, like a honeymoon fund. It shows what&apos;s been given so
          far instead of a progress bar.
        </p>
      </div>
      <div className="field">
        <label htmlFor={`${id}-link`}>Link to the item (optional)</label>
        <input
          id={`${id}-link`}
          type="url"
          maxLength={2000}
          placeholder="https://"
          value={draft.link}
          disabled={busy}
          onChange={(e) => set({ link: e.target.value })}
        />
      </div>
    </>
  );
}

/** Name, description, and optional cost, link and picture; used to add an item and to edit one. */
function ItemForm(props: {
  id: string;
  initial: Draft;
  hasPicture: boolean;
  submitLabel: string;
  busy: boolean;
  onSubmit: SubmitItem;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [picture, setPicture] = useState<File | null>(null);
  const [pickerKey, setPickerKey] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const fields = fieldsOf(draft);
    setProblem(typeof fields === "string" ? fields : null);
    if (typeof fields === "string" || !(await props.onSubmit(fields, picture))) return;
    if (props.onCancel !== undefined) return;
    setDraft(props.initial);
    setPicture(null);
    setPickerKey(pickerKey + 1);
  };
  return (
    <form className="admin-question-form" onSubmit={(e) => void submit(e)}>
      <TextFields
        id={props.id}
        draft={draft}
        busy={props.busy}
        set={(change) => setDraft({ ...draft, ...change })}
      />
      <div className="field">
        <label htmlFor={`${props.id}-picture`}>
          {props.hasPicture ? "Replace the picture (optional)" : "Picture (optional)"}
        </label>
        <input
          key={pickerKey}
          id={`${props.id}-picture`}
          type="file"
          accept="image/*,.heic,.heif"
          disabled={props.busy}
          onChange={(e) => setPicture(e.target.files?.[0] ?? null)}
        />
      </div>
      {problem !== null && (
        <p className="notice error" role="alert">
          {problem}
        </p>
      )}
      <div className="admin-photo-actions">
        <button className="button" type="submit" disabled={props.busy}>
          {props.busy ? "Saving…" : props.submitLabel}
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
  onSave: (
    item: RegistryItem,
    fields: RegistryItemFields,
    picture: File | null,
  ) => Promise<boolean>;
  onRemovePicture: (item: RegistryItem) => void;
  onDelete: (item: RegistryItem) => void;
}

function ItemSummary({ item }: { item: RegistryItem }) {
  return (
    <>
      <p className="admin-question-q">
        {item.name} · {item.priceCents === null ? "open fund" : formatDollars(item.priceCents)}
      </p>
      {item.description !== null && <p className="admin-question-a">{item.description}</p>}
      <p className="admin-muted">
        {formatDollars(item.raisedCents)} given so far
        {item.link !== null && (
          <>
            {" · "}
            <a className="gift-link" href={item.link} target="_blank" rel="noreferrer">
              View item
            </a>
          </>
        )}
      </p>
    </>
  );
}

function RowButtons(
  props: { item: RegistryItem; busy: boolean; onEdit: () => void } & Omit<
    RowActions,
    "onSave" | "busy"
  >,
) {
  const { item, busy } = props;
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="admin-confirm" role="group" aria-label="Confirm delete">
        <span>Delete this item?</span>
        <button
          className="button admin-delete"
          type="button"
          disabled={busy}
          onClick={() => props.onDelete(item)}
        >
          Yes, delete
        </button>
        <button
          className="button secondary admin-delete"
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </span>
    );
  }
  return (
    <>
      <button
        className="button secondary admin-delete"
        type="button"
        disabled={busy}
        onClick={props.onEdit}
      >
        Edit
      </button>
      {item.image !== null && (
        <button
          className="button secondary admin-delete"
          type="button"
          disabled={busy}
          onClick={() => props.onRemovePicture(item)}
        >
          Remove picture
        </button>
      )}
      {item.raisedCents === 0 && (
        <button
          className="button secondary admin-delete"
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
        >
          Delete
        </button>
      )}
    </>
  );
}

function ItemRow({ item, ...actions }: { item: RegistryItem } & RowActions) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <li className="admin-question">
        <ItemForm
          id={`edit-${item.id}`}
          initial={draftOf(item)}
          hasPicture={item.image !== null}
          submitLabel="Save"
          busy={actions.busy}
          onSubmit={async (fields, picture) => {
            const saved = await actions.onSave(item, fields, picture);
            if (saved) setEditing(false);
            return saved;
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }
  return (
    <li className="admin-question gift">
      {item.image !== null && <img className="gift-image" src={item.image} alt="" loading="lazy" />}
      <div>
        <ItemSummary item={item} />
        <div className="admin-photo-actions">
          <RowButtons
            item={item}
            busy={actions.busy}
            onEdit={() => setEditing(true)}
            onRemovePicture={actions.onRemovePicture}
            onDelete={actions.onDelete}
          />
        </div>
      </div>
    </li>
  );
}

function ItemList({ items, ...actions }: { items: RegistryItem[] } & RowActions) {
  return (
    <section className="admin-guests" aria-labelledby="items-heading">
      <h2 id="items-heading">Items</h2>
      {items.length === 0 && <p className="admin-muted">No items yet.</p>}
      <ul className="admin-question-list">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} {...actions} />
        ))}
      </ul>
    </section>
  );
}

async function uploadPicture(id: string, picture: File): Promise<void> {
  if (!isImageFile(picture)) throw new Error(`"${picture.name}" isn't an image.`);
  const body = new FormData();
  body.set("image", await resizedImage(picture, REGISTRY_IMAGE_EDGE));
  await apiFetch(`${itemPath(id)}/image`, okResponse, { method: "POST", body });
}

function StripeStatus({ acceptingGifts }: { acceptingGifts: boolean }) {
  return acceptingGifts ? (
    <p className="notice">Stripe is connected. Guests can give toward these items.</p>
  ) : (
    <p className="notice">
      Stripe isn&apos;t connected yet, so guests see these items with &ldquo;Gifts open soon&rdquo;
      and can&apos;t give yet.
    </p>
  );
}

export function AdminRegistry() {
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/api/admin/registry", registryResponse)
        .then(setData)
        .catch((e: unknown) => setError(errorMessage(e, "Couldn't load the registry."))),
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
      setError(e instanceof Error ? e.message : fallback);
    }
    await load();
    setBusy(false);
    return ok;
  };

  /** A picture that fails still leaves the item added, so the form clears and can't add it twice. */
  const create: SubmitItem = async (body, picture) => {
    let pictureError: string | null = null;
    const added = await run(async () => {
      const { id } = await apiFetch("/api/admin/registry", createdRegistryItem, {
        method: "POST",
        body,
      });
      if (picture === null) return;
      pictureError = await uploadPicture(id, picture).then(
        () => null,
        (e: unknown) => (e instanceof Error ? e.message : "It couldn't be uploaded."),
      );
    }, "Couldn't add that item.");
    if (pictureError !== null) {
      setError(
        `The item was added, but its picture didn't upload: ${pictureError} Use Edit to try again.`,
      );
    }
    return added;
  };
  const save = (item: RegistryItem, body: RegistryItemFields, picture: File | null) =>
    run(async () => {
      await apiFetch(itemPath(item.id), okResponse, { method: "PATCH", body });
      if (picture !== null) await uploadPicture(item.id, picture);
    }, "Couldn't save that change.");
  const removePicture = (item: RegistryItem) =>
    void run(
      () => apiFetch(`${itemPath(item.id)}/image`, okResponse, { method: "DELETE" }),
      "Couldn't remove that picture.",
    );
  const remove = (item: RegistryItem) =>
    void run(
      () => apiFetch(itemPath(item.id), okResponse, { method: "DELETE" }),
      "Couldn't delete that item.",
    );

  return (
    <section className="page admin">
      <h1>Registry</h1>
      <p className="admin-nav">
        <Link to="/admin">← RSVPs</Link> · <Link to="/registry">See the Registry page</Link>
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {data === null && error === null && <p className="lede">Loading…</p>}
      {data !== null && (
        <>
          <StripeStatus acceptingGifts={data.acceptingGifts} />
          <section className="admin-guests" aria-labelledby="add-heading">
            <h2 id="add-heading">Add an item</h2>
            <p className="admin-muted">It shows on the Registry page as soon as you add it.</p>
            <ItemForm
              id="new"
              initial={BLANK}
              hasPicture={false}
              submitLabel="Add item"
              busy={busy}
              onSubmit={create}
            />
          </section>
          <ItemList
            items={data.items}
            busy={busy}
            onSave={save}
            onRemovePicture={removePicture}
            onDelete={remove}
          />
        </>
      )}
    </section>
  );
}
