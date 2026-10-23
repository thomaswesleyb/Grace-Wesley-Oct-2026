import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { Gallery } from "@client/photos/Gallery.tsx";
import { GuestUpload } from "@client/photos/GuestUpload.tsx";
import { site } from "@client/site.ts";
import { photosResponse, type PhotosResponse } from "@shared/schemas.ts";
import "@client/pages/photos.css";

function PhotoSections({ list }: { list: PhotosResponse }) {
  if (list.photos.length === 0 && list.guestPhotos.length === 0) {
    return <p className="notice">Photos coming soon.</p>;
  }
  return (
    <>
      {list.photos.length > 0 && <Gallery photos={list.photos} />}
      {list.guestPhotos.length > 0 && (
        <section aria-labelledby="guest-photos-heading">
          <h2 id="guest-photos-heading" className="photos-subheading">
            From our guests
          </h2>
          <Gallery photos={list.guestPhotos} />
        </section>
      )}
    </>
  );
}

export function Photos() {
  const [list, setList] = useState<PhotosResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/photos", photosResponse)
      .then(setList)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : "Couldn't load the photos."),
      );
  }, []);

  return (
    <section className="page photos-page">
      <h1>Photos</h1>
      {site.photosIntro !== null && <p className="lede">{site.photosIntro}</p>}
      {error !== null && <p className="notice error">{error}</p>}
      {list === null && error === null && <p className="lede">Loading photos…</p>}
      {list !== null && <PhotoSections list={list} />}
      {list?.uploadsOpen === true && <GuestUpload />}
    </section>
  );
}
