-- Waves of invitations. Later waves are sent as seats open up.
CREATE TABLE waves (
  wave INTEGER PRIMARY KEY CHECK (wave IN (1, 2, 3)),
  respond_by TEXT -- ISO date (YYYY-MM-DD), NULL until the couple sets it
);
INSERT INTO waves (wave) VALUES (1), (2), (3);

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  wave INTEGER NOT NULL REFERENCES waves (wave),
  priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'sent')),
  sent_at TEXT,
  email TEXT,
  note TEXT,
  song_request TEXT,
  responded_at TEXT,
  updated_at TEXT
);
CREATE INDEX invitations_status ON invitations (status);

CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  plus_one_allowed INTEGER NOT NULL DEFAULT 0 CHECK (plus_one_allowed IN (0, 1)),
  plus_one_of TEXT REFERENCES guests (id) ON DELETE CASCADE,
  attending INTEGER CHECK (attending IN (0, 1)), -- NULL = no reply yet
  dietary TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX guests_invitation ON guests (invitation_id);
CREATE UNIQUE INDEX guests_one_plus_one ON guests (plus_one_of) WHERE plus_one_of IS NOT NULL;

CREATE TABLE edit_tokens (
  token_hash TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Append-only audit log of every RSVP submission.
CREATE TABLE rsvp_events (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO settings (key, value) VALUES ('capacity_target', '90'), ('rsvp_open', '1');

CREATE TABLE registry_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  link TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE contributions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES registry_items (id),
  stripe_session_id TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  name TEXT NOT NULL,
  note TEXT,
  email TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
