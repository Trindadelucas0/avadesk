import { query } from "./db.js";
import type { AuthUser } from "../types/index.js";

export const ACTIVE_CLIENT_COOKIE = "avadesk_cid";

export class MembershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MembershipError";
  }
}

export type MembershipRow = { client_id: string; access_all_projects: boolean };

export type MembershipInput = {
  clientId: string;
  accessAllProjects: boolean;
  projectIds: string[];
};

export type MembershipDto = {
  clientId: string;
  accessAllProjects: boolean;
  projectIds: string[];
};

export async function loadMemberships(userId: string): Promise<MembershipRow[]> {
  const r = await query<MembershipRow>(
    `SELECT m.client_id, m.access_all_projects
     FROM user_client_access m
     INNER JOIN clients c ON c.id = m.client_id
     WHERE m.user_id = $1
     ORDER BY c.name ASC`,
    [userId]
  );
  return r.rows;
}

export function resolveActiveClientId(
  cookieVal: unknown,
  storedClientId: string | null,
  memberships: MembershipRow[]
): string | null {
  const ids = new Set(memberships.map((m) => m.client_id));
  if (typeof cookieVal === "string" && ids.has(cookieVal)) return cookieVal;
  if (storedClientId && ids.has(storedClientId)) return storedClientId;
  return memberships[0]?.client_id ?? null;
}

export async function hydrateAuthUser(user: AuthUser, cookieClientId: unknown): Promise<AuthUser> {
  if (user.role !== "client") {
    return {
      ...user,
      client_id: null,
      client_ids: [],
      memberships: [],
      active_client_id: null,
      access_all_projects: true,
    };
  }
  const memberships = await loadMemberships(user.id);
  const active = resolveActiveClientId(cookieClientId, user.client_id, memberships);
  const mem = memberships.find((m) => m.client_id === active);
  return {
    ...user,
    client_id: active,
    client_ids: memberships.map((m) => m.client_id),
    memberships,
    active_client_id: active,
    access_all_projects: mem ? mem.access_all_projects !== false : true,
  };
}

export function membershipsFromBody(data: {
  memberships?: Array<{ clientId: string; accessAllProjects?: boolean; projectIds?: string[] }>;
  clientId?: string | null;
  accessAllProjects?: boolean;
  projectIds?: string[];
}): MembershipInput[] | null {
  if (data.memberships && data.memberships.length > 0) {
    const seen = new Set<string>();
    const list: MembershipInput[] = [];
    for (const m of data.memberships) {
      if (seen.has(m.clientId)) continue;
      seen.add(m.clientId);
      list.push({
        clientId: m.clientId,
        accessAllProjects: m.accessAllProjects ?? !(m.projectIds && m.projectIds.length > 0),
        projectIds: m.projectIds ?? [],
      });
    }
    return list;
  }
  if (data.clientId) {
    const accessAll = data.accessAllProjects ?? !(data.projectIds && data.projectIds.length > 0);
    return [
      {
        clientId: data.clientId,
        accessAllProjects: accessAll,
        projectIds: data.projectIds ?? [],
      },
    ];
  }
  return null;
}

export async function replaceMemberships(
  userId: string,
  role: AuthUser["role"],
  inputs: MembershipInput[] | null,
  preferredActive: string | null
): Promise<{ clientId: string | null; accessAll: boolean }> {
  await query(`DELETE FROM user_client_access WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_project_access WHERE user_id = $1`, [userId]);
  if (role !== "client") {
    return { clientId: null, accessAll: true };
  }
  if (!inputs || inputs.length === 0) {
    throw new MembershipError("Vincule o usuário a uma empresa.");
  }

  const projectRows = await query<{ id: string; client_id: string }>(
    `SELECT id, client_id FROM projects WHERE id = ANY($1::uuid[])`,
    [inputs.flatMap((m) => m.projectIds)]
  );
  const projectClient = new Map(projectRows.rows.map((p) => [p.id, p.client_id]));

  for (const m of inputs) {
    const company = await query(`SELECT id FROM clients WHERE id = $1`, [m.clientId]);
    if (!company.rows[0]) {
      throw new MembershipError("Empresa não encontrada.");
    }
    const companyProjects = await query<{ id: string }>(`SELECT id FROM projects WHERE client_id = $1`, [
      m.clientId,
    ]);
    if (companyProjects.rows.length > 0 && !m.accessAllProjects && m.projectIds.length === 0) {
      throw new MembershipError("Selecione ao menos um projeto, ou marque todos os projetos da empresa.");
    }
    for (const pid of m.projectIds) {
      if (projectClient.get(pid) !== m.clientId) {
        throw new MembershipError("Projeto não pertence à empresa marcada.");
      }
    }
  }

  await query(`DELETE FROM user_client_access WHERE user_id = $1`, [userId]);
  await query(`DELETE FROM user_project_access WHERE user_id = $1`, [userId]);

  for (const m of inputs) {
    await query(
      `INSERT INTO user_client_access (user_id, client_id, access_all_projects) VALUES ($1,$2,$3)`,
      [userId, m.clientId, m.accessAllProjects]
    );
    if (!m.accessAllProjects) {
      for (const pid of m.projectIds) {
        await query(
          `INSERT INTO user_project_access (user_id, project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [userId, pid]
        );
      }
    }
  }

  const active =
    preferredActive && inputs.some((m) => m.clientId === preferredActive)
      ? preferredActive
      : inputs[0].clientId;
  const activeMem = inputs.find((m) => m.clientId === active)!;
  return { clientId: active, accessAll: activeMem.accessAllProjects };
}

export function dtoMemberships(
  memberships: MembershipRow[],
  projectIds: string[],
  projectClient: Map<string, string>
): MembershipDto[] {
  return memberships.map((m) => ({
    clientId: m.client_id,
    accessAllProjects: m.access_all_projects !== false,
    projectIds: m.access_all_projects
      ? []
      : projectIds.filter((pid) => projectClient.get(pid) === m.client_id),
  }));
}
