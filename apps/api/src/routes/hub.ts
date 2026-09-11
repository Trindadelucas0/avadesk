import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { query } from "../lib/db.js";
import { requireHubSyncSecret } from "../middleware/hub-sync.js";

const STATE_ID = "default";

type HubRow = { payload: unknown; updated_at: Date };

const putSchema = z.object({
  payload: z.record(z.unknown()),
});

const hubLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas sincronizações. Tente mais tarde." } },
});

export const hubRouter = Router();

hubRouter.use(hubLimiter);
hubRouter.use(requireHubSyncSecret);

hubRouter.get("/state", async (_req, res) => {
  try {
    const result = await query<HubRow>(
      `SELECT payload, updated_at FROM hub_state WHERE id = $1`,
      [STATE_ID]
    );
    const row = result.rows[0];
    if (!row) {
      res.json({ payload: null, updatedAt: null });
      return;
    }
    res.json({ payload: row.payload, updatedAt: row.updated_at.toISOString() });
  } catch (err) {
    console.error("[hub] GET state", err);
    res.status(500).json({ error: { code: "HUB_GET_FAILED", message: "Não foi possível ler o estado." } });
  }
});

hubRouter.put("/state", async (req, res) => {
  try {
    const parsed = putSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: { code: "INVALID_BODY", message: "payload obrigatório." } });
      return;
    }
    const result = await query<HubRow>(
      `INSERT INTO hub_state (id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
       RETURNING payload, updated_at`,
      [STATE_ID, JSON.stringify(parsed.data.payload)]
    );
    const row = result.rows[0];
    res.json({ ok: true, updatedAt: row?.updated_at.toISOString() });
  } catch (err) {
    console.error("[hub] PUT state", err);
    res.status(500).json({ error: { code: "HUB_PUT_FAILED", message: "Não foi possível salvar no banco." } });
  }
});
