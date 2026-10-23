import { useState, type FormEvent } from "react";
import { PhotoDrop, UploadStatus } from "@client/photos/PhotoDrop.tsx";
import { uploadPhotos, type UploadProgress } from "@client/photos/upload.ts";
import { ApiRequestError } from "@client/api.ts";
import { type SessionGuest, useSession } from "@client/session.ts";

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

interface NameFieldsProps {
  firstName: string;
  lastName: string;
  onFirstName: (value: string) => void;
  onLastName: (value: string) => void;
}

function NameFields({ firstName, lastName, onFirstName, onLastName }: NameFieldsProps) {
  return (
    <>
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
            onChange={(e) => onFirstName(e.target.value)}
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
            onChange={(e) => onLastName(e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

/** Names the guest the session says is sharing, with a way out on a shared device. */
function SharingAs({ guest, onSignOut }: { guest: SessionGuest; onSignOut: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const signOut = () =>
    onSignOut().catch((e: unknown) =>
      setError(
        e instanceof ApiRequestError ? e.message : "Something went wrong. Please try again.",
      ),
    );
  return (
    <>
      <p className="lede">
        Sharing as {guest.firstName} {guest.lastName}.{" "}
        <button type="button" className="link-button" onClick={signOut}>
          Not you?
        </button>{" "}
        We'll add your photos here once we've had a look.
      </p>
      {error !== null && <p className="notice error">{error}</p>}
    </>
  );
}

/**
 * Lets a guest on the guest list share photos; the couple approves each before it shows. A guest
 * who has RSVPed in this browser shares under their session's name; anyone else types theirs.
 */
export function GuestUpload() {
  const { guest, signOut } = useSession();
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
    const fields = guest ? { caption } : { firstName, lastName, caption };
    const result = await uploadPhotos(files, "/api/photos", fields, setProgress);
    setBusy(false);
    if (result.stopped === null && result.failed.length === 0) setFiles([]);
  };

  return (
    <form className="panel guest-upload" onSubmit={submit} aria-labelledby="share-heading">
      <h2 id="share-heading">Share your photos</h2>
      {guest ? (
        <SharingAs guest={guest} onSignOut={signOut} />
      ) : (
        <NameFields
          firstName={firstName}
          lastName={lastName}
          onFirstName={setFirstName}
          onLastName={setLastName}
        />
      )}
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
        <button
          className="button"
          type="submit"
          disabled={busy || guest === undefined || files.length === 0}
        >
          {busy ? "Sharing…" : "Share photos"}
        </button>
      </div>
    </form>
  );
}
