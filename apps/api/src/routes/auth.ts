import { Router } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { clearSessionCookie, setSessionCookie } from "../lib/auth.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthUser } from "../types/index.js";

const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION", message: "E-mail ou senha inválidos." } });
  }

  const email = parsed.data.email.toLowerCase().trim();
  // Trim accidental copy/paste whitespace (does not change intentional internal spaces)
  const password = parsed.data.password.trim();

  try {
    const result = await query<{
      id: string;
      email: string;
      role: AuthUser["role"];
      client_id: string | null;
      password_hash: string;
    }>(
      `SELECT id, email, role, client_id, password_hash
       FROM users
       WHERE lower(email) = $1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciais inválidas." } });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Credenciais inválidas." } });
    }

    setSessionCookie(res, user.id);
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        client_id: user.client_id,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user });
});
