-- A guest who sends an RSVP gets a session cookie, so the rest of the site knows who they are.
-- Only a SHA-256 hash of each cookie's token is stored.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX sessions_guest ON sessions (guest_id);

-- Each finished walk through the labyrinth by a guest with a session, for a later leaderboard.
-- The time is measured in the guest's browser, from choosing an animal to reaching the center.
CREATE TABLE labyrinth_runs (
  id TEXT PRIMARY KEY,
  guest_id TEXT NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  animal TEXT NOT NULL CHECK (animal IN ('fox', 'deer')),
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  finished_at TEXT NOT NULL
);
CREATE INDEX labyrinth_runs_duration ON labyrinth_runs (duration_ms);
CREATE INDEX labyrinth_runs_guest ON labyrinth_runs (guest_id);
