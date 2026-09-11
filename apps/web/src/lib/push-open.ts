/** Keep in sync with `apps/web/public/sw.js` and `apps/api/src/lib/push-href.ts`. */

export const PUSH_OPEN_MESSAGE = "AVADESK_PUSH_OPEN";
export const FROM_PUSH_PARAM = "fromPush";
export const PUSH_TITLE_PARAM = "pt";
export const PUSH_BODY_PARAM = "pb";
export const PUSH_TITLE_MAX = 200;
export const PUSH_BODY_MAX = 500;
export const PUSH_HREF_MAX = 300;
export const PUSH_PENDING_KEY = "avadesk_push_notice_pending";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parsePushOpenId(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

export type PushOpenPayload = {
  id: string | null;
  title: string;
  body: string;
};

export function isSafePushHref(value: string): boolean {
  const raw = value.trim();
  if (!raw || raw.length > PUSH_HREF_MAX) return false;
  if (!raw.startsWith("/") || raw.startsWith("//")) return false;
  if (raw.includes("\\") || raw.includes("://")) return false;
  if (/[\r\n\t]/.test(raw)) return false;
  return true;
}

export function sanitizePushHref(href: string | null | undefined, fallback = "/"): string {
  const raw = (href ?? "").trim();
  if (isSafePushHref(raw)) return raw;
  if (raw.startsWith("/admin")) return "/admin";
  if (raw.startsWith("/client")) return "/client";
  return fallback;
}

export function appendPushOpenQuery(
  href: string,
  payload: { id?: string | null; title?: string; body?: string }
): string {
  const url = new URL(href, "https://avadesk.invalid");
  const id = payload.id?.trim() ?? "";
  if (id) url.searchParams.set(FROM_PUSH_PARAM, id.slice(0, 36));
  const title = (payload.title ?? "").slice(0, PUSH_TITLE_MAX);
  const body = (payload.body ?? "").slice(0, PUSH_BODY_MAX);
  if (title) url.searchParams.set(PUSH_TITLE_PARAM, title);
  if (body) url.searchParams.set(PUSH_BODY_PARAM, body);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function parsePushOpenSearch(searchParams: URLSearchParams): PushOpenPayload | null {
  const rawId = searchParams.get(FROM_PUSH_PARAM);
  const title = (searchParams.get(PUSH_TITLE_PARAM) ?? "").slice(0, PUSH_TITLE_MAX);
  const body = (searchParams.get(PUSH_BODY_PARAM) ?? "").slice(0, PUSH_BODY_MAX);
  if (!rawId && !title && !body) return null;
  return {
    id: parsePushOpenId(rawId),
    title: title || "Avadesk",
    body: body || "Nova atualização",
  };
}

export function stripPushOpenParams(searchParams: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(searchParams.toString());
  next.delete(FROM_PUSH_PARAM);
  next.delete(PUSH_TITLE_PARAM);
  next.delete(PUSH_BODY_PARAM);
  return next;
}

export function readPushNoticePending(): PushOpenPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PUSH_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PushOpenPayload>;
    const title = typeof parsed.title === "string" ? parsed.title.slice(0, PUSH_TITLE_MAX) : "";
    const body = typeof parsed.body === "string" ? parsed.body.slice(0, PUSH_BODY_MAX) : "";
    const id = typeof parsed.id === "string" ? parsePushOpenId(parsed.id) : null;
    if (!id && !title && !body) return null;
    return { id, title: title || "Avadesk", body: body || "Nova atualização" };
  } catch {
    return null;
  }
}

export function writePushNoticePending(payload: PushOpenPayload): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PUSH_PENDING_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function clearPushNoticePending(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PUSH_PENDING_KEY);
  } catch {
    /* private mode */
  }
}
