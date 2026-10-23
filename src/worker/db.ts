import type { NameCandidate } from "@shared/names.ts";
import type {
  AddedQuestion,
  AdminContribution,
  AdminGuest,
  AdminRsvp,
  ParsedRsvpSubmission,
  QuestionFields,
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

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = ?",
    )
    .bind(key, value, value)
    .run();
}

export interface PhotoRow {
  id: string;
  source: "couple" | "guest";
  status: "pending" | "approved";
  guest_id: string | null;
  credit: string | null;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  has_small: 0 | 1;
  /** Both copies together. */
  bytes: number;
  created_at: string;
}

/** The couple's photos in their order, then guests' photos oldest first. */
export async function listPhotos(db: D1Database, only?: PhotoRow["status"]): Promise<PhotoRow[]> {
  const where = only === undefined ? "" : "WHERE status = ?";
  const statement = db.prepare(
    `SELECT * FROM photos ${where} ORDER BY source = 'guest', sort, created_at, rowid`,
  );
  const { results } = await (only === undefined ? statement : statement.bind(only)).all<PhotoRow>();
  return results;
}

export async function getPhoto(db: D1Database, id: string): Promise<PhotoRow | null> {
  return db.prepare("SELECT * FROM photos WHERE id = ?").bind(id).first<PhotoRow>();
}

export interface PhotoLimits {
  totalBytes: number;
  guestBytes: number;
  guestPhotos: number;
}

/**
 * Adds a photo, unless it would break `limits`; returns false then. The check and the insert
 * are one statement, so two uploads at once can't both squeeze past a limit. The couple's
 * photos go after their others; guests' sort by upload time.
 */
export async function insertPhoto(
  db: D1Database,
  photo: PhotoRow,
  limits: PhotoLimits,
): Promise<boolean> {
  const result = await db
    .prepare(
      `INSERT INTO photos
         (id, source, status, guest_id, credit, alt, caption, width, height, has_small, bytes,
          sort, created_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
         (SELECT COALESCE(MAX(sort), -1) + 1 FROM photos WHERE source = ?2), ?12
       WHERE (SELECT COALESCE(SUM(bytes), 0) FROM photos) + ?11 <= ?13
         AND (?4 IS NULL OR (
           (SELECT COALESCE(SUM(bytes), 0) FROM photos WHERE guest_id = ?4) + ?11 <= ?14
           AND (SELECT COUNT(*) FROM photos WHERE guest_id = ?4) < ?15))`,
    )
    .bind(
      photo.id,
      photo.source,
      photo.status,
      photo.guest_id,
      photo.credit,
      photo.alt,
      photo.caption,
      photo.width,
      photo.height,
      photo.has_small,
      photo.bytes,
      photo.created_at,
      limits.totalBytes,
      limits.guestBytes,
      limits.guestPhotos,
    )
    .run();
  return result.meta.changes === 1;
}

/** Bytes stored for all photos, and one guest's bytes and photo count (0 for no guest). */
export async function photoUsage(db: D1Database, guestId: string | null) {
  const row = await db
    .prepare(
      `SELECT COALESCE(SUM(bytes), 0) AS total_bytes,
         COALESCE(SUM(CASE WHEN guest_id = ?1 THEN bytes END), 0) AS guest_bytes,
         COUNT(CASE WHEN guest_id = ?1 THEN 1 END) AS guest_photos
       FROM photos`,
    )
    .bind(guestId)
    .first<{ total_bytes: number; guest_bytes: number; guest_photos: number }>();
  return {
    totalBytes: row?.total_bytes ?? 0,
    guestBytes: row?.guest_bytes ?? 0,
    guestPhotos: row?.guest_photos ?? 0,
  };
}

/** Changes only the fields given. Returns false when there's no photo with that id. */
export async function updatePhoto(
  db: D1Database,
  id: string,
  edit: { [K in "alt" | "caption" | "status"]?: PhotoRow[K] | undefined },
): Promise<boolean> {
  const fields = Object.entries(edit).filter(([, value]) => value !== undefined);
  if (fields.length === 0) return (await getPhoto(db, id)) !== null;
  const sets = fields.map(([column]) => `${column} = ?`).join(", ");
  const result = await db
    .prepare(`UPDATE photos SET ${sets} WHERE id = ?`)
    .bind(...fields.map(([, value]) => value), id)
    .run();
  return result.meta.changes === 1;
}

export async function deletePhoto(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM photos WHERE id = ?").bind(id).run();
  return result.meta.changes === 1;
}

/** Puts the couple's photos in the order of `ids`. Ids of guests' photos are ignored. */
export async function reorderPhotos(db: D1Database, ids: string[]): Promise<void> {
  await db.batch(
    ids.map((id, sort) =>
      db.prepare("UPDATE photos SET sort = ? WHERE id = ? AND source = 'couple'").bind(sort, id),
    ),
  );
}

export async function listQuestions(db: D1Database): Promise<AddedQuestion[]> {
  const { results } = await db
    .prepare(
      `SELECT id, topic, question, answer, created_at AS createdAt FROM questions
       ORDER BY created_at, rowid`,
    )
    .all<AddedQuestion>();
  return results;
}

export async function insertQuestion(db: D1Database, question: AddedQuestion): Promise<void> {
  await db
    .prepare(
      "INSERT INTO questions (id, topic, question, answer, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(question.id, question.topic, question.question, question.answer, question.createdAt)
    .run();
}

/** Returns false when there's no question with that id. */
export async function updateQuestion(
  db: D1Database,
  id: string,
  fields: QuestionFields,
): Promise<boolean> {
  const result = await db
    .prepare("UPDATE questions SET topic = ?, question = ?, answer = ? WHERE id = ?")
    .bind(fields.topic, fields.question, fields.answer, id)
    .run();
  return result.meta.changes === 1;
}

export async function deleteQuestion(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM questions WHERE id = ?").bind(id).run();
  return result.meta.changes === 1;
}
