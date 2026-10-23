import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { admin } from "@worker/admin.ts";
import type { Env } from "@worker/env.ts";
import { adminPhotos, media, photos } from "@worker/photos.ts";
import { adminQuestions, questions } from "@worker/questions.ts";
import { registry, stripeWebhook } from "@worker/registry.ts";
import { rsvp } from "@worker/rsvp.ts";

const api = new Hono<{ Bindings: Env }>();

api.use("*", secureHeaders());
api.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
});

api.route("/rsvp", rsvp);
api.route("/admin/photos", adminPhotos);
api.route("/admin/questions", adminQuestions);
api.route("/admin", admin);
api.route("/photos", photos);
api.route("/questions", questions);
api.route("/registry", registry);
api.route("/stripe", stripeWebhook);

const app = new Hono<{ Bindings: Env }>();
app.route("/api", api);
app.route("/media", media);

app.notFound((c) => c.json({ error: "Not found." }, 404));
app.onError((error, c) => {
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, error);
  return c.json({ error: "Something went wrong on our end. Please try again." }, 500);
});

export default app satisfies ExportedHandler<Env>;
