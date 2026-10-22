import type { NameCandidate } from "@shared/names.ts";
import type {
  AdminContribution,
  AdminGuest,
  AdminRsvp,
  ParsedRsvpSubmission,
  RegistryItem,
} from "@shared/schemas.ts";

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export interface GuestRow {
  id: string;
  first_name: string;
  last_name: string;
  spots: number;
}

/** Every name a guest can be found by: their listed name and each alias. */
export async function nameCandidates(db: D1Database): Promise<NameCandidate[]> {
  const { results } = await db
    .prepare(
      `SELECT id AS guestId, name_key AS nameKey FROM guests
       UNION ALL SELECT guest_id, name_key FROM guest_aliases`,
    )
    .all<NameCandidate>();
  return results;
}

export async function getGuest(db: D1Database, id: string): Promise<GuestRow | null> {
  return db
    .prepare("SELECT id, first_name, last_name, spots FROM guests WHERE id = ?")
    .bind(id)
    .first<GuestRow>();
}

export async function hasCurrentRsvp(db: D1Database, guestId: string): Promise<boolean> {
  const row = await db
    .prepare("SELECT 1 FROM rsvps WHERE guest_id = ? AND replaced_at IS NULL")
    .bind(guestId)
    .first();
  return row !== null;
}

/**
 * Saves one guest's RSVP and everyone on it in a single batch, marking their earlier RSVP as
 * replaced. Returns true when there was an earlier RSVP.
 */
export async function insertRsvp(
  db: D1Database,
  guestId: string,
  body: ParsedRsvpSubmission,
  now: string,
): Promise<{ replaced: boolean }> {
  const rsvpId = crypto.randomUUID();
  const [replaced] = await db.batch([
    db
      .prepare("UPDATE rsvps SET replaced_at = ? WHERE guest_id = ? AND replaced_at IS NULL")
      .bind(now, guestId),
    db
      .prepare(
        `INSERT INTO rsvps (id, guest_id, email, song_request, note, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(rsvpId, guestId, body.email, body.songRequest, body.note, now),
    ...body.people.map((p, sort) =>
      db
        .prepare(
          `INSERT INTO rsvp_people (id, rsvp_id, first_name, last_name, attending, dietary, sort)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          rsvpId,
          p.firstName,
          p.lastName,
          p.attending ? 1 : 0,
          p.attending ? p.dietary : null,
          sort,
        ),
    ),
  ]);
  return { replaced: (replaced?.meta.changes ?? 0) > 0 };
}

/**
 * Deletes one RSVP and everyone on it. When it was a guest's current RSVP, their most recent
 * earlier one becomes current again. Returns false when there's no RSVP with that id.
 */
export async function deleteRsvp(db: D1Database, id: string): Promise<boolean> {
  const target = await db
    .prepare("SELECT guest_id, replaced_at FROM rsvps WHERE id = ?")
    .bind(id)
    .first<{ guest_id: string | null; replaced_at: string | null }>();
  if (target === null) return false;
  const statements = [
    db.prepare("DELETE FROM rsvp_people WHERE rsvp_id = ?").bind(id),
    db.prepare("DELETE FROM rsvps WHERE id = ?").bind(id),
  ];
  if (target.guest_id !== null && target.replaced_at === null) {
    statements.push(
      db
        .prepare(
          `UPDATE rsvps SET replaced_at = NULL WHERE id = (
             SELECT id FROM rsvps WHERE guest_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1)`,
        )
        .bind(target.guest_id),
    );
  }
  const results = await db.batch(statements);
  return results[1]?.meta.changes === 1;
}

interface RsvpRow {
  id: string;
  guest_id: string | null;
  replaced_at: string | null;
  email: string;
  song_request: string | null;
  note: string | null;
  created_at: string;
}

interface PersonRow {
  id: string;
  rsvp_id: string;
  first_name: string;
  last_name: string;
  attending: 0 | 1;
  dietary: string | null;
}

