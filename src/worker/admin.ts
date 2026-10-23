import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AdminSummary } from "@shared/schemas.ts";
import { deleteRsvp, listAdminGuests, listAdminRsvps, listPaidContributions } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";

const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function isLocalhost(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === "localhost" || hostname === "127.0.0.1";
}

/** Requires a valid Cloudflare Access JWT. Fails closed when Access isn't configured. */
export const requireAccess = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  if (c.env.ADMIN_DEV_BYPASS === "1" && isLocalhost(c.req.url)) return next();

  const { ACCESS_TEAM_DOMAIN: team, ACCESS_AUD: aud } = c.env;
  if (!team || !aud) {
    console.error("Admin request refused: ACCESS_TEAM_DOMAIN and ACCESS_AUD must be set.");
    return c.json({ error: "Admin is not configured." }, 503);
  }
  const token = c.req.header("cf-access-jwt-assertion");
  if (!token) return c.json({ error: "Not signed in." }, 401);

  let jwks = jwksByTeam.get(team);
  if (jwks === undefined) {
    jwks = createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`));
    jwksByTeam.set(team, jwks);
  }
  try {
    await jwtVerify(token, jwks, { issuer: `https://${team}`, audience: aud });
  } catch (error) {
    console.warn(`Admin JWT rejected: ${String(error)}`);
    return c.json({ error: "Not signed in." }, 401);
  }
  return next();
});

export const admin = new Hono<{ Bindings: Env }>();
admin.use("*", requireAccess);

admin.get("/summary", async (c) => {
  const [guests, rsvps, gifts] = await Promise.all([
    listAdminGuests(c.env.DB),
    listAdminRsvps(c.env.DB),
    listPaidContributions(c.env.DB),
  ]);
  const current = rsvps.filter((r) => r.replacedAt === null);
  const people = current.flatMap((r) => r.people);
  const attending = people.filter((p) => p.attending).length;
  return c.json({
    totals: {
      places: guests.reduce((sum, g) => sum + g.spots, 0),
      rsvps: current.length,
      attending,
      declining: people.length - attending,
      notAnswered: guests.filter((g) => g.spots > 0 && g.answeredAt === null).length,
    },
    guests,
    rsvps,
    gifts,
  } satisfies AdminSummary);
});

admin.delete("/rsvps/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await deleteRsvp(c.env.DB, id))) {
    return c.json({ error: "That RSVP doesn't exist. It may already be deleted." }, 404);
  }
  console.log(`Admin deleted RSVP ${id}.`);
  return c.json({ ok: true as const });
});
