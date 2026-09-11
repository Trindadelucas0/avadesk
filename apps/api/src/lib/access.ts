import type { PoolClient } from "pg";
import { query } from "./db.js";
import type { AuthUser } from "../types/index.js";
import { notFound } from "./http.js";

export function isStaff(user: AuthUser): boolean {
  return user.role === "admin" || user.role === "manager";
}

export interface ProjectAccessRow {
  id: string;
  client_id: string;
  name: string;
  status: string;
  progress_pct: number;
  summary: string;
  slug: string | null;
  system_url: string | null;
  access_user: string | null;
  currently_building_title: string | null;
  currently_building_progress_pct: number | null;
  currently_building_owner: string | null;
  currently_building_eta: string | null;
  currently_building_description: string | null;
  next_step_title: string | null;
  next_step_due_label: string | null;
  archived_at: Date | null;
  last_client_update_at: Date | null;
  updated_at: Date;
  created_at: Date;
}

const PROJECT_SELECT = `
  p.id, p.client_id, p.name, p.status, p.progress_pct, p.summary, p.slug,
  p.system_url, p.access_user,
  p.currently_building_title, p.currently_building_progress_pct,
  p.currently_building_owner, p.currently_building_eta, p.currently_building_description,
  p.next_step_title, p.next_step_due_label, p.archived_at, p.last_client_update_at,
  p.updated_at, p.created_at
`;

export function clientProjectFilterSql(user: AuthUser, projectAlias = "p"): { sql: string; params: unknown[] } {
  if (isStaff(user)) {
    return { sql: "TRUE", params: [] };
  }
  if (!user.client_id) {
    return { sql: "FALSE", params: [] };
  }
  if (user.access_all_projects) {
    return { sql: `${projectAlias}.client_id = $__cid`, params: [user.client_id] };
  }
  return {
    sql: `${projectAlias}.client_id = $__cid AND EXISTS (
      SELECT 1 FROM user_project_access a
      WHERE a.user_id = $__uid AND a.project_id = ${projectAlias}.id
    )`,
    params: [user.client_id, user.id],
  };
}

/** Bind filter placeholders sequentially starting at `start`. */
export function bindClientFilter(
  user: AuthUser,
  start: number,
  projectAlias = "p"
): { sql: string; params: unknown[]; next: number } {
  if (isStaff(user)) {
    return { sql: "TRUE", params: [], next: start };
  }
  if (!user.client_id) {
    return { sql: "FALSE", params: [], next: start };
  }
  if (user.access_all_projects) {
    return {
      sql: `${projectAlias}.client_id = $${start}`,
      params: [user.client_id],
      next: start + 1,
    };
  }
  return {
    sql: `${projectAlias}.client_id = $${start} AND EXISTS (
      SELECT 1 FROM user_project_access a
      WHERE a.user_id = $${start + 1} AND a.project_id = ${projectAlias}.id
    )`,
    params: [user.client_id, user.id],
    next: start + 2,
  };
}

export async function getAccessibleProject(
  user: AuthUser,
  projectId: string,
  client?: PoolClient
): Promise<ProjectAccessRow> {
  const f = bindClientFilter(user, 2);
  const sql = `SELECT ${PROJECT_SELECT}
               FROM projects p
               WHERE p.id = $1 AND ${f.sql}`;
  const params = [projectId, ...f.params];
  const result = client
    ? await client.query<ProjectAccessRow>(sql, params)
    : await query<ProjectAccessRow>(sql, params);
  const row = result.rows[0];
  if (!row) throw notFound();
  return row;
}
