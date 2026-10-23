import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { srcSet } from "@client/photos/Gallery.tsx";
import { PhotoDrop, UploadStatus } from "@client/photos/PhotoDrop.tsx";
import { uploadPhotos, type UploadProgress } from "@client/photos/upload.ts";
import {
  adminPhotosResponse,
  okResponse,
  type AdminPhoto,
  type AdminPhotosResponse,
  type PhotoEdit,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";
import "@client/pages/photos.css";

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

const photoPath = (photo: AdminPhoto) => `/api/admin/photos/${encodeURIComponent(photo.id)}`;

interface CardActions {
  busy: boolean;
  onEdit: (photo: AdminPhoto, edit: PhotoEdit) => void;
  onDelete: (photo: AdminPhoto) => void;
  /** Only the couple's photos can be moved. */
  onMove?: (photo: AdminPhoto, by: -1 | 1) => void;
}

/** Saves a text field when it loses focus, if it changed. Give it `key={value}` to reset it. */
function EditableText(props: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(props.value);
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        maxLength={300}
        value={value}
        disabled={props.disabled}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => value.trim() !== props.value && props.onSave(value)}
      />
    </div>
  );
}

function DeleteButton({ photo, busy, onDelete }: { photo: AdminPhoto } & CardActions) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        className="button secondary admin-delete"
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
      >
        Delete
      </button>
    );
  }
  return (
    <span className="admin-confirm" role="group" aria-label="Confirm delete">
      <button
        className="button admin-delete"
        type="button"
        disabled={busy}
        onClick={() => onDelete(photo)}
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

function PhotoCard(props: { photo: AdminPhoto; position: string } & CardActions) {
  const { photo, busy, onEdit, onMove, position } = props;
  const pending = photo.status === "pending";
  return (
    <li className={`admin-photo${pending ? " pending" : ""}`}>
      <img
        src={photo.small.src}
        srcSet={srcSet(photo)}
        sizes="16rem"
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading="lazy"
      />
      <div className="admin-photo-body">
        <p className="admin-muted">
          {position}
          {photo.credit !== null && ` · from ${photo.credit}`} · {photo.createdAt.slice(0, 10)}
        </p>
        <EditableText
          key={`caption-${photo.caption ?? ""}`}
          id={`caption-${photo.id}`}
          label="Caption"
          value={photo.caption ?? ""}
          disabled={busy}
          onSave={(caption) => onEdit(photo, { caption })}
        />
        <EditableText
          key={`alt-${photo.altText}`}
          id={`alt-${photo.id}`}
          label="Description for screen readers"
          value={photo.altText}
          disabled={busy}
          onSave={(alt) => onEdit(photo, { alt })}
        />
        <div className="admin-photo-actions">
          {pending && (
            <button
              className="button admin-delete"
              type="button"
              disabled={busy}
              onClick={() => onEdit(photo, { status: "approved" })}
            >
              Approve
            </button>
          )}
          {onMove !== undefined && (
            <>
              <button
                className="button secondary admin-delete"
                type="button"
                disabled={busy}
                aria-label="Move earlier"
                onClick={() => onMove(photo, -1)}
              >
                ↑
              </button>
              <button
                className="button secondary admin-delete"
                type="button"
                disabled={busy}
                aria-label="Move later"
                onClick={() => onMove(photo, 1)}
              >
                ↓
              </button>
            </>
          )}
          <DeleteButton {...props} />
        </div>
      </div>
    </li>
  );
}

function PhotoSection(props: { title: string; empty: string; photos: AdminPhoto[] } & CardActions) {
  const { title, empty, photos, ...actions } = props;
  return (
    <section className="admin-guests">
      <h2>
        {title} ({photos.length})
      </h2>
      {photos.length === 0 ? (
        <p className="admin-muted">{empty}</p>
      ) : (
        <ul className="admin-photo-list">
          {photos.map((photo, i) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              position={`${i + 1} of ${photos.length}`}
              {...actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${Math.max(bytes / 1024 ** 2, bytes > 0 ? 0.1 : 0).toFixed(1)} MB`;

function StorageUse({ storage }: { storage: AdminPhotosResponse["storage"] }) {
  const percent = Math.min(100, (storage.usedBytes / storage.limitBytes) * 100);
  return (
    <p className="admin-muted admin-storage">
      Storage: {formatBytes(storage.usedBytes)} of {formatBytes(storage.limitBytes)} used (
      {percent < 1 && percent > 0 ? "under 1" : Math.round(percent)}%). Uploads stop at the limit,
      so the free 10 GB is never exceeded.
    </p>
  );
}

function UploadsToggle(props: { open: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <div className="notice admin-uploads">
      <p>
        Guest photo sharing is <strong>{props.open ? "open" : "closed"}</strong>.{" "}
        {props.open
          ? "Guests on the guest list can share photos from the Photos page. Each waits for your approval."
          : "Open it after the wedding so guests can share their photos."}
      </p>
      <button
        className="button secondary"
        type="button"
        disabled={props.busy}
        onClick={props.onToggle}
      >
        {props.open ? "Close guest sharing" : "Open guest sharing"}
      </button>
    </div>
  );
}

/** Moves `photo` one place earlier or later among `photos`; null when it's already at the end. */
function moved(photos: AdminPhoto[], photo: AdminPhoto, by: -1 | 1): AdminPhoto[] | null {
  const from = photos.indexOf(photo);
  const to = from + by;
  if (from < 0 || to < 0 || to >= photos.length) return null;
  const next = [...photos];
  next.splice(from, 1);
  next.splice(to, 0, photo);
  return next;
}

export function AdminPhotos() {
  const [list, setList] = useState<AdminPhotosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const load = useCallback(
    () =>
      apiFetch("/api/admin/photos", adminPhotosResponse)
        .then(setList)
        .catch((e: unknown) => setError(errorMessage(e, "Couldn't load the photos."))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one change, shows its error if it fails, then reloads the list either way. */
  const run = async (change: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await change();
    } catch (e) {
      setError(errorMessage(e, fallback));
    }
    await load();
    setBusy(false);
  };

  const upload = (files: File[]) =>
    run(() => uploadPhotos(files, "/api/admin/photos", {}, setProgress), "Upload failed.");
  const edit = (photo: AdminPhoto, body: PhotoEdit) =>
    run(
      () => apiFetch(photoPath(photo), okResponse, { method: "PATCH", body }),
      "Couldn't save that change.",
    );
  const remove = (photo: AdminPhoto) =>
    run(
      () => apiFetch(photoPath(photo), okResponse, { method: "DELETE" }),
      "Couldn't delete that photo.",
    );
  const toggle = () =>
    run(
      () =>
        apiFetch("/api/admin/photos/uploads", okResponse, {
          method: "POST",
          body: { open: !(list?.uploadsOpen ?? false) },
        }),
      "Couldn't change guest sharing.",
    );

  const photos = list?.photos ?? [];
  const ours = photos.filter((p) => p.source === "couple");
  const move = (photo: AdminPhoto, by: -1 | 1) => {
    const next = moved(ours, photo, by);
    if (next === null) return;
    const ids = next.map((p) => p.id);
    return run(
      () => apiFetch("/api/admin/photos/order", okResponse, { method: "POST", body: { ids } }),
      "Couldn't reorder the photos.",
    );
  };
  const actions = { busy, onEdit: edit, onDelete: remove };

  return (
    <section className="page admin">
      <h1>Photos</h1>
      <p className="admin-nav">
        <Link to="/admin">← RSVPs</Link> · <Link to="/photos">See the Photos page</Link>
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {list === null && error === null && <p className="lede">Loading…</p>}
      {list !== null && (
        <>
          <PhotoDrop label="Add photos" disabled={busy} onFiles={upload} />
          {progress !== null && <UploadStatus progress={progress} busy={busy} />}
          <StorageUse storage={list.storage} />
          <UploadsToggle open={list.uploadsOpen} busy={busy} onToggle={toggle} />
          <PhotoSection
            title="Waiting for approval"
            empty="No guest photos are waiting."
            photos={photos.filter((p) => p.status === "pending")}
            {...actions}
          />
          <PhotoSection
            title="Our photos"
            empty="No photos yet. Add some above."
            photos={ours}
            onMove={move}
            {...actions}
          />
          <PhotoSection
            title="Guests' photos"
            empty="No approved guest photos yet."
            photos={photos.filter((p) => p.source === "guest" && p.status === "approved")}
            {...actions}
          />
        </>
      )}
    </section>
  );
}
