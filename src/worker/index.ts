import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { admin } from "@worker/admin.ts";
import type { Env } from "@worker/env.ts";
import { registry, stripeWebhook } from "@worker/registry.ts";
import { rsvp } from "@worker/rsvp.ts";

const app = new Hono<{ Bindings: Env }>().basePath("/api");

app.use("*", secureHeaders());
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
  c.header("X-Robots-Tag", "noindex, nofollow");
});

app.route("/rsvp", rsvp);
app.route("/admin", admin);
app.route("/registry", registry);
app.route("/stripe", stripeWebhook);

app.notFound((c) => c.json({ error: "Not found." }, 404));
app.onError((error, c) => {
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, error);
  return c.json({ error: "Something went wrong on our end. Please try again." }, 500);
});

export default app satisfies ExportedHandler<Env>;
