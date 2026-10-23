import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@client/api.ts";
import { formatDuration } from "@client/labyrinth/leaderboard.ts";
import {
  leaderboardResponse,
  type LeaderboardEntry,
  type LeaderboardResponse,
} from "@shared/schemas.ts";

type Board = { ok: true; board: LeaderboardResponse } | { ok: false; error: string };

/** The leaderboard, null while it first loads; `reload` fetches it again, e.g. after a save. */
export function useLeaderboard() {
  const [board, setBoard] = useState<Board | null>(null);
  const reload = useCallback(() => {
    apiFetch("/api/labyrinth/leaderboard", leaderboardResponse)
      .then((reply) => setBoard({ ok: true, board: reply }))
      .catch((e: unknown) => {
        const error = e instanceof ApiRequestError ? e.message : "Couldn't load the leaderboard.";
        setBoard({ ok: false, error });
      });
  }, []);
  useEffect(reload, [reload]);
  return { board, reload };
}

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <tr className={entry.you ? "you" : undefined}>
      <td>{entry.rank}</td>
      <td>
        {entry.name}
        {entry.you && " (you)"}
      </td>
      <td>{formatDuration(entry.durationMs)}</td>
    </tr>
  );
}

function Table({ board }: { board: LeaderboardResponse }) {
  if (board.entries.length === 0) return <p>No times yet. Be the first!</p>;
  const youBelow = board.you !== null && !board.entries.some((e) => e.you);
  return (
    <table>
      <thead>
        <tr>
          <th scope="col">Rank</th>
          <th scope="col">Guest</th>
          <th scope="col">Best time</th>
        </tr>
      </thead>
      <tbody>
        {board.entries.map((entry, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- rows hold no state, and two guests can share a name and a time
          <Row key={index} entry={entry} />
        ))}
        {youBelow && board.you !== null && <Row key="you" entry={board.you} />}
      </tbody>
    </table>
  );
}

function Contents({ board }: { board: Board }) {
  return board.ok ? <Table board={board.board} /> : <p className="notice error">{board.error}</p>;
}

interface PanelProps {
  board: Board | null;
  /** True once the visitor has won a game on this visit. */
  wonOnce: boolean;
  /** False before the visitor has sent an RSVP from this browser. */
  signedIn: boolean;
}

/**
 * Each guest's best time, in a panel that starts closed. It appears only once the visitor has
 * won on this visit or has a time saved from an earlier one.
 */
export function LeaderboardPanel({ board, wonOnce, signedIn }: PanelProps) {
  const you = board?.ok === true ? board.board.you : null;
  if (board === null || (!wonOnce && you === null)) return null;
  return (
    <details className="panel labyrinth-leaderboard">
      <summary>
        Leaderboard{you !== null && <span className="labyrinth-rank"> · you're #{you.rank}</span>}
      </summary>
      <Contents board={board} />
      {!signedIn && <p className="labyrinth-hint">RSVP to put your time on the board.</p>}
    </details>
  );
}
