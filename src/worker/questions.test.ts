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

async function publicResponse() {
  const response = await call("/api/questions");
  expect(response.status).toBe(200);
  return questionsResponse.parse(await response.json());
}

const publicList = async () => (await publicResponse()).questions;
const publicEdits = async () => (await publicResponse()).edits;

const path = (id: string) => `/api/admin/questions/${id}`;
const builtPath = (key: string) => `/api/admin/questions/built/${key}`;

describe("admin question routes", () => {
  it("fail closed without Cloudflare Access", async () => {
    expect((await call("/api/admin/questions", noAccess)).status).toBe(503);
    expect((await call("/api/admin/questions", { ...noAccess, body: pets })).status).toBe(503);
    const patched = await call(path("x"), { ...noAccess, method: "PATCH", body: pets });
    expect(patched.status).toBe(503);
    expect((await call(path("x"), { ...noAccess, method: "DELETE" })).status).toBe(503);
    const built = { ...noAccess, method: "PATCH", body: { ...pets, hidden: false } };
    expect((await call(builtPath("parking"), built)).status).toBe(503);
    expect((await call(builtPath("parking"), { ...noAccess, method: "DELETE" })).status).toBe(503);
    expect(await publicResponse()).toEqual({ questions: [], edits: [] });
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

const editBuilt = (key: string, body: unknown) =>
  call(builtPath(key), { ...asAdmin, method: "PATCH", body });

describe("edits to DETAILS.md questions", () => {
  const parking = { topic: "Lodging", question: "Parking?", answer: "On the lawn.", hidden: false };

  it("show publicly once saved, and a second save replaces the first", async () => {
    expect((await editBuilt("parking", parking)).status).toBe(200);
    expect((await editBuilt("parking", { ...parking, hidden: true })).status).toBe(200);
    expect(await publicEdits()).toMatchObject([{ key: "parking", ...parking, hidden: true }]);
  });

  it("can be reset, and a second reset reports there's nothing to reset", async () => {
    await editBuilt("parking", parking);
    expect((await call(builtPath("parking"), { ...asAdmin, method: "DELETE" })).status).toBe(200);
    expect(await publicEdits()).toEqual([]);
    expect((await call(builtPath("parking"), { ...asAdmin, method: "DELETE" })).status).toBe(404);
  });

  it("refuse a key that isn't in content/qa.ts", async () => {
    expect((await editBuilt("not-a-question", parking)).status).toBe(404);
    expect(await publicEdits()).toEqual([]);
  });

  it.each([
    ["a missing hidden flag", { topic: "Lodging", question: "Parking?", answer: "Lawn." }],
    ["a blank answer", { ...parking, answer: "  " }],
    ["an unknown topic", { ...parking, topic: "Food" }],
    ["a body that isn't JSON", "not json"],
  ])("refuse %s", async (_, body) => {
    expect((await editBuilt("parking", body)).status).toBe(400);
    expect(await publicEdits()).toEqual([]);
  });

  it("don't touch the added questions", async () => {
    const added = await add();
    await editBuilt("parking", parking);
    expect(await publicList()).toEqual([added]);
  });
});
