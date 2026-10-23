import type { Env } from "@worker/env.ts";

/** Emails the couple through Resend. Failures are logged, never surfaced to the guest. */
export async function sendAlert(env: Env, subject: string, lines: string[]): Promise<void> {
  if (!env.RESEND_API_KEY || !env.ALERT_TO || !env.ALERT_FROM) {
    console.warn(`Alert not sent (RESEND_API_KEY, ALERT_TO or ALERT_FROM unset): ${subject}`);
    return;
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env.ALERT_FROM,
      to: env.ALERT_TO.split(",").map((a) => a.trim()),
      subject,
      text: lines.join("\n"),
    }),
  });
  if (!response.ok) {
    console.error(
      `Resend alert failed (${response.status}): ${await response.text()} — subject: ${subject}`,
    );
  }
}
