import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireAuth } from "../middleware/auth.js";
import { handleRouteError, sendError } from "../lib/http.js";
import { env } from "../lib/env.js";
import { isAllowedPushEndpoint } from "../lib/push.js";

const subscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(10).max(400),
    auth: z.string().min(8).max(200),
  }),
});

export const v2PushRouter = Router();

v2PushRouter.get("/vapid", requireAuth, (_req, res) => {
  return res.json({ publicKey: env.vapidPublicKey });
});

v2PushRouter.post("/subscribe", requireAuth, subscribeLimiter, async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  if (!isAllowedPushEndpoint(parsed.data.endpoint)) {
    return sendError(res, 400, "VALIDATION", "Endpoint inválido.");
  }
  try {
    await query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         updated_at = NOW()`,
      [req.user!.id, parsed.data.endpoint, parsed.data.keys.p256dh, parsed.data.keys.auth]
    );
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/push:subscribe]");
  }
});

v2PushRouter.delete("/subscribe", requireAuth, subscribeLimiter, async (req, res) => {
  const parsed = z.object({ endpoint: z.string().url().max(2048) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    await query(`DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`, [
      req.user!.id,
      parsed.data.endpoint,
    ]);
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/push:unsubscribe]");
  }
});
