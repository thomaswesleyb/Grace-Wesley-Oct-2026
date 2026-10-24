-- Registry items are now added and edited on /admin/registry instead of seeded from a CSV.
--
-- - An item's picture lives in the PHOTOS R2 bucket under `registry/<image_id>`, with a new id
--   each time it's replaced. The old `image` column held a path under public/ from the CSV seed,
--   which the site no longer serves, so pictures start empty.
-- - `price_cents` may be NULL: an open fund (e.g. a honeymoon fund) with no goal, which shows only
--   what's been given so far.
--
-- SQLite can't drop NOT NULL in place, so the table is rebuilt. Gifts in `contributions` keep
-- pointing at the same item ids.
PRAGMA defer_foreign_keys = on;

CREATE TABLE registry_items_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  image_id TEXT,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents > 0),
  link TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

INSERT INTO registry_items_new (id, name, description, image_id, price_cents, link, sort)
SELECT id, name, description, NULL, price_cents, link, sort FROM registry_items;

DROP TABLE registry_items;
ALTER TABLE registry_items_new RENAME TO registry_items;
