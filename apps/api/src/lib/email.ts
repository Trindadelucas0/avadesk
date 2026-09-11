import { Resend } from "resend";
import { query } from "./db.js";
import { env } from "./env.js";
import { projectUpdateEmail } from "./email-templates.js";

export async function sendProjectUpdateEmail(opts: {
  to: string[];
  projectName: string;
  content: string;
  status: string;
}): Promise<void> {
  if (opts.to.length === 0) return;

  const portalUrl = `${env.webOrigin}/client`;
  const { subject, html, text } = projectUpdateEmail({
    projectName: opts.projectName,
    content: opts.content,
    status: opts.status,
    portalUrl,
  });

  if (!env.resendApiKey) {
    console.log("[email:dev] RESEND_API_KEY missing — logging email instead of sending");
    console.log(JSON.stringify({ from: env.emailFrom, to: opts.to, subject, text }));
    return;
  }

  const resend = new Resend(env.resendApiKey);
  const { error } = await resend.emails.send({
    from: env.emailFrom,
    to: opts.to,
    subject,
    text,
    html,
  });

  if (error) {
    console.error("[email] Resend error:", error);
  }
}

export async function enqueueUpdateEmails(opts: {
  emails: string[];
  projectName: string;
  title: string;
  content: string;
  status: string;
  updateId: string;
}): Promise<void> {
  const portalUrl = `${env.webOrigin}/client`;
  const { subject, html, text } = projectUpdateEmail({
    projectName: opts.projectName,
    title: opts.title,
    content: opts.content,
    status: opts.status,
    portalUrl,
  });

  for (const to of opts.emails) {
    await enqueueMail({
      to,
      subject,
      text,
      html,
      relatedUpdateId: opts.updateId,
    });
  }
}

export async function enqueueMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
  relatedUpdateId?: string | null;
  relatedTicketId?: string | null;
}): Promise<void> {
  await query(
    `INSERT INTO email_outbox (to_email, subject, body_text, body_html, related_update_id, related_ticket_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      opts.to,
      opts.subject,
      opts.text,
      opts.html,
      opts.relatedUpdateId ?? null,
      opts.relatedTicketId ?? null,
    ]
  );
}

export async function flushOutbox(limit = 20): Promise<void> {
  const pending = await query<{
    id: string;
    to_email: string;
    subject: string;
    body_text: string;
    body_html: string | null;
  }>(
    `SELECT id, to_email, subject, body_text, body_html
     FROM email_outbox
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  for (const row of pending.rows) {
    try {
      if (!env.resendApiKey) {
        await query(
          `UPDATE email_outbox SET status = 'logged', sent_at = NOW() WHERE id = $1`,
          [row.id]
        );
        console.log("[email:outbox]", { to: row.to_email, subject: row.subject });
        continue;
      }
      const resend = new Resend(env.resendApiKey);
      const { error } = await resend.emails.send({
        from: env.emailFrom,
        to: [row.to_email],
        subject: row.subject,
        text: row.body_text,
        html: row.body_html ?? undefined,
      });
      if (error) {
        await query(
          `UPDATE email_outbox SET status = 'failed', last_error = $2 WHERE id = $1`,
          [row.id, String(error.message ?? error)]
        );
        continue;
      }
      await query(`UPDATE email_outbox SET status = 'sent', sent_at = NOW() WHERE id = $1`, [row.id]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "send_failed";
      await query(`UPDATE email_outbox SET status = 'failed', last_error = $2 WHERE id = $1`, [
        row.id,
        msg,
      ]);
    }
  }
}

/** Test helper: mark pending as failed without rolling back the caller. */
export async function failPendingOutbox(reason = "forced_test_failure"): Promise<void> {
  await query(`UPDATE email_outbox SET status = 'failed', last_error = $1 WHERE status = 'pending'`, [
    reason,
  ]);
}
