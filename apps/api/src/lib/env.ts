import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { assertSafeTestDatabaseUrl } from "./test-database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load monorepo root .env then local overrides (override so root .env wins over stale shell vars)
dotenv.config({ path: path.resolve(__dirname, "../../../../.env"), override: true });
dotenv.config({ path: path.resolve(__dirname, "../../.env"), override: true });

/** Strip CR (Windows) and surrounding whitespace from env values. */
function clean(value: string): string {
  return value.replace(/\r$/g, "").trim();
}

function required(name: string, fallback?: string): string {
  const raw = process.env[name] ?? fallback;
  if (!raw) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return clean(raw);
}

function resolveDatabaseUrl(): string {
  const isTest = clean(process.env.AVADESK_TEST || "") === "1";
  if (isTest) {
    const testUrl = process.env.DATABASE_URL_TEST ? clean(process.env.DATABASE_URL_TEST) : "";
    if (!testUrl) {
      throw new Error(
        "AVADESK_TEST=1 requer DATABASE_URL_TEST (ex.: postgresql://postgres:postgres@localhost:5434/nexus_test)."
      );
    }
    assertSafeTestDatabaseUrl(testUrl);
    return testUrl;
  }
  return required("DATABASE_URL", "postgresql://postgres:postgres@localhost:5434/nexus");
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  host: clean(process.env.HOST || "0.0.0.0"),
  // Must match .env.example / Docker mapping (host 5434 → container 5432)
  databaseUrl: resolveDatabaseUrl(),
  sessionSecret: required("SESSION_SECRET", "dev-only-change-me-nexus-session-secret"),
  /** Express /hub/state (ops/migrate). Next /api/hub/* is gone. Never send to the browser. */
  hubSyncSecret: clean(
    process.env.HUB_SYNC_SECRET ||
      process.env.SESSION_SECRET ||
      "dev-only-change-me-nexus-session-secret"
  ),
  webOrigin: required("WEB_ORIGIN", "http://localhost:3000"),
  resendApiKey: process.env.RESEND_API_KEY ? clean(process.env.RESEND_API_KEY) : "",
  emailFrom: process.env.EMAIL_FROM
    ? clean(process.env.EMAIL_FROM)
    : "Avadesk <onboarding@resend.dev>",
  seedPassword: process.env.SEED_PASSWORD
    ? clean(process.env.SEED_PASSWORD)
    : "Hub2026!",
  /** 32-byte hex (64 chars) or any passphrase (hashed to 32 bytes). Dev fallback only. */
  credentialsKey: process.env.CREDENTIALS_KEY
    ? clean(process.env.CREDENTIALS_KEY)
    : "dev-only-change-me-credentials-key",
  storageDir: process.env.STORAGE_DIR
    ? clean(process.env.STORAGE_DIR)
    : "",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ? clean(process.env.VAPID_PUBLIC_KEY) : "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ? clean(process.env.VAPID_PRIVATE_KEY) : "",
  vapidSubject: process.env.VAPID_SUBJECT
    ? clean(process.env.VAPID_SUBJECT)
    : "mailto:suporte@avadesk.com.br",
};

/** Safe label for logs (no password). */
export function databaseTargetLabel(url = env.databaseUrl): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}
