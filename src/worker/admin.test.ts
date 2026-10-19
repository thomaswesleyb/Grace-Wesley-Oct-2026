import { beforeEach, describe, expect, it } from "vitest";
import { answerAll, call, resetDb, seed } from "@worker/test-helpers.ts";

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

  it("summarizes capacity across sent invitations only", async () => {
    const yes = await seed({
      label: "Yes",
      guests: [{ first: "Will", last: "Come", plusOne: true, email: "will@example.com" }],
    });
    await seed({ label: "Pending", guests: [{ first: "Maybe", last: "Later", plusOne: true }] });
    await seed({ label: "Held", status: "held", guests: [{ first: "Not", last: "Sent" }] });
    await call(`/api/rsvp/${yes.invitationId}`, { body: answerAll(yes.guestIds, true) });

    const response = await call("/api/admin/summary", {
      origin: "http://localhost:5173",
      env: { ADMIN_DEV_BYPASS: "1" },
    });
    expect(response.status).toBe(200);
    const body = await response.json<{
      capacity: Record<string, number>;
      invitations: { label: string; guests: { inviteEmail: string | null }[] }[];
      gifts: unknown[];
    }>();
    expect(body.capacity).toEqual({
      target: 90,
      confirmed: 1,
      declined: 0,
      pending: 2,
      open: 87,
      forecast: 3,
    });
    expect(body.invitations).toHaveLength(3);
    expect(body.gifts).toEqual([]);
    const yesGuests = body.invitations.find((i) => i.label === "Yes")?.guests;
    expect(yesGuests?.[0]?.inviteEmail).toBe("will@example.com");
  });
});
