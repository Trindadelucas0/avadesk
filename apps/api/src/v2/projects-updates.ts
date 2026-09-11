import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { bindClientFilter, getAccessibleProject, isStaff } from "../lib/access.js";
import { writeAudit } from "../lib/audit.js";
import { enqueueUpdateEmails, flushOutbox } from "../lib/email.js";
import { notifyUsers, projectClientUserIds } from "../lib/notify.js";
import { handleRouteError, sendError } from "../lib/http.js";
import { attentionKind, mapProjectStatus } from "../lib/dto.js";
import { decryptSecret, encryptSecret } from "../lib/crypto-secret.js";
import { publishLive } from "../lib/live.js";
import type { AuthUser } from "../types/index.js";

const uuid = z.string().uuid();

const revealLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

function isOptionalHttpUrl(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  try {
    const u = new URL(trimmed);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

const optionalHttpUrl = z
  .string()
  .max(500)
  .optional()
  .nullable()
  .refine(isOptionalHttpUrl, "URL inválida");

function buildingFromProject(p: {
  currently_building_title: string | null;
  currently_building_progress_pct: number | null;
  currently_building_owner: string | null;
  currently_building_eta: string | null;
  currently_building_description: string | null;
  fallback_building_title?: string | null;
  fallback_building_content?: string | null;
}) {
  const title = p.currently_building_title || p.fallback_building_title;
  if (!title) return null;
  return {
    title,
    progressPct: p.currently_building_progress_pct ?? 0,
    ownerName: p.currently_building_owner ?? "",
    etaLabel: p.currently_building_eta ?? "",
    description: p.currently_building_description || p.fallback_building_content || "",
  };
}

function nextStepsFromProject(p: {
  next_step_title: string | null;
  next_step_due_label: string | null;
  fallback_next_title?: string | null;
}) {
  const title = p.next_step_title || p.fallback_next_title;
  if (!title) return [];
  return [{ id: "next", order: 1, title, dueLabel: p.next_step_due_label || undefined }];
}

export function serializeProject(
  p: Record<string, unknown>,
  opts: { includePassword?: boolean; password?: string | null } = {}
) {
  const status = mapProjectStatus(String(p.status ?? "planning"));
  const last = (p.last_client_update_at as Date | null) ?? null;
  const att = attentionKind(status, last);
  return {
    id: p.id,
    clientId: p.client_id,
    name: p.name,
    slug: p.slug || String(p.name).toLowerCase().replace(/\s+/g, "-"),
    status,
    progressPct: Number(p.progress_pct ?? 0),
    summary: p.summary ?? "",
    systemUrl: p.system_url ?? p.cred_url ?? "",
    accessUser: p.access_user ?? p.cred_user ?? "",
    accessPassword: opts.includePassword ? opts.password ?? "" : "",
    hasPassword: Boolean(p.has_password),
    currentlyBuilding: buildingFromProject(p as never),
    nextSteps: nextStepsFromProject(p as never),
    modules: [],
    updatedAt: p.updated_at,
    createdAt: p.created_at,
    lastClientUpdateAt: last,
    attention: att.kind === "none" ? null : att.kind,
    daysSinceClientUpdate: att.days,
  };
}

const PROJECT_LIST_SQL = `
  SELECT p.*,
         c.system_url AS cred_url,
         c.access_user AS cred_user,
         (c.password_ciphertext IS NOT NULL AND c.password_ciphertext <> '') AS has_password,
         b.title AS fallback_building_title,
         b.content AS fallback_building_content,
         n.title AS fallback_next_title
  FROM projects p
  LEFT JOIN project_credentials c ON c.project_id = p.id
  LEFT JOIN LATERAL (
    SELECT title, content FROM updates u
    WHERE u.project_id = p.id AND u.visible_to_client = TRUE AND u.status = 'em_andamento'
    ORDER BY u.created_at DESC LIMIT 1
  ) b ON TRUE
  LEFT JOIN LATERAL (
    SELECT title FROM updates u
    WHERE u.project_id = p.id AND u.visible_to_client = TRUE AND u.status = 'planejado'
    ORDER BY u.created_at DESC LIMIT 1
  ) n ON TRUE
`;

export const v2ProjectsRouter = Router();

v2ProjectsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const archived = req.query.archived === "1";
    const result = await query(
      `${PROJECT_LIST_SQL}
       WHERE ${f.sql} AND (${archived ? "p.archived_at IS NOT NULL" : "p.archived_at IS NULL"})
       ORDER BY p.updated_at DESC`,
      f.params
    );
    return res.json({
      projects: result.rows.map((row) => serializeProject(row)),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/projects]");
  }
});

