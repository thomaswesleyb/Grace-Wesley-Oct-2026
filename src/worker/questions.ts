import { Hono, type Context } from "hono";
import { QA_ENTRIES } from "@content/qa.ts";
import {
  builtEditFields,
  questionFields,
  type QuestionFields,
  type QuestionsResponse,
} from "@shared/schemas.ts";
import { requireAccess } from "@worker/admin.ts";
import {
  deleteBuiltEdit,
  deleteQuestion,
  insertQuestion,
  listBuiltEdits,
  listQuestions,
  updateQuestion,
  upsertBuiltEdit,
} from "@worker/db.ts";
import type { Env } from "@worker/env.ts";

type AppContext = Context<{ Bindings: Env }>;

const listResponse = async (c: AppContext) => {
  const [questions, edits] = await Promise.all([listQuestions(c.env.DB), listBuiltEdits(c.env.DB)]);
  return c.json({ questions, edits } satisfies QuestionsResponse);
};

const BUILT_KEYS = new Set(QA_ENTRIES.map((entry) => entry.key));

async function readFields(c: AppContext): Promise<QuestionFields | null> {
  const parsed = questionFields.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

const INVALID =
  "Pick a topic and fill in both the question (up to 200 characters) and the answer (up to 2,000).";
const MISSING = "That question doesn't exist. It may have been deleted.";
const UNKNOWN_BUILT = "That isn't one of the DETAILS.md questions. Reload the page and try again.";
const UNEDITED = "That question already matches DETAILS.md.";

/** The couple's added questions, for the Q&A page. */
export const questions = new Hono<{ Bindings: Env }>();
questions.get("/", listResponse);

/** Managing added questions at /api/admin/questions, behind Cloudflare Access. */
export const adminQuestions = new Hono<{ Bindings: Env }>();
adminQuestions.use("*", requireAccess);

adminQuestions.get("/", listResponse);

adminQuestions.post("/", async (c) => {
  const fields = await readFields(c);
  if (fields === null) return c.json({ error: INVALID }, 400);
  const question = { ...fields, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await insertQuestion(c.env.DB, question);
  console.log(`Admin added question ${question.id}.`);
  return c.json(question);
});

adminQuestions.patch("/:id", async (c) => {
  const fields = await readFields(c);
  if (fields === null) return c.json({ error: INVALID }, 400);
  if (!(await updateQuestion(c.env.DB, c.req.param("id"), fields))) {
    return c.json({ error: MISSING }, 404);
  }
  return c.json({ ok: true as const });
});

adminQuestions.delete("/:id", async (c) => {
  const id = c.req.param("id");
  if (!(await deleteQuestion(c.env.DB, id))) return c.json({ error: MISSING }, 404);
  console.log(`Admin deleted question ${id}.`);
  return c.json({ ok: true as const });
});

/** Saves the couple's version of a DETAILS.md question, replacing any earlier edit. */
adminQuestions.patch("/built/:key", async (c) => {
  const key = c.req.param("key");
  if (!BUILT_KEYS.has(key)) return c.json({ error: UNKNOWN_BUILT }, 404);
  const parsed = builtEditFields.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: INVALID }, 400);
  await upsertBuiltEdit(c.env.DB, { ...parsed.data, key, updatedAt: new Date().toISOString() });
  console.log(`Admin edited DETAILS.md question ${key}.`);
  return c.json({ ok: true as const });
});

/** Drops the edit so the DETAILS.md version shows again. */
adminQuestions.delete("/built/:key", async (c) => {
  const key = c.req.param("key");
  if (!(await deleteBuiltEdit(c.env.DB, key))) return c.json({ error: UNEDITED }, 404);
  console.log(`Admin reset DETAILS.md question ${key}.`);
  return c.json({ ok: true as const });
});
