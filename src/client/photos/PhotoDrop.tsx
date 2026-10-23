import { useState, type DragEvent } from "react";
import { isImageFile, type UploadProgress } from "@client/photos/upload.ts";

interface PhotoDropProps {
  label: string;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}

/** A drop area for photos that also opens the file picker when tapped. */
export function PhotoDrop({ label, disabled = false, onFiles }: PhotoDropProps) {
  const [over, setOver] = useState(false);
  const take = (files: FileList | null) => {
    const images = [...(files ?? [])].filter(isImageFile);
    if (images.length > 0) onFiles(images);
  };
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    if (!disabled) setOver(true);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    if (!disabled) take(event.dataTransfer.files);
  };
  return (
    <label
      className={`photo-drop${over ? " over" : ""}${disabled ? " disabled" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <input
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        className="visually-hidden"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files);
          event.target.value = "";
        }}
      />
      <span className="photo-drop-label">{label}</span>
      <span className="photo-drop-hint">Drag photos here, or tap to choose them</span>
    </label>
  );
}

const photoCount = (n: number) => (n === 1 ? "1 photo" : `${n} photos`);

/** "Uploading 3 of 8…" while busy, then what uploaded and what didn't. */
export function UploadStatus({ progress, busy }: { progress: UploadProgress; busy: boolean }) {
  const { done, total, failed, stopped } = progress;
  return (
    <div className="upload-status" role="status">
      {busy ? (
        <p>
          Uploading {Math.min(done + failed.length + 1, total)} of {total}…
        </p>
      ) : (
        <p>Uploaded {photoCount(done)}.</p>
      )}
      {stopped !== null && <p className="notice error">{stopped}</p>}
      {failed.length > 0 && (
        <div className="notice error">
          <p>{photoCount(failed.length)} didn't upload:</p>
          <ul>
            {failed.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
