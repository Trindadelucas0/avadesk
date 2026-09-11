import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../lib/db.js";
import { sendProjectUpdateEmail } from "../lib/email.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import type { UpdateRow } from "../types/index.js";

const createSchema = z.object({
  project_id: z.string().uuid(),
  content: z.string().trim().min(1).max(5000),
  status: z.enum(["planejado", "em_andamento", "concluido"]).default("em_andamento"),
  visible_to_client: z.boolean().default(true),
});

export const updatesRouter = Router();

updatesRouter.get("/project/:projectId", requireAuth, async (req, res) => {
  const projectId = req.params.projectId;
  const user = req.user!;

  try {
    if (user.role === "client") {
      if (!user.client_id) {
        return res.status(403).json({ error: { code: "FORBIDDEN", message: "Sem permissão." } });
      }
      const owned = await query(
        `SELECT id FROM projects WHERE id = $1 AND client_id = $2`,
        [projectId, user.client_id]
      );
      if (!owned.rows[0]) {
        return res.status(404).json({ error: { code: "NOT_FOUND", message: "Projeto não encontrado." } });
      }

      const result = await query<UpdateRow>(
        `SELECT u.id, u.project_id, u.author_id, u.content, u.status, u.visible_to_client, u.created_at,
                usr.email AS author_email
         FROM updates u
         INNER JOIN users usr ON usr.id = u.author_id
         WHERE u.project_id = $1 AND u.visible_to_client = TRUE
         ORDER BY u.created_at DESC`,
        [projectId]
      );
      return res.json({ updates: result.rows });
    }

    // admin
    const result = await query<UpdateRow>(
      `SELECT u.id, u.project_id, u.author_id, u.content, u.status, u.visible_to_client, u.created_at,
              usr.email AS author_email
       FROM updates u
       INNER JOIN users usr ON usr.id = u.author_id
       WHERE u.project_id = $1
       ORDER BY u.created_at DESC`,
      [projectId]
    );
    return res.json({ updates: result.rows });
  } catch (err) {
    console.error("[updates:list]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
});

updatesRouter.post("/", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION", message: "Dados inválidos." } });
  }

  const { project_id, content, status, visible_to_client } = parsed.data;
  const authorId = req.user!.id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const projectResult = await client.query<{
      id: string;
      name: string;
      client_id: string;
    }>(`SELECT id, name, client_id FROM projects WHERE id = $1 FOR UPDATE`, [project_id]);

    const project = projectResult.rows[0];
    if (!project) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Projeto não encontrado." } });
    }

    const insert = await client.query<UpdateRow>(
      `INSERT INTO updates (project_id, author_id, content, status, visible_to_client)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, project_id, author_id, content, status, visible_to_client, created_at`,
      [project_id, authorId, content, status, visible_to_client]
    );

    await client.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [project_id]);

    await client.query("COMMIT");

    const update = insert.rows[0];

    if (visible_to_client) {
      const recipients = await query<{ email: string }>(
        `SELECT email FROM users WHERE role = 'client' AND client_id = $1`,
        [project.client_id]
      );
      // fire-and-forget; failures are logged inside sendProjectUpdateEmail
      void sendProjectUpdateEmail({
        to: recipients.rows.map((r) => r.email),
        projectName: project.name,
        content,
        status,
      });
    }

    return res.status(201).json({ update });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[updates:create]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  } finally {
    client.release();
  }
});
