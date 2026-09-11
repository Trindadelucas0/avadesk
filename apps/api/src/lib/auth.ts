import crypto from "node:crypto";
import type { Request, Response } from "express";
import { query } from "./db.js";
import { env } from "./env.js";
import type { AuthUser } from "../types/index.js";

export const COOKIE_NAMES = ["avadesk_session", "nexus_session"] as const;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

interface SessionPayload {
  uid: string;
  exp: number;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(body);
  return `${body}.${signature}`;
}

function decodeSession(token: string): SessionPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.uid || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function cookieOpts() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

export function setSessionCookie(res: Response, userId: string): void {
  const token = encodeSession({
    uid: userId,
    exp: Date.now() + SESSION_TTL_MS,
  });
  for (const name of COOKIE_NAMES) {
    res.cookie(name, token, cookieOpts());
  }
}

export function clearSessionCookie(res: Response): void {
  for (const name of COOKIE_NAMES) {
    res.clearCookie(name, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  res.clearCookie("clienthub_session", { path: "/" });
}

export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const cookies = req.cookies ?? {};
  let token: string | undefined;
  for (const name of COOKIE_NAMES) {
    if (typeof cookies[name] === "string" && cookies[name]) {
      token = cookies[name];
      break;
    }
  }
  if (!token) return null;
  const payload = decodeSession(token);
  if (!payload) return null;

  const result = await query<AuthUser>(
    `SELECT id, email, role, client_id,
            COALESCE(name, '') AS name,
            COALESCE(must_complete_profile, FALSE) AS must_complete_profile,
            COALESCE(access_all_projects, TRUE) AS access_all_projects,
            COALESCE(active, TRUE) AS active,
            avatar_initials, instagram_company, instagram_personal
     FROM users
     WHERE id = $1`,
    [payload.uid]
  );
  const user = result.rows[0];
  if (!user || user.active === false) return null;
  return user;
}
