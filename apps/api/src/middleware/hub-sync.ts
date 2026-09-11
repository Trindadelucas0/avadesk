import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../lib/env.js";

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** Hub snapshot is only callable from the Next proxy with the shared secret. */
export function requireHubSyncSecret(req: Request, res: Response, next: NextFunction) {
  const got = req.header("x-hub-sync-secret") ?? "";
  if (!got || !secretsEqual(got, env.hubSyncSecret)) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Não autenticado." },
    });
  }
  return next();
}
