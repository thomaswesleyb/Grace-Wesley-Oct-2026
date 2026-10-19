import { useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { formatDollars } from "@shared/registry.ts";
import {
  adminSummary,
  type AdminContribution,
  type AdminInvitation,
  type AdminSummary,
} from "@shared/schemas.ts";
import "@client/pages/admin.css";

const answerText = (attending: boolean | null) =>
  attending === null ? "No reply" : attending ? "Yes" : "No";

const csvCell = (value: string | number | null) => {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** One row per guest, including plus-ones, for spreadsheets and caterer counts. */
export function toCsv(invitations: AdminInvitation[]): string {
  const header = [
    "invitation",
    "wave",
    "status",
    "first_name",
    "last_name",
    "plus_one_of",
    "attending",
    "dietary",
    "invite_email",
    "rsvp_email",
    "song_request",
    "note",
    "responded_at",
  ];
  const rows = invitations.flatMap((i) =>
    i.guests.map((g) => {
      const host = g.plusOneOf === null ? null : i.guests.find((h) => h.id === g.plusOneOf);
      return [
        i.label,
        i.wave,
        i.status,
        g.firstName,
        g.lastName,
        host ? `${host.firstName} ${host.lastName}` : null,
        answerText(g.attending),
        g.dietary,
        g.inviteEmail,
        i.email,
        i.songRequest,
        i.note,
        i.respondedAt,
      ];
    }),
  );
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function download(invitations: AdminInvitation[]) {
  const url = URL.createObjectURL(new Blob([toCsv(invitations)], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `rsvps-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CapacityTiles({ capacity }: { capacity: AdminSummary["capacity"] }) {
  const tiles: [string, number, string][] = [
    ["Confirmed", capacity.confirmed, "Guests who said yes"],
    ["Pending", capacity.pending, "Seats held for sent invitations without a reply"],
    ["Open", capacity.open, `Target ${capacity.target} − confirmed − pending`],
    ["Forecast", capacity.forecast, "Expected final count at the current acceptance rate"],
    ["Declined", capacity.declined, "Guests who said no"],
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

function InvitationRow({ invitation }: { invitation: AdminInvitation }) {
  return (
    <tr data-status={invitation.status}>
      <td>{invitation.wave}</td>
      <td>{invitation.label}</td>
      <td>{invitation.status === "sent" ? "Sent" : "Held"}</td>
      <td>
        {invitation.guests.map((g) => (
          <div key={g.id}>
            {g.firstName} {g.lastName}
            {g.plusOneOf !== null && " (guest)"}: {answerText(g.attending)}
            {g.dietary && <span className="admin-muted"> · {g.dietary}</span>}
            {g.inviteEmail && <div className="admin-muted">{g.inviteEmail}</div>}
          </div>
        ))}
      </td>
      <td>{invitation.email ?? ""}</td>
      <td>{invitation.songRequest ?? ""}</td>
      <td>{invitation.note ?? ""}</td>
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

export function Admin() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/admin/summary", adminSummary)
      .then(setSummary)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : "Couldn't load RSVPs."),
      );
  }, []);

  return (
    <section className="page admin">
      <h1>RSVPs</h1>
      {error !== null && <p className="notice error">{error}</p>}
      {summary === null && error === null && <p className="lede">Loading…</p>}
      {summary !== null && (
        <>
          <CapacityTiles capacity={summary.capacity} />
          <div className="actions">
            <button className="button" type="button" onClick={() => download(summary.invitations)}>
              Download CSV
            </button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Wave</th>
                  <th>Invitation</th>
                  <th>Status</th>
                  <th>Guests</th>
                  <th>RSVP email</th>
                  <th>Song</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {summary.invitations.map((invitation) => (
                  <InvitationRow key={invitation.id} invitation={invitation} />
                ))}
              </tbody>
            </table>
          </div>
          <GiftsTable gifts={summary.gifts} />
        </>
      )}
    </section>
  );
}
