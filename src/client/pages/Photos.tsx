import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { site } from "@client/site.ts";
import gallery from "@content/gallery.json";
import type { GalleryPhoto } from "@shared/site.ts";
import "@client/pages/photos.css";

const photos = gallery as GalleryPhoto[];

/** A swipe shorter than this (in CSS pixels) is treated as a tap. */
const MIN_SWIPE = 40;

const srcSet = (photo: GalleryPhoto) =>
  photo.small.src === photo.src
    ? undefined
    : `${photo.small.src} ${photo.small.width}w, ${photo.src} ${photo.width}w`;

interface LightboxProps {
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}

function Lightbox({ index, onIndex, onClose }: LightboxProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const swipeStart = useRef<number | null>(null);
  const photo = photos[index];
  const step = (by: number) => onIndex((index + by + photos.length) % photos.length);

  useEffect(() => {
    const element = dialog.current;
    if (element !== null && !element.open) element.showModal();
  }, []);

  if (photo === undefined) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  };
  const onPointerDown = (event: PointerEvent) => {
    swipeStart.current = event.clientX;
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start === null) return;
    const dx = event.clientX - start;
    if (Math.abs(dx) >= MIN_SWIPE) step(dx < 0 ? 1 : -1);
  };

  return (
    <dialog
      ref={dialog}
      className="lightbox"
      aria-label={`Photo ${index + 1} of ${photos.length}`}
      onClose={onClose}
      onKeyDown={onKeyDown}
      onClick={(event) => event.target === dialog.current && dialog.current.close()}
    >
      <figure onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} />
        {photo.caption !== null && <figcaption>{photo.caption}</figcaption>}
      </figure>
      <div className="lightbox-controls">
        {photos.length > 1 && (
          <button type="button" className="button secondary" onClick={() => step(-1)}>
            ← Previous
          </button>
        )}
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()}>
          Close
        </button>
        {photos.length > 1 && (
          <button type="button" className="button secondary" onClick={() => step(1)}>
            Next →
          </button>
        )}
      </div>
    </dialog>
  );
}

export function Photos() {
  const [open, setOpen] = useState<number | null>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = () => {
    if (open !== null) thumbs.current[open]?.focus();
    setOpen(null);
  };

  return (
    <section className="page photos-page">
      <h1>Photos</h1>
      {site.photosIntro !== null && <p className="lede">{site.photosIntro}</p>}
      {photos.length === 0 ? (
        <p className="notice">Photos coming soon.</p>
      ) : (
        <ul className="photo-grid">
          {photos.map((photo, index) => (
            <li key={photo.src}>
              <button
                ref={(element) => {
                  thumbs.current[index] = element;
                }}
                type="button"
                className="photo-thumb"
                onClick={() => setOpen(index)}
              >
                <img
                  src={photo.small.src}
                  srcSet={srcSet(photo)}
                  sizes="(min-width: 60rem) 20rem, (min-width: 36rem) 45vw, 92vw"
                  alt={photo.alt}
                  width={photo.width}
                  height={photo.height}
                  loading="lazy"
                  decoding="async"
                />
              </button>
              {photo.caption !== null && <p className="photo-caption">{photo.caption}</p>}
            </li>
          ))}
        </ul>
      )}
      {open !== null && <Lightbox index={open} onIndex={setOpen} onClose={close} />}
    </section>
  );
}
