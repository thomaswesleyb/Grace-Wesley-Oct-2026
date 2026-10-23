import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { formatDollars } from "@shared/registry.ts";
import {
  adminSummary,
  okResponse,
  type AdminContribution,
  type AdminGuest,
  type AdminRsvp,
  type AdminSummary,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";

const csvCell = (value: string | null) => {
  const text = value ?? "";
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const guestName = (guest: AdminGuest | undefined) =>
  guest === undefined ? null : `${guest.firstName} ${guest.lastName}`;

/**
 * One row per person, for spreadsheets and caterer counts. `rsvp_id` groups one form, and
 * `current` is "No" on answers a guest later replaced.
 */
export function toCsv(rsvps: AdminRsvp[], guests: AdminGuest[]): string {
  const byId = new Map(guests.map((g) => [g.id, g]));
  const header = [
    "rsvp_id",
    "guest",
    "spots",
    "current",
    "first_name",
    "last_name",
    "attending",
    "dietary",
    "email",
    "song_request",
    "note",
    "submitted_at",
  ];
  const rows = rsvps.flatMap((r) => {
    const guest = r.guestId === null ? undefined : byId.get(r.guestId);
    return r.people.map((p) => [
      r.id,
      guestName(guest),
      guest === undefined ? null : String(guest.spots),
      r.replacedAt === null ? "Yes" : "No",
      p.firstName,
      p.lastName,
      p.attending ? "Yes" : "No",
      p.dietary,
      r.email,
      r.songRequest,
      r.note,
      r.createdAt,
    ]);
  });
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function download(rsvps: AdminRsvp[], guests: AdminGuest[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rsvps, guests)], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function TotalTiles({ totals }: { totals: AdminSummary["totals"] }) {
  const tiles: [string, number, string][] = [
    ["Places", totals.places, "Seats offered across the guest list"],
    ["Attending", totals.attending, "People who said yes"],
    ["Declining", totals.declining, "People who said no"],
    ["Not answered", totals.notAnswered, "Guests with places who haven't sent an RSVP"],
  ];
  return (
    <div className="admin-tiles">
      {tiles.map(([label, value, hint]) => (
        <div key={label} className="admin-tile" title={hint}>
          <span className="admin-tile-value">{value}</span>
          <span className="admin-tile-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

interface RsvpRowProps {
  rsvp: AdminRsvp;
  guest: AdminGuest | undefined;
  busy: boolean;
  onDelete: (rsvp: AdminRsvp) => void;
}

/** Two clicks to delete: "Delete" asks first, and only "Yes, delete" removes the RSVP. */
function DeleteControl({ rsvp, busy, onDelete }: RsvpRowProps) {
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
    <div className="admin-confirm" role="group" aria-label="Confirm delete">
      <span>Delete this RSVP?</span>
      <button
        className="button admin-delete"
        type="button"
        disabled={busy}
        onClick={() => onDelete(rsvp)}
      >
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        className="button secondary admin-delete"
        type="button"
        disabled={busy}
        onClick={() => setConfirming(false)}
      >
        Cancel
      </button>
    </div>
  );
}

function RsvpRow(props: RsvpRowProps) {
  const { rsvp, guest } = props;
  const replaced = rsvp.replacedAt !== null;
  return (
    <tr className={replaced ? "admin-replaced" : undefined}>
      <td>
        {rsvp.createdAt.slice(0, 10)}
        {replaced && <div className="admin-muted">Replaced</div>}
      </td>
      <td>
        {guestName(guest) ?? <span className="admin-muted">Not linked</span>}
        {guest !== undefined && <div className="admin-muted">{guest.spots} places</div>}
      </td>
      <td>
        {rsvp.people.map((p) => (
          <div key={p.id}>
            {p.firstName} {p.lastName}: {p.attending ? "Yes" : "No"}
            {p.dietary && <span className="admin-muted"> · {p.dietary}</span>}
          </div>
        ))}
      </td>
      <td>{rsvp.email}</td>
      <td>{rsvp.songRequest ?? ""}</td>
      <td>{rsvp.note ?? ""}</td>
      <td>
        <DeleteControl {...props} />
      </td>
    </tr>
  );
}

function GiftsTable({ gifts }: { gifts: AdminContribution[] }) {
  const total = gifts.reduce((sum, g) => sum + g.amountCents, 0);
  return (
    <section className="admin-gifts" aria-labelledby="gifts-heading">
      <h2 id="gifts-heading">
        Gifts: {formatDollars(total)} from {gifts.length}
      </h2>
      {gifts.length === 0 ? (
        <p className="admin-muted">No gifts yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>From</th>
                <th>Item</th>
                <th>Amount</th>
                <th>Email</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.id}>
                  <td>{g.createdAt.slice(0, 10)}</td>
                  <td>{g.name}</td>
                  <td>{g.itemName}</td>
                  <td>{formatDollars(g.amountCents)}</td>
                  <td>{g.email ?? ""}</td>
                  <td>{g.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GuestsTable({ guests }: { guests: AdminGuest[] }) {
  const [onlyWaiting, setOnlyWaiting] = useState(false);
  const shown = onlyWaiting ? guests.filter((g) => g.spots > 0 && g.answeredAt === null) : guests;
  return (
    <section className="admin-guests" aria-labelledby="guests-heading">
      <h2 id="guests-heading">Guest list</h2>
      <label className="admin-filter">
        <input
          type="checkbox"
          checked={onlyWaiting}
          onChange={(e) => setOnlyWaiting(e.target.checked)}
        />
        Only guests who haven't answered
      </label>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Places</th>
              <th>Answered</th>
              <th>Attending</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <tr key={g.id}>
                <td>{guestName(g)}</td>
                <td>{g.spots === 0 ? "Can't attend" : g.spots}</td>
                <td>{g.answeredAt?.slice(0, 10) ?? ""}</td>
                <td>{g.attending ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiRequestError ? e.message : fallback;

export function Admin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    () =>
      apiFetch("/api/admin/summary", adminSummary)
        .then(setSummary)
        .catch((e: unknown) => setError(errorMessage(e, "Couldn't load RSVPs."))),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (rsvp: AdminRsvp) => {
    setDeleting(true);
    setError(null);
    try {
      const path = `/api/admin/rsvps/${encodeURIComponent(rsvp.id)}`;
      await apiFetch(path, okResponse, { method: "DELETE" });
    } catch (e) {
      setError(errorMessage(e, "Couldn't delete that RSVP."));
    }
    await load();
    setDeleting(false);
  };

  const guestsById = new Map(summary?.guests.map((g) => [g.id, g]));
  return (
    <section className="page admin">
      <h1>RSVPs</h1>
      <p className="admin-nav">
        <Link to="/admin/photos">Manage photos →</Link> ·{" "}
        <Link to="/admin/questions">Manage Q&amp;A →</Link>
      </p>
      {error !== null && <p className="notice error">{error}</p>}
      {summary === null && error === null && <p className="lede">Loading…</p>}
      {summary !== null && (
        <>
          <TotalTiles totals={summary.totals} />
          <div className="actions">
            <button
              className="button"
              type="button"
              onClick={() => download(summary.rsvps, summary.guests)}
            >
              Download CSV
            </button>
          </div>
          {summary.rsvps.length === 0 ? (
            <p className="admin-muted">No RSVPs yet.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Guest</th>
                    <th>People</th>
                    <th>Email</th>
                    <th>Song</th>
                    <th>Note</th>
                    <th>
                      <span className="visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rsvps.map((rsvp) => (
                    <RsvpRow
                      key={rsvp.id}
                      rsvp={rsvp}
                      guest={guestsById.get(rsvp.guestId ?? "")}
                      busy={deleting}
                      onDelete={remove}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <GuestsTable guests={summary.guests} />
          <GiftsTable gifts={summary.gifts} />
        </>
      )}
    </section>
  );
}
