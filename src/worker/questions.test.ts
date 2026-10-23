import { beforeEach, describe, expect, it } from "vitest";
import { addedQuestion, questionsResponse } from "@shared/schemas.ts";
import { call, resetDb } from "@worker/test-helpers.ts";

beforeEach(resetDb);

const asAdmin = { origin: "http://localhost:5173", env: { ADMIN_DEV_BYPASS: "1" } };
const noAccess = { env: { ACCESS_TEAM_DOMAIN: "", ACCESS_AUD: "" } };

const pets = { topic: "The day of", question: "Can I bring my dog?", answer: "Sorry, no pets." };

async function add(body: Record<string, unknown> = pets) {
  const response = await call("/api/admin/questions", { ...asAdmin, body });
  expect(response.status).toBe(200);
  return addedQuestion.parse(await response.json());
}

async function publicList() {
  const response = await call("/api/questions");
  expect(response.status).toBe(200);
  return questionsResponse.parse(await response.json()).questions;
}

const path = (id: string) => `/api/admin/questions/${id}`;

describe("admin question routes", () => {
  it("fail closed without Cloudflare Access", async () => {
    expect((await call("/api/admin/questions", noAccess)).status).toBe(503);
    expect((await call("/api/admin/questions", { ...noAccess, body: pets })).status).toBe(503);
    const patched = await call(path("x"), { ...noAccess, method: "PATCH", body: pets });
    expect(patched.status).toBe(503);
    expect((await call(path("x"), { ...noAccess, method: "DELETE" })).status).toBe(503);
    expect(await publicList()).toEqual([]);
  });
});

describe("added questions", () => {
  it("show publicly as soon as they're added, oldest first, trimmed", async () => {
    const first = await add({ ...pets, question: "  Can I bring my dog?  " });
    const second = await add({ topic: "Lodging", question: "Is there camping?", answer: "Yes." });
    expect(await publicList()).toEqual([first, second]);
    expect(first).toMatchObject(pets);
  });

  it("can be edited, including moving to another topic", async () => {
    const { id } = await add();
    const edit = { topic: "Registry & more", question: "Pets?", answer: "Leave them home." };
    const response = await call(path(id), { ...asAdmin, method: "PATCH", body: edit });
    expect(response.status).toBe(200);
    expect(await publicList()).toMatchObject([{ id, ...edit }]);
  });

  it("can be deleted, and a second delete reports it's gone", async () => {
    const { id } = await add();
    expect((await call(path(id), { ...asAdmin, method: "DELETE" })).status).toBe(200);
    expect(await publicList()).toEqual([]);
    expect((await call(path(id), { ...asAdmin, method: "DELETE" })).status).toBe(404);
  });

  it("report a missing question on edit", async () => {
    const response = await call(path("nope"), { ...asAdmin, method: "PATCH", body: pets });
    expect(response.status).toBe(404);
  });

  it.each([
    ["an unknown topic", { ...pets, topic: "Food" }],
    ["a blank question", { ...pets, question: "   " }],
    ["a blank answer", { ...pets, answer: "" }],
    ["a missing answer", { topic: pets.topic, question: pets.question }],
    ["an overlong question", { ...pets, question: "x".repeat(201) }],
    ["an overlong answer", { ...pets, answer: "x".repeat(2001) }],
    ["a body that isn't JSON", "not json"],
  ])("refuse %s", async (_, body) => {
    const response = await call("/api/admin/questions", { ...asAdmin, body });
    expect(response.status).toBe(400);
    const { id } = await add();
    const patched = await call(path(id), { ...asAdmin, method: "PATCH", body });
    expect(patched.status).toBe(400);
    expect(await publicList()).toMatchObject([pets]);
  });
});