/** Every RSVP, newest first, with the people on it in the order they were entered. */
export async function listAdminRsvps(db: D1Database): Promise<AdminRsvp[]> {
  const [rsvps, people] = await Promise.all([
    db.prepare("SELECT * FROM rsvps ORDER BY created_at DESC, rowid DESC").all<RsvpRow>(),
    db.prepare("SELECT * FROM rsvp_people ORDER BY sort").all<PersonRow>(),
  ]);
  const byRsvp = Map.groupBy(people.results, (p) => p.rsvp_id);
  return rsvps.results.map((r) => ({
    id: r.id,
    guestId: r.guest_id,
    createdAt: r.created_at,
    replacedAt: r.replaced_at,
    email: r.email,
    songRequest: r.song_request,
    note: r.note,
    people: (byRsvp.get(r.id) ?? []).map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      attending: p.attending === 1,
      dietary: p.dietary,
    })),
  }));
}

/** Every guest in guest-list order, with their current RSVP's date and attending count. */
export async function listAdminGuests(db: D1Database): Promise<AdminGuest[]> {
  const { results } = await db
    .prepare(
      `SELECT g.id, g.first_name, g.last_name, g.spots, r.created_at AS answered_at,
         (SELECT SUM(p.attending) FROM rsvp_people p WHERE p.rsvp_id = r.id) AS attending
       FROM guests g
       LEFT JOIN rsvps r ON r.guest_id = g.id AND r.replaced_at IS NULL
       ORDER BY g.sort`,
    )
    .all<GuestRow & { answered_at: string | null; attending: number | null }>();
  return results.map((g) => ({
    id: g.id,
    firstName: g.first_name,
    lastName: g.last_name,
    spots: g.spots,
    answeredAt: g.answered_at,
    attending: g.answered_at === null ? null : (g.attending ?? 0),
  }));
}

interface RegistryRow {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  link: string | null;
  price_cents: number;
  raised_cents: number;
}

const REGISTRY_SELECT = `SELECT r.id, r.name, r.description, r.image, r.link, r.price_cents,
    COALESCE((SELECT SUM(c.amount_cents) FROM contributions c
              WHERE c.item_id = r.id AND c.status = 'paid'), 0) AS raised_cents
  FROM registry_items r`;

const toRegistryItem = (r: RegistryRow): RegistryItem => ({
  id: r.id,
  name: r.name,
  description: r.description,
  image: r.image,
  link: r.link,
  priceCents: r.price_cents,
  raisedCents: r.raised_cents,
});

/** Registry items with the total of paid gifts toward each. */
export async function listRegistryItems(db: D1Database): Promise<RegistryItem[]> {
  const { results } = await db
    .prepare(`${REGISTRY_SELECT} ORDER BY r.sort, r.name`)
    .all<RegistryRow>();
  return results.map(toRegistryItem);
}

export async function getRegistryItem(db: D1Database, id: string): Promise<RegistryItem | null> {
  const row = await db.prepare(`${REGISTRY_SELECT} WHERE r.id = ?`).bind(id).first<RegistryRow>();
  return row === null ? null : toRegistryItem(row);
}

export async function listPaidContributions(db: D1Database): Promise<AdminContribution[]> {
  const { results } = await db
    .prepare(
      `SELECT c.id, r.name AS item_name, c.amount_cents, c.name, c.note, c.email, c.created_at
       FROM contributions c JOIN registry_items r ON r.id = c.item_id
       WHERE c.status = 'paid' ORDER BY c.created_at DESC`,
    )
    .all<{
      id: string;
      item_name: string;
      amount_cents: number;
      name: string;
      note: string | null;
      email: string | null;
      created_at: string;
    }>();
  return results.map((c) => ({
    id: c.id,
    itemName: c.item_name,
    amountCents: c.amount_cents,
    name: c.name,
    note: c.note,
    email: c.email,
    createdAt: c.created_at,
  }));
}
