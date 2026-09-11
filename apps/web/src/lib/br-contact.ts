export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCnpj(value: string): string {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatBrPhone(value: string): string {
  const raw = onlyDigits(value).slice(0, 13);
  const n = raw.length > 11 && raw.startsWith("55") ? raw.slice(2) : raw;
  const d = n.slice(0, 11);
  if (!d) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidBrPhone(value: string): boolean {
  const d = onlyDigits(value);
  return d.length >= 10 && d.length <= 13;
}

export function isValidCnpjInput(value: string): boolean {
  const d = onlyDigits(value);
  return d.length === 0 || d.length === 14;
}
