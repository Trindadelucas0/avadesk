import { Router } from "express";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { ProjectRow } from "../types/index.js";

const STALE_DAYS = 7;

export const projectsRouter = Router();

/** V1 never returns plaintext system passwords (SoT is /v2 reveal). */
function withoutPassword<T extends { access_password?: unknown }>(row: T) {
  const { access_password: _omit, ...rest } = row;
  void _omit;
  return rest;
}


projectsRouter.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
  try {
    const result = await query<ProjectRow & { days_since_update: number }>(
      `SELECT
         p.id,
         p.client_id,
         p.name,
         p.status,
         p.progress_pct,
         p.system_url,
         p.access_user,
         p.updated_at,
         c.name AS client_name,
         c.company,
         (
           SELECT u.content
           FROM updates u
           WHERE u.project_id = p.id
           ORDER BY u.created_at DESC
           LIMIT 1
         ) AS last_update_content,
         (
           SELECT u.created_at
           FROM updates u
           WHERE u.project_id = p.id
           ORDER BY u.created_at DESC
           LIMIT 1
         ) AS last_update_at,
         EXTRACT(EPOCH FROM (NOW() - p.updated_at)) / 86400 AS days_since_update
       FROM projects p
       INNER JOIN clients c ON c.id = p.client_id
       ORDER BY p.updated_at ASC, p.name ASC`
    );

    const projects = result.rows.map((row) => {
      const days = Number(row.days_since_update);
      return {
        id: row.id,
        client_id: row.client_id,
        name: row.name,
        status: row.status,
        progress_pct: row.progress_pct,
        system_url: row.system_url,
        access_user: row.access_user,
        updated_at: row.updated_at,
        client_name: row.client_name,
        company: row.company,
        last_update_content: row.last_update_content ?? null,
        last_update_at: row.last_update_at ?? null,
        is_stale: days >= STALE_DAYS,
        days_since_update: Math.floor(days),
      };
    });

    return res.json({ projects });
  } catch (err) {
    console.error("[projects:list]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
});

projectsRouter.get("/mine", requireAuth, requireRole("client"), async (req, res) => {
  const clientId = req.user!.client_id;
  if (!clientId) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Cliente sem vínculo." } });
  }

  try {
    const result = await query<ProjectRow>(
      `SELECT
         p.id,
         p.client_id,
         p.name,
         p.status,
         p.progress_pct,
         p.system_url,
         p.access_user,
         p.updated_at,
         (
           SELECT u.content
           FROM updates u
           WHERE u.project_id = p.id AND u.visible_to_client = TRUE
           ORDER BY u.created_at DESC
           LIMIT 1
         ) AS last_update_content,
         (
           SELECT u.created_at
           FROM updates u
           WHERE u.project_id = p.id AND u.visible_to_client = TRUE
           ORDER BY u.created_at DESC
           LIMIT 1
         ) AS last_update_at
       FROM projects p
       WHERE p.client_id = $1
       ORDER BY p.name ASC`,
      [clientId]
    );

    return res.json({ projects: result.rows.map(withoutPassword) });
  } catch (err) {
    console.error("[projects:mine]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
});

projectsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = req.params.id;
  const user = req.user!;

  try {
    if (user.role === "admin") {
      const result = await query<ProjectRow>(
        `SELECT p.*, c.name AS client_name, c.company
         FROM projects p
         INNER JOIN clients c ON c.id = p.client_id
         WHERE p.id = $1`,
        [id]
      );
      const project = result.rows[0];
      if (!project) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Projeto não encontrado." } });
      }
      return res.json({ project: withoutPassword(project) });
    }

    if (!user.client_id) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Sem permissão." } });
    }

    const result = await query<ProjectRow>(
      `SELECT
         p.id,
         p.client_id,
         p.name,
         p.status,
         p.progress_pct,
         p.system_url,
         p.access_user,
         p.updated_at
       FROM projects p
       WHERE p.id = $1 AND p.client_id = $2`,
      [id, user.client_id]
    );
    const project = result.rows[0];
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Projeto não encontrado." } });
    }
    return res.json({ project: withoutPassword(project) });
  } catch (err) {
    console.error("[projects:get]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
});
