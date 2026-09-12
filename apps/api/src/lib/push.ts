import webpush from "web-push";
import { query } from "./db.js";
import { env } from "./env.js";

let configured = false;

function ensureVapid(): boolean {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
    configured = true;
  }
  return true;
}

/** High urgency wakes Android/iOS instead of waiting for Doze / idle. */
export const WEB_PUSH_SEND_OPTIONS = {
  TTL: 24 * 60 * 60,
  urgency: "high" as const,
};

export function isAllowedPushEndpoint(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") return true;
    return (
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export async function sendWebPush(
  userId: string,
  payload: { title: string; body: string; href: string; id?: string }
): Promise<void> {
  if (!ensureVapid()) return;
  const rows = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
    `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  const json = JSON.stringify({
    title: payload.title,
    body: payload.body,
    href: payload.href,
    id: payload.id ?? "",
  });
  for (const row of rows.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.p256dh, auth: row.auth },
        },
        json,
        WEB_PUSH_SEND_OPTIONS
      );
    } catch (err) {
      const status =
        typeof err === "object" && err && "statusCode" in err
          ? Number((err as { statusCode?: number }).statusCode)
          : 0;
      if (status === 404 || status === 410) {
        await query(`DELETE FROM push_subscriptions WHERE id = $1`, [row.id]);
      } else {
        console.error("[push]", err instanceof Error ? err.message : err);
      }
    }
  }
}
