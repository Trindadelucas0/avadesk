/** Keep in sync with `apps/web/src/lib/push-open.ts` and `apps/web/public/sw.js`. */

export const PUSH_HREF_MAX = 300;

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
