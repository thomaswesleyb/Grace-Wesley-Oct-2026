-- Guests now unlock the RSVP form with a shared code instead of finding their name on a guest
-- list, so invitations, guests and waves go away. The same household may send the form more
-- than once; admin shows every submission.
DROP TABLE rsvp_events;
DROP TABLE edit_tokens;
DROP TABLE guests;
DROP TABLE invitations;
DROP TABLE waves;
DELETE FROM settings WHERE key = 'capacity_target';

CREATE TABLE rsvps (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  song_request TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE rsvp_people (
  id TEXT PRIMARY KEY,
  rsvp_id TEXT NOT NULL REFERENCES rsvps (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  attending INTEGER NOT NULL CHECK (attending IN (0, 1)),
  dietary TEXT,
  sort INTEGER NOT NULL
);
CREATE INDEX rsvp_people_rsvp ON rsvp_people (rsvp_id);
