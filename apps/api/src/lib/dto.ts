import type { AuthUser } from "../types/index.js";

export function toUiRole(role: AuthUser["role"]): "ADMIN" | "MANAGER" | "CLIENT" {
  if (role === "admin") return "ADMIN";
  if (role === "manager") return "MANAGER";
  return "CLIENT";
}

export function fromUiRole(role: string): AuthUser["role"] | null {
  const r = role.toLowerCase();
  if (r === "admin" || r === "manager" || r === "client") return r;
  return null;
}

export function mapProjectStatus(status: string): string {
  switch (status) {
    case "em_andamento":
    case "development":
      return "development";
    case "planejado":
    case "discovery":
    case "design":
    case "planning":
      return "planning";
    case "qa":
    case "testing":
      return "testing";
    case "release":
    case "homologation":
      return "homologation";
    case "done":
    case "published":
      return "published";
    case "maintenance":
      return "maintenance";
    case "paused":
      return "paused";
    default:
      return status;
  }
}

export function attentionKind(status: string, lastClientUpdateAt: Date | string | null): {
  kind: "none" | "stale" | "sem_novidade";
  days: number;
} {
  const mapped = mapProjectStatus(status);
  const ref = lastClientUpdateAt ? new Date(lastClientUpdateAt).getTime() : 0;
  const days = ref ? Math.floor((Date.now() - ref) / 86400000) : 999;
  if (mapped === "paused") return { kind: "none", days };
  if (!ref || days < 7) return { kind: "none", days: ref ? days : 0 };
  if (mapped === "published" || mapped === "maintenance") {
    return { kind: "sem_novidade", days };
  }
  return { kind: "stale", days };
}

export function sessionDto(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email.split("@")[0],
    role: toUiRole(user.role),
    clientId: user.client_id,
    avatarInitials: user.avatar_initials || (user.name || "U").slice(0, 2).toUpperCase(),
    mustCompleteProfile: Boolean(user.must_complete_profile),
    projectIds: [] as string[],
    accessAllProjects: user.access_all_projects !== false,
  };
}
