import type { CSSProperties } from "react";
import { Link } from "react-router";
import { Backdrop } from "@client/components/Backdrop.tsx";
import { Countdown } from "@client/components/Countdown.tsx";
import { Filigree, Lattice } from "@client/components/Ornaments.tsx";
import { site } from "@client/site.ts";
import "@client/pages/home.css";

/** Staggers the fade-up animation of each invitation line. */
const order = (i: number) => ({ "--i": i }) as CSSProperties;

function Invitation() {
  return (
    <article className="invitation" aria-label="Invitation">
      <img className="inv-photo" src="/photos/couple-sepia.webp" alt="" />
      <Lattice side="left" />
      <Lattice side="right" />
      <Filigree position="top" />
      <Filigree position="bottom" />
      <h1 className="inv-names">
        <span className="inv-line inv-name-1" style={order(0)}>
          {site.brideFormal}
        </span>{" "}
        <span className="inv-line inv-and" style={order(1)}>
          and
        </span>{" "}
        <span className="inv-line inv-name-2" style={order(2)}>
          {site.groomFormal}
        </span>
      </h1>
      <p className="inv-invite">
        <span className="inv-line inv-invite-1" style={order(3)}>
          Invite you to join us as
        </span>{" "}
        <span className="inv-line inv-invite-2" style={order(3)}>
          we celebrate our
        </span>{" "}
        <span className="inv-line inv-invite-3" style={order(3)}>
          wedding day
        </span>
      </p>
      <p className="inv-when">
        <time dateTime={site.startsAt ?? undefined}>
          <span className="inv-line inv-date" style={order(4)}>
            {site.dateText}
          </span>{" "}
          <span className="inv-line inv-time" style={order(5)}>
            {site.timeText}
          </span>
        </time>
      </p>
      <p className="inv-where">
        <a href={site.mapUrl} target="_blank" rel="noreferrer">
          <span className="inv-line inv-venue" style={order(6)}>
            {site.ceremonyVenue}
          </span>{" "}
          <span className="inv-line inv-city" style={order(6)}>
            {site.ceremonyCityState}
          </span>
        </a>
      </p>
      <p className="inv-line inv-rsvp" style={order(7)}>
        <Link to="/rsvp">Kindly RSVP on our website</Link>
      </p>
      <p className="inv-line inv-site" style={order(8)}>
        {site.website}
      </p>
    </article>
  );
}

export function Home() {
  return (
    <>
      <Backdrop src="/photos/all-saints.webp" position="center 35%" />
      <section className="invitation-stage">
        <Invitation />
        <a className="scroll-cue" href="#the-day" aria-label="Scroll to the details">
          ⌄
        </a>
      </section>

      <section id="the-day" className="page the-day">
        <h2>The Ceremony</h2>
        <hr className="rule" />
        <dl className="day-details">
          <div>
            <dt>When</dt>
            <dd>
              {site.dateText} at {site.timeText}
            </dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>
              {site.ceremonyVenue}
              {site.ceremonyAddress === null ? null : <>, {site.ceremonyAddress}</>}
              <br />
              {site.ceremonyCityState}
              <br />
              <a href={site.mapUrl} target="_blank" rel="noreferrer">
                Open in Maps
              </a>
            </dd>
          </div>
        </dl>
        {site.startsAt === null ? null : <Countdown startsAt={site.startsAt} />}
        <div className="actions">
          <Link className="button" to="/rsvp">
            RSVP
          </Link>
          <Link className="button secondary" to="/qa">
            Questions &amp; Answers
          </Link>
        </div>
      </section>
    </>
  );
}
