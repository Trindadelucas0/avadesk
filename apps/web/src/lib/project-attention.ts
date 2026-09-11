import type { ProjectStatus } from "@/types";

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function attentionKindClient(
  status: string,
  lastClientUpdateAt: string | Date | null | undefined
): "stale" | "sem_novidade" | null {
  if (status === "paused") return null;
  const ref = lastClientUpdateAt ? new Date(lastClientUpdateAt).getTime() : 0;
  if (!ref || Date.now() - ref < STALE_MS) return null;
  if (status === "published" || status === "maintenance") return "sem_novidade";
  return "stale";
}

export const PROJECT_STATUSES: ProjectStatus[] = [
  "planning",
  "development",
  "testing",
  "homologation",
  "published",
  "maintenance",
  "paused",
];
