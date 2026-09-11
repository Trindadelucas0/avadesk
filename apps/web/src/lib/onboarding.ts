const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim().toLowerCase());
}

/** Aceita @handle ou URL do Instagram; devolve `@handle` ou null. */
export function normalizeInstagram(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.split(/[/?#]/)[0] ?? "";
  s = s.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(s)) return null;
  return `@${s}`;
}

/** Vazio é válido. Se preenchido, precisa ser um handle válido. */
export function parseOptionalInstagram(
  raw: string,
  label: string
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: true, value: undefined };
  const value = normalizeInstagram(raw);
  if (!value) {
    return { ok: false, error: `${label} inválido. Use @handle ou deixe em branco.` };
  }
  return { ok: true, value };
}

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
