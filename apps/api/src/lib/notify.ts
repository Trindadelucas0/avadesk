import { query } from "./db.js";
import { enqueueMail, flushOutbox } from "./email.js";
import { sanitizePushHref } from "./push-href.js";
import { sendWebPush } from "./push.js";

export async function notifyUsers(opts: {
  userIds: string[];
  clientId: string | null;
  title: string;
  body: string;
  href: string;
  excludeUserId?: string | null;
  email?: { subject: string; html: string; text: string } | null;
  relatedTicketId?: string | null;
}): Promise<void> {
  const ids = [...new Set(opts.userIds.filter((id) => id && id !== opts.excludeUserId))];
  if (ids.length === 0) return;

  const users = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE id = ANY($1::uuid[]) AND active = TRUE`,
    [ids]
  );

  const href = sanitizePushHref(opts.href, "/");

  for (const user of users.rows) {
    const inserted = await query<{ id: string }>(
      `INSERT INTO notifications (user_id, client_id, title, body, href)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [user.id, opts.clientId, opts.title, opts.body, href]
    );
    if (opts.email) {
      await enqueueMail({
        to: user.email,
        subject: opts.email.subject,
        text: opts.email.text,
        html: opts.email.html,
        relatedTicketId: opts.relatedTicketId ?? null,
      });
    }
    await sendWebPush(user.id, {
      title: opts.title,
      body: opts.body,
      href,
      id: inserted.rows[0]?.id,
    });
  }

  if (opts.email) {
    void flushOutbox().catch((e) => console.error("[outbox]", e instanceof Error ? e.message : e));
  }
}

export async function staffUserIds(excludeUserId?: string | null): Promise<string[]> {
  const staff = await query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('admin', 'manager') AND active = TRUE`
  );
  return staff.rows.map((r) => r.id).filter((id) => id !== excludeUserId);
}

export async function projectClientUserIds(
  projectId: string,
  clientId: string,
  excludeUserId?: string | null
): Promise<string[]> {
  const recipients = await query<{ id: string; access_all_projects: boolean }>(
    `SELECT id, COALESCE(access_all_projects, TRUE) AS access_all_projects
     FROM users WHERE role = 'client' AND active = TRUE AND client_id = $1`,
    [clientId]
  );
  const ids: string[] = [];
  for (const u of recipients.rows) {
    if (u.id === excludeUserId) continue;
    if (!u.access_all_projects) {
      const ok = await query(
        `SELECT 1 FROM user_project_access WHERE user_id = $1 AND project_id = $2`,
        [u.id, projectId]
      );
      if (!ok.rows[0]) continue;
    }
    ids.push(u.id);
  }
  return ids;
}
