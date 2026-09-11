import type { PoolClient } from "pg";
import { query } from "./db.js";

export async function writeAudit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  meta?: string | null,
  ip?: string | null,
  client?: PoolClient
) {
  const sql = `INSERT INTO audit_logs (actor_id, action, entity, entity_id, meta, ip)
               VALUES ($1, $2, $3, $4, $5, $6)`;
  const params = [actorId, action, entity, entityId, meta ?? null, ip ?? null];
  if (client) {
    await client.query(sql, params);
    return;
  }
  await query(sql, params);
}
