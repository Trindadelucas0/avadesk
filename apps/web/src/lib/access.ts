import type { Project, Role, SessionUser, User } from "@/types";

export function clientAccessibleProjects(
  session: Pick<User, "role" | "clientId" | "projectIds" | "accessAllProjects"> | SessionUser | null,
  projects: Project[]
): Project[] {
  if (!session) return [];
  if (session.role !== "CLIENT") return projects;
  const company = projects.filter((p) => p.clientId === session.clientId);
  if (session.accessAllProjects || !session.projectIds?.length) return company;
  const allowed = new Set(session.projectIds);
  return company.filter((p) => allowed.has(p.id));
}

export function canSeeProject(
  session: Pick<User, "role" | "clientId" | "projectIds" | "accessAllProjects"> | SessionUser | null,
  project: Project
): boolean {
  if (!session) return false;
  if (session.role !== "CLIENT") return true;
  return clientAccessibleProjects(session, [project]).length === 1;
}

export function roleLabel(role: Role): string {
  if (role === "ADMIN") return "Admin";
  if (role === "MANAGER") return "Equipe";
  return "Cliente";
}

export function isStaffRole(role?: Role | null): boolean {
  return role === "ADMIN" || role === "MANAGER";
}
