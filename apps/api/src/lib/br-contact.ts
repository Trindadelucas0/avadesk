export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizeCnpj(value: string): string {
  return onlyDigits(value);
}

export function cnpjOrNull(value: string | undefined): string | null {
  const digits = onlyDigits(value ?? "");
  if (!digits) return null;
  return digits;
}

export function isPgUniqueViolation(err: unknown, constraint?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; constraint?: string };
  if (e.code !== "23505") return false;
  if (constraint && e.constraint && e.constraint !== constraint) return false;
  return true;
}
