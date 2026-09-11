import crypto from "node:crypto";
import { env } from "./env.js";

const PREFIX = "v1";

function keyBuffer(): Buffer {
  const raw = env.credentialsKey;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

/** AES-256-GCM. Format: v1:ivB64:tagB64:cipherB64 */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyBuffer(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(":");
}

export function decryptSecret(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Invalid ciphertext");
  }
  const iv = Buffer.from(parts[1], "base64url");
  const tag = Buffer.from(parts[2], "base64url");
  const data = Buffer.from(parts[3], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyBuffer(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}
