import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FileCategory, ProjectStatus, UpdateType } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelative(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "sem atualização";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

export function formatDate(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateNumeric(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateInput: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatGreetingDate(date = new Date()): string {
  return date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "short",
  });
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    planning: "Planejamento",
    development: "Em desenvolvimento",
    testing: "Testes",
    homologation: "Homologação",
    published: "Publicado",
    maintenance: "Manutenção",
    paused: "Pausado",
    planejado: "Planejado",
    em_andamento: "Em andamento",
    concluido: "Concluído",
    backlog: "Backlog",
    todo: "A fazer",
    doing: "Em progresso",
    review: "Revisão",
  };
  return map[status] ?? status;
}

export function projectStatusTone(status: ProjectStatus): "neutral" | "accent" | "success" | "warn" {
  switch (status) {
    case "development":
    case "testing":
      return "accent";
    case "homologation":
    case "published":
      return "success";
    case "paused":
    case "maintenance":
      return "warn";
    default:
      return "neutral";
  }
}

const LEGACY_TO_OUTRO = new Set(["briefing", "design", "entrega"]);
const CUSTOM_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+){0,7}$/;
const RESERVED_FILE_SLUGS = new Set([
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

export function normalizeFileCategory(category: string | null | undefined): FileCategory {
  const raw = (category ?? "").trim();
  if (raw === "contrato" || raw === "contrato_documentacao") return "contrato_documentacao";
  if (raw === "outro" || LEGACY_TO_OUTRO.has(raw) || !raw) return "outro";
  if (
    raw.length >= 2 &&
    raw.length <= 40 &&
    CUSTOM_SLUG_RE.test(raw) &&
    !RESERVED_FILE_SLUGS.has(raw)
  ) {
    return raw;
  }
  return "outro";
}

export function fileCategoryLabel(category: string, categoryLabel?: string | null): string {
  const map: Record<string, string> = {
    contrato_documentacao: "Contrato e Documentação do Sistema",
    outro: "Outros",
    contrato: "Contrato e Documentação do Sistema",
  };
  if (map[category]) return map[category];
  const trimmed = categoryLabel?.trim();
  if (trimmed) return trimmed;
  return category;
}

export function updateTypeLabel(type: UpdateType): string {
  const map: Record<UpdateType, string> = {
    FEATURE: "Novidade",
    FIX: "Correção",
    UPDATE: "Melhoria",
    RELEASE: "Versão nova",
    DOCUMENTATION: "Documentação",
  };
  return map[type];
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol === "http:" || u.protocol === "https:") return trimmed;
  } catch {
    return null;
  }
  return null;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function simulateDownload(filename: string) {
  const blob = new Blob(
    [`Avadesk — arquivo simulado\nNome: ${filename}\nGerado em: ${new Date().toISOString()}\n`],
    { type: "text/plain;charset=utf-8" }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pdf") ? filename.replace(/\.pdf$/i, ".txt") : filename;
  a.click();
  URL.revokeObjectURL(url);
}
