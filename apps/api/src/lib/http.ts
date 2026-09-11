import type { Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function sendError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

export function handleRouteError(res: Response, err: unknown, label: string) {
  if (err instanceof HttpError) {
    return sendError(res, err.status, err.code, err.message);
  }
  console.error(label, err instanceof Error ? err.message : err);
  return sendError(res, 500, "INTERNAL", "Erro interno.");
}

export const notFound = () => new HttpError(404, "NOT_FOUND", "Não encontrado.");
export const forbidden = () => new HttpError(403, "FORBIDDEN", "Sem permissão.");
export const unauthorized = () => new HttpError(401, "UNAUTHORIZED", "Não autenticado.");
