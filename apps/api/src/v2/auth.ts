import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { clearSessionCookie, setSessionCookie } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { writeAudit } from "../lib/audit.js";
import { sessionDto } from "../lib/dto.js";
import { handleRouteError, sendError } from "../lib/http.js";
import { hashToken, randomToken } from "../lib/crypto-secret.js";
import { enqueueMail, flushOutbox } from "../lib/email.js";
import { passwordResetEmail } from "../lib/email-templates.js";
import { env } from "../lib/env.js";
import { sendWelcomeEmail } from "../lib/notify.js";
import type { AuthUser } from "../types/index.js";

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

const GENERIC_LOGIN = "Credenciais inválidas.";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

function clientIp(req: { ip?: string; headers: Record<string, unknown> }): string | null {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string") return xf.split(",")[0]?.trim() || null;
  return req.ip ?? null;
}

export const v2AuthRouter = Router();

v2AuthRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "VALIDATION", GENERIC_LOGIN);
  }
  const email = parsed.data.email.toLowerCase().trim();
  const password = parsed.data.password.trim();
  const ip = clientIp(req);

  try {
    const result = await query<AuthUser & { password_hash: string }>(
      `SELECT id, email, role, client_id, password_hash,
              COALESCE(name, '') AS name,
              COALESCE(must_complete_profile, FALSE) AS must_complete_profile,
              COALESCE(access_all_projects, TRUE) AS access_all_projects,
              COALESCE(active, TRUE) AS active,
              avatar_initials, instagram_company, instagram_personal
       FROM users WHERE lower(email) = $1`,
      [email]
    );
    const user = result.rows[0];
    const ok = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !user.active || !ok) {
      await writeAudit(user?.id ?? null, "login_failed", "user", email, null, ip);
      return sendError(res, 401, "INVALID_CREDENTIALS", GENERIC_LOGIN);
    }

    setSessionCookie(res, user.id);
    await writeAudit(user.id, "login", "user", user.id, null, ip);
    return res.json({ user: sessionDto(user) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/login]");
  }
});

v2AuthRouter.post("/logout", async (req, res) => {
  try {
    const { getUserFromRequest } = await import("../lib/auth.js");
    const user = await getUserFromRequest(req);
    if (user) await writeAudit(user.id, "logout", "user", user.id, null, clientIp(req));
  } catch {
    /* ignore */
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

v2AuthRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(3).max(120) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const initials = parsed.data.name
      .split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    await query(`UPDATE users SET name = $1, avatar_initials = $2 WHERE id = $3`, [
      parsed.data.name,
      initials,
      req.user!.id,
    ]);
    const me = await query<AuthUser>(
      `SELECT id, email, role, client_id, COALESCE(name,'') AS name,
              COALESCE(must_complete_profile, FALSE) AS must_complete_profile,
              COALESCE(access_all_projects, TRUE) AS access_all_projects,
              COALESCE(active, TRUE) AS active,
              avatar_initials, instagram_company, instagram_personal
       FROM users WHERE id = $1`,
      [req.user!.id]
    );
    return res.json({ user: sessionDto(me.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/me:patch]");
  }
});

v2AuthRouter.get("/me", requireAuth, async (req, res) => {
  const user = req.user!;
  const access = await query<{ project_id: string }>(
    `SELECT project_id FROM user_project_access WHERE user_id = $1`,
    [user.id]
  );
  const dto = sessionDto(user);
  dto.projectIds = access.rows.map((r) => r.project_id);
  return res.json({ user: dto });
});

const profileSchema = z.object({
  name: z.string().trim().min(3).max(120),
  email: z.string().email().max(320),
  password: z.string().min(8).max(200),
  instagramCompany: z.string().max(80).optional().nullable(),
  instagramPersonal: z.string().max(80).optional().nullable(),
});

v2AuthRouter.patch("/profile", requireAuth, async (req, res) => {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  }
  const user = req.user!;
  try {
    const email = parsed.data.email.toLowerCase().trim();
    const taken = await query(`SELECT id FROM users WHERE lower(email) = $1 AND id <> $2`, [
      email,
      user.id,
    ]);
    if (taken.rows[0]) {
      return sendError(res, 400, "VALIDATION", "Este e-mail já está em uso.");
    }
    const emailChanged = email !== String(user.email).toLowerCase().trim();
    const hash = await bcrypt.hash(parsed.data.password, 12);
    await query(
      `UPDATE users SET
         name = $1, email = $2, password_hash = $3,
         instagram_company = $4, instagram_personal = $5,
         must_complete_profile = FALSE, profile_completed_at = NOW(),
         avatar_initials = $6
       WHERE id = $7`,
      [
        parsed.data.name,
        email,
        hash,
        parsed.data.instagramCompany || null,
        parsed.data.instagramPersonal || null,
        parsed.data.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        user.id,
      ]
    );
    await writeAudit(user.id, "complete_profile", "user", user.id);
    if (user.role === "client" && emailChanged) {
      await sendWelcomeEmail({
        userId: user.id,
        name: parsed.data.name,
        clientId: user.client_id,
      });
    }
    const me = await query<AuthUser>(
      `SELECT id, email, role, client_id, COALESCE(name,'') AS name,
              COALESCE(must_complete_profile, FALSE) AS must_complete_profile,
              COALESCE(access_all_projects, TRUE) AS access_all_projects,
              COALESCE(active, TRUE) AS active,
              avatar_initials, instagram_company, instagram_personal
       FROM users WHERE id = $1`,
      [user.id]
    );
    return res.json({ user: sessionDto(me.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/profile]");
  }
});

const forgotSchema = z.object({ email: z.string().email().max(320) });
const GENERIC_RESET = "Se o e-mail existir, enviaremos as instruções.";
const PASSWORD_RESET_TTL = "1 hour";

v2AuthRouter.post("/forgot", resetLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.json({ ok: true, message: GENERIC_RESET });
  }
  try {
    const email = parsed.data.email.toLowerCase().trim();
    const found = await query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email) = $1 AND active = TRUE`,
      [email]
    );
    const user = found.rows[0];
    if (user) {
      const token = randomToken();
      const tokenHash = hashToken(token);
      await query(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + $3::interval)`,
        [user.id, tokenHash, PASSWORD_RESET_TTL]
      );
      const resetUrl = `${env.webOrigin}/reset-password?token=${encodeURIComponent(token)}`;
      const mail = passwordResetEmail(resetUrl);
      await enqueueMail({
        to: email,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      });
      await writeAudit(user.id, "password_reset_requested", "user", user.id);
      void flushOutbox().catch(() => undefined);
    }
    return res.json({ ok: true, message: GENERIC_RESET });
  } catch (err) {
    return handleRouteError(res, err, "[v2/forgot]");
  }
});

const resetSchema = z.object({
  token: z.string().min(8).max(200),
  password: z.string().min(8).max(200),
});

v2AuthRouter.post("/reset", resetLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, "VALIDATION", "Não foi possível redefinir a senha.");
  }
  try {
    const tokenHash = hashToken(parsed.data.token);
    const row = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()`,
      [tokenHash]
    );
    const token = row.rows[0];
    if (!token) {
      return sendError(res, 400, "INVALID_TOKEN", "Não foi possível redefinir a senha.");
    }
    const hash = await bcrypt.hash(parsed.data.password, 12);
    await query(`UPDATE users SET password_hash = $1, must_complete_profile = FALSE WHERE id = $2`, [
      hash,
      token.user_id,
    ]);
    await query(`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`, [token.id]);
    await writeAudit(token.user_id, "password_reset", "user", token.user_id);
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/reset]");
  }
});