v2ProjectsRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, parsed.data);
    const f = bindClientFilter(req.user!, 2);
    const result = await query(
      `${PROJECT_LIST_SQL} WHERE p.id = $1 AND ${f.sql}`,
      [parsed.data, ...f.params]
    );
    const row = result.rows[0];
    if (!row) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    return res.json({ project: serializeProject(row) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/projects:get]");
  }
});

const projectWrite = z.object({
  clientId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  status: z
    .enum([
      "planning",
      "development",
      "testing",
      "homologation",
      "published",
      "maintenance",
      "paused",
    ])
    .optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  summary: z.string().max(4000).optional(),
  systemUrl: optionalHttpUrl,
  accessUser: z.string().max(200).optional().nullable(),
  accessPassword: z.string().max(500).optional().nullable(),
  currentlyBuildingTitle: z.string().max(200).optional().nullable(),
  currentlyBuildingProgressPct: z.number().int().min(0).max(100).optional().nullable(),
  currentlyBuildingOwner: z.string().max(120).optional().nullable(),
  currentlyBuildingEta: z.string().max(80).optional().nullable(),
  currentlyBuildingDescription: z.string().max(2000).optional().nullable(),
  nextStepTitle: z.string().max(200).optional().nullable(),
  nextStepDueLabel: z.string().max(80).optional().nullable(),
});

