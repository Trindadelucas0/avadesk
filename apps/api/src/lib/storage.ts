import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function storageRoot(): string {
  if (env.storageDir) return env.storageDir;
  return path.resolve(__dirname, "../../storage");
}

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/markdown",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "application/octet-stream",
]);

export const ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".md",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".zip",
]);

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export const TICKET_IMAGE_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
export const TICKET_IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const MAX_TICKET_IMAGE_BYTES = 2 * 1024 * 1024;
export const MAX_TICKET_ATTACHMENTS = 4;

export function normalizeImageMime(mime: string): string {
  const m = mime.toLowerCase().trim();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

/** Returns the sniffed image MIME, or null if the bytes are not PNG/JPEG/WebP. */
export function detectImageMagic(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png";
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function safeOriginalName(name: string): string {
  return path.basename(name).replace(/[^\w.\- ()à-üÀ-Ü]+/g, "_").slice(0, 180) || "arquivo";
}
