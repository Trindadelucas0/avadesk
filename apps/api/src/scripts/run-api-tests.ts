/**
 * Runs API integration tests against DATABASE_URL_TEST (nexus_test).
 * Never TRUNCATEs the UI database (nexus).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import {
  assertSafeTestDatabaseUrl,
  databaseNameFromUrl,
  quoteIdent,
} from "../lib/test-database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(apiRoot, "../..");
const migrationsDir = path.resolve(repoRoot, "db/migrations");

dotenv.config({ path: path.join(repoRoot, ".env"), override: true });
dotenv.config({ path: path.join(apiRoot, ".env"), override: true });

function clean(value: string): string {
  return value.replace(/\r$/g, "").trim();
}

function defaultTestUrl(appUrl: string): string {
  try {
    const u = new URL(appUrl);
    u.pathname = "/nexus_test";
    return u.toString();
  } catch {
    return "postgresql://postgres:postgres@localhost:5434/nexus_test";
  }
}

async function ensureDatabase(adminUrl: string, testUrl: string) {
  const name = databaseNameFromUrl(testUrl);
  const pool = new pg.Pool({ connectionString: adminUrl });
  try {
    const exists = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [name]);
    if (exists.rowCount) return;
    console.log(`[test] creating database ${name}`);
    await pool.query(`CREATE DATABASE ${quoteIdent(name)}`);
  } finally {
    await pool.end();
  }
}

async function migrateTestDb(testUrl: string) {
  const pool = new pg.Pool({ connectionString: testUrl });
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
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
      if (applied.rowCount) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`[test] migrate ${file}`);
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
  } finally {
    client.release();
    await pool.end();
  }
}

function runTests(testUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn("npx", ["tsx", "--test", "tests/**/*.test.ts"], {
      cwd: apiRoot,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        DATABASE_URL: testUrl,
        DATABASE_URL_TEST: testUrl,
        AVADESK_TEST: "1",
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

const appUrl = clean(process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5434/nexus");
const testUrl = clean(process.env.DATABASE_URL_TEST || defaultTestUrl(appUrl));
assertSafeTestDatabaseUrl(testUrl);

await ensureDatabase(appUrl, testUrl);
await migrateTestDb(testUrl);
const code = await runTests(testUrl);
process.exit(code);