v2ProjectsRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = projectWrite.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const client = await query(`SELECT id FROM clients WHERE id = $1`, [parsed.data.clientId]);
    if (!client.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const slug = parsed.data.name.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
    const systemUrl = emptyToNull(parsed.data.systemUrl);
    const accessUser = emptyToNull(parsed.data.accessUser);
    const ins = await query<{ id: string }>(
      `INSERT INTO projects (client_id, name, status, progress_pct, summary, slug, system_url, access_user)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        parsed.data.clientId,
        parsed.data.name,
        parsed.data.status ?? "planning",
        parsed.data.progressPct ?? 0,
        parsed.data.summary ?? "",
        slug,
        systemUrl,
        accessUser,
      ]
    );
    const id = ins.rows[0].id;
    const cipher =
      parsed.data.accessPassword && parsed.data.accessPassword.length > 0
        ? encryptSecret(parsed.data.accessPassword)
        : null;
    await query(
      `INSERT INTO project_credentials (project_id, system_url, access_user, password_ciphertext)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (project_id) DO UPDATE SET
         system_url = EXCLUDED.system_url,
         access_user = EXCLUDED.access_user,
         password_ciphertext = COALESCE(EXCLUDED.password_ciphertext, project_credentials.password_ciphertext),
         updated_at = NOW()`,
      [id, systemUrl, accessUser, cipher]
    );
    await writeAudit(req.user!.id, "create_project", "project", id);
    publishLive({
      reason: "project",
      clientId: parsed.data.clientId,
      actorId: req.user!.id,
    });
    const f = bindClientFilter(req.user!, 2);
    const row = await query(`${PROJECT_LIST_SQL} WHERE p.id = $1 AND ${f.sql}`, [id, ...f.params]);
    return res.status(201).json({ project: serializeProject(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/projects:create]");
  }
});

v2ProjectsRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const idParse = uuid.safeParse(req.params.id);
  if (!idParse.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = projectWrite.partial().safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const project = await getAccessibleProject(req.user!, idParse.data);
    const d = parsed.data;
    const systemUrl = d.systemUrl !== undefined ? emptyToNull(d.systemUrl) : undefined;
    const accessUser = d.accessUser !== undefined ? emptyToNull(d.accessUser) : undefined;
    await query(
      `UPDATE projects SET
         name = COALESCE($2, name),
         status = COALESCE($3, status),
         progress_pct = COALESCE($4, progress_pct),
         summary = COALESCE($5, summary),
         currently_building_title = COALESCE($6, currently_building_title),
         currently_building_progress_pct = COALESCE($7, currently_building_progress_pct),
         currently_building_owner = COALESCE($8, currently_building_owner),
         currently_building_eta = COALESCE($9, currently_building_eta),
         currently_building_description = COALESCE($10, currently_building_description),
         next_step_title = COALESCE($11, next_step_title),
         next_step_due_label = COALESCE($12, next_step_due_label),
         system_url = COALESCE($13, system_url),
         access_user = COALESCE($14, access_user),
         updated_at = NOW()
       WHERE id = $1`,
      [
        idParse.data,
        d.name ?? null,
        d.status ?? null,
        d.progressPct ?? null,
        d.summary ?? null,
        d.currentlyBuildingTitle ?? null,
        d.currentlyBuildingProgressPct ?? null,
        d.currentlyBuildingOwner ?? null,
        d.currentlyBuildingEta ?? null,
        d.currentlyBuildingDescription ?? null,
        d.nextStepTitle ?? null,
        d.nextStepDueLabel ?? null,
        systemUrl ?? null,
        accessUser ?? null,
      ]
    );
    if (d.systemUrl !== undefined || d.accessUser !== undefined || d.accessPassword !== undefined) {
      const cipher =
        d.accessPassword && d.accessPassword.length > 0 ? encryptSecret(d.accessPassword) : undefined;
      await query(
        `INSERT INTO project_credentials (project_id, system_url, access_user, password_ciphertext)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (project_id) DO UPDATE SET
           system_url = COALESCE(EXCLUDED.system_url, project_credentials.system_url),
           access_user = COALESCE(EXCLUDED.access_user, project_credentials.access_user),
           password_ciphertext = COALESCE($4, project_credentials.password_ciphertext),
           updated_at = NOW()`,
        [idParse.data, systemUrl ?? null, accessUser ?? null, cipher ?? null]
      );
    }
    await writeAudit(req.user!.id, "update_project", "project", idParse.data);
    publishLive({
      reason: "project",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    const f = bindClientFilter(req.user!, 2);
    const row = await query(`${PROJECT_LIST_SQL} WHERE p.id = $1 AND ${f.sql}`, [
      idParse.data,
      ...f.params,
    ]);
    return res.json({ project: serializeProject(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/projects:patch]");
  }
});

v2ProjectsRouter.post(
  "/:id/credentials/reveal",
  requireAuth,
  revealLimiter,
  async (req, res) => {
    const idParse = uuid.safeParse(req.params.id);
    if (!idParse.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    try {
      await getAccessibleProject(req.user!, idParse.data);
      const cred = await query<{
        system_url: string | null;
        access_user: string | null;
        password_ciphertext: string | null;
      }>(`SELECT system_url, access_user, password_ciphertext FROM project_credentials WHERE project_id = $1`, [
        idParse.data,
      ]);
      const row = cred.rows[0];
      if (!row) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      let password = "";
      if (row.password_ciphertext) {
        try {
          password = decryptSecret(row.password_ciphertext);
        } catch {
          return sendError(res, 500, "INTERNAL", "Erro interno.");
        }
      }
      await writeAudit(req.user!.id, "credential_revealed", "project", idParse.data, null, req.ip);
      return res.json({
        systemUrl: row.system_url ?? "",
        accessUser: row.access_user ?? "",
        accessPassword: password,
      });
    } catch (err) {
      return handleRouteError(res, err, "[v2/reveal]");
    }
  }
);

export const v2UpdatesRouter = Router();

function serializeUpdate(row: Record<string, unknown>) {
  return {
    id: row.id,
    projectId: row.project_id,
    authorId: row.author_id,
    authorName: row.author_name || row.author_email || "",
    type: row.type || "UPDATE",
    title: row.title || "",
    content: row.content,
    status: row.status,
    visibleToClient: row.visible_to_client,
    createdAt: row.created_at,
  };
}

v2UpdatesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    if (projectId) {
      const parsed = uuid.safeParse(projectId);
      if (!parsed.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      await getAccessibleProject(user, parsed.data);
    }
    const f = bindClientFilter(user, 1, "p");
    const params: unknown[] = [...f.params];
    let extra = "";
    if (projectId) {
      params.push(projectId);
      extra = ` AND u.project_id = $${params.length}`;
    }
    if (!isStaff(user)) {
      extra += " AND u.visible_to_client = TRUE";
    }
    const result = await query(
      `SELECT u.*, usr.email AS author_email, COALESCE(usr.name, usr.email) AS author_name
       FROM updates u
       INNER JOIN projects p ON p.id = u.project_id
       INNER JOIN users usr ON usr.id = u.author_id
       WHERE ${f.sql}${extra}
       ORDER BY u.created_at DESC
       LIMIT 500`,
      params
    );
    return res.json({ updates: result.rows.map((r) => serializeUpdate(r)) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/updates:list]");
  }
});

const createUpdateSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(8000),
  status: z.enum(["planejado", "em_andamento", "concluido"]).default("em_andamento"),
  type: z.enum(["FEATURE", "FIX", "UPDATE", "RELEASE", "DOCUMENTATION"]).default("UPDATE"),
  visibleToClient: z.boolean().default(true),
});

async function notifyClients(projectId: string, clientId: string, title: string, projectName: string) {
  const userIds = await projectClientUserIds(projectId, clientId);
  await notifyUsers({
    userIds,
    clientId,
    title: `Nova atualização · ${projectName}`,
    body: title,
    href: "/client/updates",
  });
  if (userIds.length === 0) return [];
  const rows = await query<{ email: string }>(
    `SELECT email FROM users WHERE id = ANY($1::uuid[]) AND active = TRUE`,
    [userIds]
  );
  return rows.rows.map((r) => r.email);
}

v2UpdatesRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = createUpdateSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const idem =
    typeof req.headers["idempotency-key"] === "string"
      ? req.headers["idempotency-key"].slice(0, 128)
      : null;
  const author = req.user as AuthUser;
  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    if (idem) {
      const existing = await db.query(
        `SELECT u.*, usr.email AS author_email, COALESCE(usr.name, usr.email) AS author_name
         FROM updates u
         INNER JOIN users usr ON usr.id = u.author_id
         WHERE u.author_id = $1 AND u.idempotency_key = $2`,
        [author.id, idem]
      );
      if (existing.rows[0]) {
        await db.query("COMMIT");
        return res.status(200).json({ update: serializeUpdate(existing.rows[0]), idempotent: true });
      }
    }

    const project = await db.query<{ id: string; name: string; client_id: string }>(
      `SELECT id, name, client_id FROM projects WHERE id = $1 FOR UPDATE`,
      [parsed.data.projectId]
    );
    if (!project.rows[0]) {
      await db.query("ROLLBACK");
      return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    }

    const insert = await db.query(
      `INSERT INTO updates (project_id, author_id, content, status, visible_to_client, title, type, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        parsed.data.projectId,
        author.id,
        parsed.data.content,
        parsed.data.status,
        parsed.data.visibleToClient,
        parsed.data.title,
        parsed.data.type,
        idem,
      ]
    );
    const update = insert.rows[0];
    await db.query(`UPDATE projects SET updated_at = NOW() WHERE id = $1`, [parsed.data.projectId]);
    if (parsed.data.visibleToClient) {
      await db.query(
        `UPDATE projects SET last_client_update_at = NOW() WHERE id = $1`,
        [parsed.data.projectId]
      );
    }
    await writeAudit(author.id, "update_publish", "update", update.id, parsed.data.type, req.ip, db);
    await db.query("COMMIT");

    if (parsed.data.visibleToClient) {
      try {
        const emails = await notifyClients(
          parsed.data.projectId,
          project.rows[0].client_id,
          parsed.data.title,
          project.rows[0].name
        );
        await enqueueUpdateEmails({
          emails,
          projectName: project.rows[0].name,
          title: parsed.data.title,
          content: parsed.data.content,
          status: parsed.data.status,
          updateId: update.id,
        });
        void flushOutbox().catch((e) => console.error("[outbox]", e instanceof Error ? e.message : e));
      } catch (e) {
        console.error("[v2/updates:notify]", e instanceof Error ? e.message : e);
      }
      publishLive({
        reason: "update",
        clientId: project.rows[0].client_id,
        actorId: author.id,
      });
    }

    return res.status(201).json({
      update: serializeUpdate({
        ...update,
        author_name: author.name,
        author_email: author.email,
      }),
      emailQueued: parsed.data.visibleToClient,
    });
  } catch (err) {
    await db.query("ROLLBACK");
    return handleRouteError(res, err, "[v2/updates:create]");
  } finally {
    db.release();
  }
});
