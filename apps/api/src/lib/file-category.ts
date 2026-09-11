const SYSTEM_SLUGS = new Set(["contrato_documentacao", "outro"]);
const LEGACY_TO_OUTRO = new Set(["briefing", "design", "entrega"]);
const RESERVED_SLUGS = new Set([
  "contrato_documentacao",
  "outro",
  "contrato",
  "briefing",
  "design",
  "entrega",
  "all",
  "novo",
  "new",
  "__new__",
]);

const CUSTOM_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+){0,7}$/;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export const SYSTEM_FILE_CATEGORY_LABELS: Record<string, string> = {
  contrato_documentacao: "Contrato e Documentação do Sistema",
  outro: "Outros",
};

export function slugifyCategoryLabel(label: string): string {
  const nfkd = label.normalize("NFKD").replace(/\p{M}/gu, "");
  return nfkd
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

export function isValidCustomSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 40) return false;
  if (RESERVED_SLUGS.has(slug)) return false;
  return CUSTOM_SLUG_RE.test(slug);
}

export function normalizeStoredFileCategory(category: unknown): string {
  const raw = typeof category === "string" ? category.trim() : "";
  if (raw === "contrato" || raw === "contrato_documentacao") return "contrato_documentacao";
  if (raw === "outro" || LEGACY_TO_OUTRO.has(raw) || !raw) return "outro";
  if (isValidCustomSlug(raw)) return raw;
  return "outro";
}

export function displayFileCategoryLabel(slug: string, storedLabel: unknown): string {
  if (SYSTEM_SLUGS.has(slug)) return SYSTEM_FILE_CATEGORY_LABELS[slug] ?? slug;
  if (typeof storedLabel === "string" && storedLabel.trim()) {
    return storedLabel.trim().slice(0, 60);
  }
  return slug;
}

export function resolveWriteCategory(input: {
  category?: string | null;
  categoryLabel?: string | null;
}): { ok: true; category: string; categoryLabel: string | null } | { ok: false; message: string } {
  const rawLabel = typeof input.categoryLabel === "string" ? input.categoryLabel.trim() : "";
  if (rawLabel) {
    if (rawLabel.length < 2 || rawLabel.length > 60 || CONTROL_CHARS.test(rawLabel)) {
      return { ok: false, message: "Nome de categoria inválido." };
    }
    const slug = slugifyCategoryLabel(rawLabel);
    if (!isValidCustomSlug(slug)) {
      return { ok: false, message: "Nome de categoria inválido." };
    }
    return { ok: true, category: slug, categoryLabel: rawLabel };
  }

  const rawCat = typeof input.category === "string" ? input.category.trim() : "";
  if (!rawCat) {
    return { ok: true, category: "contrato_documentacao", categoryLabel: null };
  }
  if (rawCat === "contrato" || rawCat === "contrato_documentacao") {
    return { ok: true, category: "contrato_documentacao", categoryLabel: null };
  }
  if (rawCat === "outro") {
    return { ok: true, category: "outro", categoryLabel: null };
  }
  if (isValidCustomSlug(rawCat)) {
    return { ok: true, category: rawCat, categoryLabel: null };
  }
  return { ok: false, message: "Nome de categoria inválido." };
}
