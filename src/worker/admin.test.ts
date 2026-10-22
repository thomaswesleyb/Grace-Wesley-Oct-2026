import { env as workerEnv } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { adminSummary } from "@shared/schemas.ts";
import { call, resetDb, rsvpBody } from "@worker/test-helpers.ts";

beforeEach(resetDb);

describe("GET /api/admin/summary", () => {
  it("fails closed when Cloudflare Access isn't configured", async () => {
    const response = await call("/api/admin/summary", {
      env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
    });
    expect(response.status).toBe(503);
  });

  it("requires an Access token when configured", async () => {
    const env = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud" };
    expect((await call("/api/admin/summary", { env })).status).toBe(401);
  });

  it("rejects a forged Access token", async () => {
    const env = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud" };
    const headers = { "cf-access-jwt-assertion": "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0." };
    expect((await call("/api/admin/summary", { env, headers })).status).toBe(401);
  });

  it("ignores the dev bypass for non-local hosts", async () => {
    const response = await call("/api/admin/summary", {
      env: { ADMIN_DEV_BYPASS: "1", ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" },
    });
    expect(response.status).toBe(503);
  });

  it("lists every RSVP with its people and totals", async () => {
    await call("/api/rsvp", {
      body: rsvpBody({
        email: "lee@example.com",
        people: [
          { firstName: "Sam", lastName: "Lee", attending: true, dietary: "vegan" },
          { firstName: "Kim", lastName: "Lee", attending: false },
        ],
      }),
    });
    await call("/api/rsvp", { body: rsvpBody({ email: "doe@example.com" }) });

    const response = await call("/api/admin/summary", {
      origin: "http://localhost:5173",
      env: { ADMIN_DEV_BYPASS: "1" },
    });
    expect(response.status).toBe(200);
    const body = adminSummary.parse(await response.json());
    expect(body.totals).toEqual({ rsvps: 2, attending: 2, declining: 1 });
    expect(body.gifts).toEqual([]);
    const lee = body.rsvps.find((r) => r.email === "lee@example.com");
    expect(lee?.people).toMatchObject([
      { firstName: "Sam", lastName: "Lee", attending: true, dietary: "vegan" },
      { firstName: "Kim", lastName: "Lee", attending: false, dietary: null },
    ]);
  });
});

describe("DELETE /api/admin/rsvps/:id", () => {
  const asAdmin = { origin: "http://localhost:5173", env: { ADMIN_DEV_BYPASS: "1" } };

  async function summary() {
    return adminSummary.parse(await (await call("/api/admin/summary", asAdmin)).json());
  }

  it("deletes one RSVP and everyone on it, leaving the others", async () => {
    await call("/api/rsvp", {
      body: rsvpBody({
        email: "remove@example.com",
        people: [
          { firstName: "Test", lastName: "Guest", attending: true },
          { firstName: "Second", lastName: "Tester", attending: false },
        ],
      }),
    });
    await call("/api/rsvp", { body: rsvpBody({ email: "keep@example.com" }) });
    const target = (await summary()).rsvps.find((r) => r.email === "remove@example.com");

    const response = await call(`/api/admin/rsvps/${target?.id}`, { ...asAdmin, method: "DELETE" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });

    const after = await summary();
    expect(after.rsvps.map((r) => r.email)).toEqual(["keep@example.com"]);
    expect(after.totals).toEqual({ rsvps: 1, attending: 1, declining: 0 });
    const orphans = await workerEnv.DB.prepare(
      "SELECT COUNT(*) AS n FROM rsvp_people WHERE rsvp_id = ?",
    )
      .bind(target?.id)
      .first<{ n: number }>();
    expect(orphans?.n).toBe(0);
  });

  it("returns 404 for an RSVP that doesn't exist", async () => {
    const response = await call("/api/admin/rsvps/nope", { ...asAdmin, method: "DELETE" });
    expect(response.status).toBe(404);
  });

  it("requires a signed-in admin", async () => {
    await call("/api/rsvp", { body: rsvpBody() });
    const [rsvp] = (await summary()).rsvps;
    const env = { ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com", ACCESS_AUD: "aud" };
    const response = await call(`/api/admin/rsvps/${rsvp?.id}`, { env, method: "DELETE" });
    expect(response.status).toBe(401);
    expect((await summary()).rsvps).toHaveLength(1);
  });
});
