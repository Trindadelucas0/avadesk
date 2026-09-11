import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getAccessibleProject } from "../lib/access.js";
import { writeAudit } from "../lib/audit.js";
import { handleRouteError, sendError } from "../lib/http.js";
import { decryptSecret, encryptSecret } from "../lib/crypto-secret.js";

const uuid = z.string().uuid();
const environmentSchema = z.enum(["test", "production"]);
const ENVIRONMENTS = ["test", "production"] as const;
const MAX_ENV_CHARS = 65536;

const putBody = z.object({
  content: z.string().min(1).max(MAX_ENV_CHARS),
});

const revealLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

function metaRow(
  environment: (typeof ENVIRONMENTS)[number],
  updatedAt: Date | string | null | undefined,
  hasContent: boolean
) {
  return {
    environment,
    hasContent,
    updatedAt: hasContent && updatedAt ? updatedAt : null,
  };
}

export const v2ProjectEnvRouter = Router();

v2ProjectEnvRouter.get("/:id/env", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = uuid.safeParse(req.params.id);
  if (!parsed.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    await getAccessibleProject(req.user!, parsed.data);
    const rows = await query<{ environment: string; updated_at: Date }>(
      `SELECT environment, updated_at FROM project_env_vault WHERE project_id = $1`,
      [parsed.data]
    );
    const byEnv = new Map(rows.rows.map((r) => [r.environment, r]));
    return res.json({
      environments: ENVIRONMENTS.map((environment) => {
        const row = byEnv.get(environment);
        return metaRow(environment, row?.updated_at, Boolean(row));
      }),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/env:list]");
  }
});

v2ProjectEnvRouter.put(
  "/:id/env/:environment",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const idParse = uuid.safeParse(req.params.id);
    if (!idParse.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const envParse = environmentSchema.safeParse(req.params.environment);
    if (!envParse.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    const body = putBody.safeParse(req.body);
    if (!body.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    try {
      await getAccessibleProject(req.user!, idParse.data);
      const content = body.data.content.trim();
      if (!content) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
      if (content.length > MAX_ENV_CHARS) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
      const ciphertext = encryptSecret(content);
      const saved = await query<{ updated_at: Date }>(
        `INSERT INTO project_env_vault (project_id, environment, ciphertext, updated_at, updated_by)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT (project_id, environment) DO UPDATE SET
           ciphertext = EXCLUDED.ciphertext,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
         RETURNING updated_at`,
        [idParse.data, envParse.data, ciphertext, req.user!.id]
      );
      await writeAudit(req.user!.id, "env_saved", "project", idParse.data, envParse.data, req.ip);
      return res.json(metaRow(envParse.data, saved.rows[0]?.updated_at, true));
    } catch (err) {
      return handleRouteError(res, err, "[v2/env:put]");
    }
  }
);

v2ProjectEnvRouter.post(
  "/:id/env/:environment/reveal",
  requireAuth,
  requireRole("admin"),
  revealLimiter,
  async (req, res) => {
    const idParse = uuid.safeParse(req.params.id);
    if (!idParse.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const envParse = environmentSchema.safeParse(req.params.environment);
    if (!envParse.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    try {
      await getAccessibleProject(req.user!, idParse.data);
      const row = await query<{ ciphertext: string }>(
        `SELECT ciphertext FROM project_env_vault WHERE project_id = $1 AND environment = $2`,
        [idParse.data, envParse.data]
      );
      const cipher = row.rows[0]?.ciphertext;
      if (!cipher) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      let content = "";
      try {
        content = decryptSecret(cipher);
      } catch {
        return sendError(res, 500, "INTERNAL", "Erro interno.");
      }
      await writeAudit(req.user!.id, "env_revealed", "project", idParse.data, envParse.data, req.ip);
      return res.json({ content });
    } catch (err) {
      return handleRouteError(res, err, "[v2/env:reveal]");
    }
  }
);

v2ProjectEnvRouter.delete(
  "/:id/env/:environment",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    const idParse = uuid.safeParse(req.params.id);
    if (!idParse.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const envParse = environmentSchema.safeParse(req.params.environment);
    if (!envParse.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    try {
      await getAccessibleProject(req.user!, idParse.data);
      await query(`DELETE FROM project_env_vault WHERE project_id = $1 AND environment = $2`, [
        idParse.data,
        envParse.data,
      ]);
      await writeAudit(req.user!.id, "env_cleared", "project", idParse.data, envParse.data, req.ip);
      return res.status(204).end();
    } catch (err) {
      return handleRouteError(res, err, "[v2/env:delete]");
    }
  }
);
