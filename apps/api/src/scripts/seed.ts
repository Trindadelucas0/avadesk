import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { env } from "../lib/env.js";

const ADMIN_EMAIL = "admin@clienthub.dev";

async function seed() {
  const passwordHash = await bcrypt.hash(env.seedPassword, 12);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email) = $1`,
      [ADMIN_EMAIL]
    );

    if (existing.rows[0]) {
      await client.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
        passwordHash,
        existing.rows[0].id,
      ]);
      console.log("[seed] admin password hash updated — no other rows changed");
    } else {
      await client.query(
        `INSERT INTO users (email, password_hash, role, client_id, name, must_complete_profile, access_all_projects, active)
         VALUES ($1, $2, 'admin', NULL, 'Admin Avadesk', FALSE, TRUE, TRUE)`,
        [ADMIN_EMAIL, passwordHash]
      );
      console.log("[seed] admin inserted — existing clients/users/projects/updates kept");
    }

    await client.query(
      `INSERT INTO app_settings (id, organization_name, updated_at)
       VALUES ('default', 'Avadesk', NOW())
       ON CONFLICT (id) DO UPDATE SET organization_name = 'Avadesk'`
    );

    await client.query("COMMIT");

    console.log("[seed] done — data was not truncated or deleted");
    console.log(`[seed] admin: ${ADMIN_EMAIL}`);
    console.log(`[seed] password: (from SEED_PASSWORD / default Hub2026!)`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error("[seed] failed", err);
  process.exit(1);
});
