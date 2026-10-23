import { useState, type FormEvent } from "react";
import { PhotoDrop, UploadStatus } from "@client/photos/PhotoDrop.tsx";
import { uploadPhotos, type UploadProgress } from "@client/photos/upload.ts";

const chosenLabel = (count: number) =>
  count === 0 ? "Choose photos" : count === 1 ? "1 photo chosen" : `${count} photos chosen`;

function ShareResult({ progress, busy }: { progress: UploadProgress | null; busy: boolean }) {
  if (progress === null) return null;
  return (
    <>
      <UploadStatus progress={progress} busy={busy} />
      {!busy && progress.done > 0 && (
        <p className="notice">Thank you! Your photos will appear here once we've approved them.</p>
      )}
    </>
  );
}

/** Lets a guest on the guest list share photos; the couple approves each before it shows. */
export function GuestUpload() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (files.length === 0) return;
    setBusy(true);
    const fields = { firstName, lastName, caption };
    const result = await uploadPhotos(files, "/api/photos", fields, setProgress);
    setBusy(false);
    if (result.stopped === null && result.failed.length === 0) setFiles([]);
  };

  return (
    <form className="panel guest-upload" onSubmit={submit} aria-labelledby="share-heading">
      <h2 id="share-heading">Share your photos</h2>
      <p className="lede">
        Enter your name as it's written on your invitation. We'll add your photos here once we've
        had a look.
      </p>
      <div className="row">
        <div className="field">
          <label htmlFor="share-first">First name</label>
          <input
            id="share-first"
            autoComplete="given-name"
            required
            maxLength={60}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="share-last">Last name</label>
          <input
            id="share-last"
            autoComplete="family-name"
            required
            maxLength={60}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="share-caption">Caption (optional, shown with each photo)</label>
        <input
          id="share-caption"
          maxLength={300}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
      </div>
      <PhotoDrop label={chosenLabel(files.length)} disabled={busy} onFiles={setFiles} />
      <ShareResult progress={progress} busy={busy} />
      <div className="actions">
        <button className="button" type="submit" disabled={busy || files.length === 0}>
          {busy ? "Sharing…" : "Share photos"}
        </button>
      </div>
    </form>
  );
}
