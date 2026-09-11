import type { NextFunction, Request, Response } from "express";
import { getUserFromRequest } from "../lib/auth.js";
import type { AuthUser, Role } from "../types/index.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Não autenticado." } });
    }
    req.user = user;
    return next();
  } catch (err) {
    console.error("[auth]", err);
    return res.status(500).json({ error: { code: "INTERNAL", message: "Erro interno." } });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Sem permissão." } });
    }
    return next();
  };
}
