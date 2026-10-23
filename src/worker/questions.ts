import { Hono, type Context } from "hono";
import { questionFields, type QuestionFields, type QuestionsResponse } from "@shared/schemas.ts";
import { requireAccess } from "@worker/admin.ts";
import { deleteQuestion, insertQuestion, listQuestions, updateQuestion } from "@worker/db.ts";
import type { Env } from "@worker/env.ts";

type AppContext = Context<{ Bindings: Env }>;

const listResponse = async (c: AppContext) =>
  c.json({ questions: await listQuestions(c.env.DB) } satisfies QuestionsResponse);

async function readFields(c: AppContext): Promise<QuestionFields | null> {
  const parsed = questionFields.safeParse(await c.req.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

const INVALID =
  "Pick a topic and fill in both the question (up to 200 characters) and the answer (up to 2,000).";
const MISSING = "That question doesn't exist. It may have been deleted.";

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
