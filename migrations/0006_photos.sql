-- The Photos page now reads its photos from here instead of a list built into the site. Each
-- photo's two WebP or JPEG copies live in the PHOTOS R2 bucket under `<id>/large` and
-- `<id>/small`. The couple's uploads are approved at once; guests' uploads wait as 'pending'
-- until the couple approves them, and aren't served to anyone else until then.
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('couple', 'guest')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  guest_id TEXT REFERENCES guests (id) ON DELETE SET NULL,
  credit TEXT, -- the uploading guest's name as written on the guest list
  alt TEXT NOT NULL DEFAULT '', -- empty = described as "Photo N of M"
  caption TEXT,
  width INTEGER NOT NULL CHECK (width > 0),
  height INTEGER NOT NULL CHECK (height > 0),
  has_small INTEGER NOT NULL CHECK (has_small IN (0, 1)), -- 1 when width > 800 (SMALL_WIDTH)
  bytes INTEGER NOT NULL CHECK (bytes > 0), -- both copies; counts toward the storage limits
  sort INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX photos_status ON photos (status, source, sort);
CREATE INDEX photos_guest ON photos (guest_id);

-- Guests can upload only while this is '1'; the couple opens it from /admin/photos.
INSERT INTO settings (key, value) VALUES ('photo_uploads_open', '0');
