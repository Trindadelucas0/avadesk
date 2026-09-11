import type { Response } from "express";
import type { Role } from "../types/index.js";

export type LiveReason = "ticket" | "update" | "file" | "project";

export type LiveConn = {
  id: number;
  userId: string;
  role: Role;
  clientId: string | null;
  res: Response;
  createdAt: number;
};

export type LivePublish = {
  reason: LiveReason;
  clientId: string | null;
  actorId?: string | null;
};

const MAX_PER_USER = 20;
const HEARTBEAT_MS = 20_000;

const connections = new Set<LiveConn>();
let nextId = 1;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function shouldReceiveLive(
  conn: { userId: string; role: string; clientId: string | null },
  event: { clientId: string | null; actorId?: string | null }
): boolean {
  if (event.actorId && conn.userId === event.actorId) return false;
  if (conn.role === "admin" || conn.role === "manager") return true;
  if (!event.clientId || !conn.clientId) return false;
  return conn.clientId === event.clientId;
}

function sseData(reason: LiveReason): string {
  return `data: ${JSON.stringify({ type: "hub.changed", reason })}\n\n`;
}

function write(res: Response, chunk: string) {
  if (res.writableEnded) return;
  res.write(chunk);
}

function drop(conn: LiveConn) {
  connections.delete(conn);
  if (!conn.res.writableEnded) {
    try {
      conn.res.end();
    } catch {
      /* ignore */
    }
  }
}

function ensureHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    for (const conn of [...connections]) {
      try {
        write(conn.res, ": ping\n\n");
      } catch {
        drop(conn);
      }
    }
    if (connections.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }, HEARTBEAT_MS);
  heartbeatTimer.unref?.();
}

export function subscribeLive(opts: {
  userId: string;
  role: Role;
  clientId: string | null;
  res: Response;
}): () => void {
  const existing = [...connections].filter((c) => c.userId === opts.userId);
  if (existing.length >= MAX_PER_USER) {
    const oldest = existing.sort((a, b) => a.createdAt - b.createdAt)[0];
    if (oldest) drop(oldest);
  }
  const conn: LiveConn = {
    id: nextId++,
    userId: opts.userId,
    role: opts.role,
    clientId: opts.clientId,
    res: opts.res,
    createdAt: Date.now(),
  };
  connections.add(conn);
  ensureHeartbeat();
  write(opts.res, ": connected\n\n");
  return () => {
    connections.delete(conn);
  };
}

export function publishLive(event: LivePublish): number {
  const body = sseData(event.reason);
  let n = 0;
  for (const conn of connections) {
    if (!shouldReceiveLive(conn, event)) continue;
    try {
      write(conn.res, body);
      n += 1;
    } catch {
      drop(conn);
    }
  }
  return n;
}

/** Test helper — close every open SSE connection. */
export function resetLiveHub() {
  for (const conn of [...connections]) drop(conn);
  connections.clear();
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
