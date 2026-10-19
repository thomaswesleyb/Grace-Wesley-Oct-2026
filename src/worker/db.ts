import type {
  AdminContribution,
  AdminInvitation,
  InvitationView,
  RegistryItem,
} from "@shared/schemas.ts";

interface InvitationRow {
  id: string;
  label: string;
  wave: number;
  priority: number;
  status: "held" | "sent";
  sent_at: string | null;
  email: string | null;
  note: string | null;
  song_request: string | null;
  responded_at: string | null;
  respond_by: string | null;
}

export interface GuestRow {
  id: string;
  invitation_id: string;
  first_name: string;
  last_name: string;
  name_key: string;
  plus_one_allowed: 0 | 1;
  plus_one_of: string | null;
  attending: 0 | 1 | null;
  dietary: string | null;
  /** Invitation address from the guest list. Admin only; never returned to the RSVP page. */
  email: string | null;
}

const INVITATION_COLUMNS = `i.id, i.label, i.wave, i.priority, i.status, i.sent_at, i.email, i.note,
  i.song_request, i.responded_at, w.respond_by`;

const toBool = (v: 0 | 1 | null): boolean | null => (v === null ? null : v === 1);

/** A wave's deadline is the end of `respond_by` anywhere on Earth (UTC−12). */
export function isClosed(respondBy: string | null, now: Date): boolean {
  if (respondBy === null) return false;
  return now.getTime() > Date.parse(`${respondBy}T23:59:59-12:00`);
}

export async function sentNameCandidates(db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT g.id AS guestId, g.invitation_id AS invitationId, g.name_key AS nameKey
       FROM guests g JOIN invitations i ON i.id = g.invitation_id
       WHERE i.status = 'sent' AND g.plus_one_of IS NULL`,
    )
    .all<{ guestId: string; invitationId: string; nameKey: string }>();
  return results;
}

export async function getSentInvitation(db: D1Database, id: string) {
  return db
    .prepare(
      `SELECT ${INVITATION_COLUMNS} FROM invitations i JOIN waves w ON w.wave = i.wave
       WHERE i.id = ? AND i.status = 'sent'`,
    )
    .bind(id)
    .first<InvitationRow>();
}

export async function getGuests(db: D1Database, invitationId: string) {
  const { results } = await db
    .prepare("SELECT * FROM guests WHERE invitation_id = ? ORDER BY sort, rowid")
    .bind(invitationId)
    .all<GuestRow>();
  return results;
}

export async function getInvitationView(
  db: D1Database,
  id: string,
  now: Date,
): Promise<InvitationView | null> {
  const invitation = await getSentInvitation(db, id);
  if (invitation === null) return null;
  const guests = await getGuests(db, id);
  return {
    id: invitation.id,
    label: invitation.label,
    respondBy: invitation.respond_by,
    closed: isClosed(invitation.respond_by, now),
    responded: invitation.responded_at !== null,
    guests: guests.map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      plusOneAllowed: g.plus_one_allowed === 1,
      isPlusOne: g.plus_one_of !== null,
      attending: toBool(g.attending),
    })),
  };
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function listAdminInvitations(db: D1Database): Promise<AdminInvitation[]> {
  const [invitations, guests] = await Promise.all([
    db
      .prepare(
        `SELECT ${INVITATION_COLUMNS} FROM invitations i JOIN waves w ON w.wave = i.wave
         ORDER BY i.wave, i.priority`,
      )
      .all<InvitationRow>(),
    db.prepare("SELECT * FROM guests ORDER BY sort, rowid").all<GuestRow>(),
  ]);
  const byInvitation = Map.groupBy(guests.results, (g) => g.invitation_id);
  return invitations.results.map((i) => ({
    id: i.id,
    label: i.label,
    wave: i.wave,
    priority: i.priority,
    status: i.status,
    sentAt: i.sent_at,
    respondedAt: i.responded_at,
    email: i.email,
    note: i.note,
    songRequest: i.song_request,
    guests: (byInvitation.get(i.id) ?? []).map((g) => ({
      id: g.id,
      firstName: g.first_name,
      lastName: g.last_name,
      plusOneAllowed: g.plus_one_allowed === 1,
      plusOneOf: g.plus_one_of,
      attending: toBool(g.attending),
      dietary: g.dietary,
      inviteEmail: g.email,
    })),
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
