-- Guests now find their own name on the guest list instead of entering a shared code. Each
-- guest's RSVP covers at most `spots` people, themselves included. Answering again replaces
-- the earlier answer, which is kept with `replaced_at` set.
CREATE TABLE guests (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  spots INTEGER NOT NULL CHECK (spots BETWEEN 0 AND 6), -- 0 = invited, can't attend
  sort INTEGER NOT NULL
);

CREATE TABLE guest_aliases (
  guest_id TEXT NOT NULL REFERENCES guests (id) ON DELETE CASCADE,
  name_key TEXT NOT NULL,
  PRIMARY KEY (guest_id, name_key)
);

-- RSVPs sent with the shared code keep guest_id NULL.
ALTER TABLE rsvps ADD COLUMN guest_id TEXT REFERENCES guests (id);
ALTER TABLE rsvps ADD COLUMN replaced_at TEXT;
CREATE UNIQUE INDEX rsvps_current ON rsvps (guest_id)
  WHERE guest_id IS NOT NULL AND replaced_at IS NULL;
