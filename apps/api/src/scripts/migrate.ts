import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../lib/db.js";
import "../lib/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../../../db/migrations");

async function migrate() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrate] no SQL files found");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    for (const file of files) {
      const applied = await client.query(`SELECT 1 FROM schema_migrations WHERE id = $1`, [file]);
      if (applied.rowCount) {
        console.log(`[migrate] skip ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[migrate] apply ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(`INSERT INTO schema_migrations (id) VALUES ($1)`, [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("[migrate] done");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
