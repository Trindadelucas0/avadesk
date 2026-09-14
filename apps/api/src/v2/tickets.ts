import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { pool, query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { bindClientFilter, getAccessibleProject, isStaff } from "../lib/access.js";
import { writeAudit } from "../lib/audit.js";
import { handleRouteError, HttpError, sendError } from "../lib/http.js";
import { env } from "../lib/env.js";
import { notifyUsers, projectClientUserIds, staffUserIds } from "../lib/notify.js";
import { ticketStageEmail, type TicketEmailKind } from "../lib/email-templates.js";
import { publishLive } from "../lib/live.js";
import type { AuthUser } from "../types/index.js";
import {
  MAX_TICKET_ATTACHMENTS,
  MAX_TICKET_IMAGE_BYTES,
  TICKET_IMAGE_EXT,
  TICKET_IMAGE_MIME,
  detectImageMagic,
  normalizeImageMime,
  safeOriginalName,
  storageRoot,
} from "../lib/storage.js";
import { buildTicketPdf, ticketPdfDisposition } from "../lib/ticket-pdf.js";

const uuid = z.string().uuid();
const STAGES = ["fix", "production", "resolved"] as const;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CLOSED_RANGE_DAYS = 366;

function queryStr(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function inclusiveDaySpan(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / 86_400_000) + 1;
}

const bugFields = z
  .object({
    problem: z.string().trim().min(1).max(4000),
    where: z.string().trim().min(1).max(200),
    repro: z.string().trim().max(4000).optional().default(""),
    expected: z.string().trim().max(4000).optional().default(""),
  })
  .strict();

const implementationFields = z
  .object({
    what: z.string().trim().min(1).max(4000),
    why: z.string().trim().min(1).max(4000),
  })
  .strict();

const featureFields = z
  .object({
    whatUserDoes: z.string().trim().min(1).max(4000),
    whoUses: z.string().trim().max(400).optional().default(""),
    doneWhen: z.string().trim().max(4000).optional().default(""),
  })
  .strict();

const routineFields = z
  .object({
    routineName: z.string().trim().min(1).max(200),
    whatChanges: z.string().trim().min(1).max(4000),
    when: z.string().trim().max(200).optional().default(""),
  })
  .strict();

const ticketTypeEnum = z.enum(["bug", "implementation", "feature", "routine", "other"]);
const CLIENT_CREATE_TICKET_TYPES = new Set(["bug", "other"]);

const otherFields = z
  .object({
    customName: z.string().trim().min(2).max(60),
    what: z.string().trim().min(1).max(4000),
  })
  .strict();

function parseFields(type: string, fields: unknown) {
  if (type === "bug") return bugFields.safeParse(fields);
  if (type === "implementation") return implementationFields.safeParse(fields);
  if (type === "feature") return featureFields.safeParse(fields);
  if (type === "routine") return routineFields.safeParse(fields);
  if (type === "other") return otherFields.safeParse(fields);
  return bugFields.safeParse(undefined);
}

function clientMaySetTicketType(type: string, existingType?: string): boolean {
  if (CLIENT_CREATE_TICKET_TYPES.has(type)) return true;
  return Boolean(existingType && type === existingType);
}

function ticketTitleFromFields(type: string, title: string, fields: unknown): string {
  if (type !== "other" || !fields || typeof fields !== "object") return title;
  const name = (fields as { customName?: unknown }).customName;
  return typeof name === "string" && name.trim() ? name.trim() : title;
}

type TicketRow = Record<string, unknown>;

export type TicketEventDto = {
  id: string;
  actorId: string | null;
  actorName: string;
  fromStage: string | null;
  toStage: string;
  note: string;
  createdAt: string;
};

export type TicketAttachmentDto = {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
};

export type TicketMessageDto = {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  kind: string;
  body: string;
  createdAt: string;
};

export type TicketDto = {
  id: string;
  projectId: string;
  projectName: string;
  type: string;
  title: string;
  fields: Record<string, unknown>;
  stage: string;
  origin: string;
  createdByUserId: string | null;
  createdByName: string;
  awaitingReplyFromUserId: string | null;
  awaitingReplyFromName: string;
  clientConfirmedAt: string | null;
  clientConfirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
  events: TicketEventDto[];
  attachments: TicketAttachmentDto[];
  messages: TicketMessageDto[];
};

function serializeTicket(
  row: TicketRow,
  events: TicketEventDto[] = [],
  attachments: TicketAttachmentDto[] = [],
  messages: TicketMessageDto[] = []
): TicketDto {
  const fields = (row.fields && typeof row.fields === "object" ? row.fields : {}) as Record<
    string,
    unknown
  >;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    projectName: String(row.project_name ?? ""),
    type: String(row.type),
    title: String(row.title),
    fields,
    stage: String(row.stage),
    origin: String(row.origin),
    createdByUserId: row.created_by_user_id ? String(row.created_by_user_id) : null,
    createdByName: String(row.created_by_name ?? ""),
    awaitingReplyFromUserId: row.awaiting_reply_from_user_id
      ? String(row.awaiting_reply_from_user_id)
      : null,
    awaitingReplyFromName: String(row.awaiting_reply_from_name ?? ""),
    clientConfirmedAt: row.client_confirmed_at
      ? new Date(row.client_confirmed_at as string | Date).toISOString()
      : null,
    clientConfirmedBy: row.client_confirmed_by ? String(row.client_confirmed_by) : null,
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    events,
    attachments,
    messages,
  };
}

function serializeEvent(row: TicketRow): TicketEventDto {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name ?? ""),
    fromStage: row.from_stage ? String(row.from_stage) : null,
    toStage: String(row.to_stage),
    note: String(row.note ?? ""),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

async function loadEvents(ticketIds: string[]): Promise<Map<string, TicketEventDto[]>> {
  const map = new Map<string, TicketEventDto[]>();
  if (ticketIds.length === 0) return map;
  const rows = await query<TicketRow>(
    `SELECT e.*, COALESCE(usr.name, usr.email, '') AS actor_name
     FROM ticket_events e
     LEFT JOIN users usr ON usr.id = e.actor_id
     WHERE e.ticket_id = ANY($1::uuid[])
     ORDER BY e.created_at ASC`,
    [ticketIds]
  );
  for (const row of rows.rows) {
    const tid = String(row.ticket_id);
    const list = map.get(tid) ?? [];
    list.push(serializeEvent(row));
    map.set(tid, list);
  }
  return map;
}

function serializeAttachment(row: TicketRow): TicketAttachmentDto {
  return {
    id: String(row.id),
    originalName: String(row.original_name ?? ""),
    mime: String(row.mime ?? ""),
    sizeBytes: Number(row.size_bytes ?? 0),
  };
}

async function loadAttachments(ticketIds: string[]): Promise<Map<string, TicketAttachmentDto[]>> {
  const map = new Map<string, TicketAttachmentDto[]>();
  if (ticketIds.length === 0) return map;
  const rows = await query<TicketRow>(
    `SELECT id, ticket_id, original_name, mime, size_bytes
     FROM ticket_attachments
     WHERE ticket_id = ANY($1::uuid[])
     ORDER BY created_at ASC`,
    [ticketIds]
  );
  for (const row of rows.rows) {
    const tid = String(row.ticket_id);
    const list = map.get(tid) ?? [];
    list.push(serializeAttachment(row));
    map.set(tid, list);
  }
  return map;
}

function serializeMessage(row: TicketRow): TicketMessageDto {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : null,
    actorName: String(row.actor_name ?? ""),
    actorRole: String(row.actor_role ?? ""),
    kind: String(row.kind),
    body: String(row.body ?? ""),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
  };
}

async function loadMessages(ticketIds: string[]): Promise<Map<string, TicketMessageDto[]>> {
  const map = new Map<string, TicketMessageDto[]>();
  if (ticketIds.length === 0) return map;
  const rows = await query<TicketRow>(
    `SELECT m.*, COALESCE(usr.name, usr.email, '') AS actor_name, COALESCE(usr.role, '') AS actor_role
     FROM ticket_messages m
     LEFT JOIN users usr ON usr.id = m.actor_id
     WHERE m.ticket_id = ANY($1::uuid[])
     ORDER BY m.created_at ASC`,
    [ticketIds]
  );
  for (const row of rows.rows) {
    const tid = String(row.ticket_id);
    const list = map.get(tid) ?? [];
    list.push(serializeMessage(row));
    map.set(tid, list);
  }
  return map;
}

async function toTicketDto(row: TicketRow): Promise<TicketDto> {
  const id = String(row.id);
  const [events, attachments, messages] = await Promise.all([
    loadEvents([id]),
    loadAttachments([id]),
    loadMessages([id]),
  ]);
  return serializeTicket(
    row,
    events.get(id) ?? [],
    attachments.get(id) ?? [],
    messages.get(id) ?? []
  );
}

const TICKET_SELECT = `SELECT t.*, p.name AS project_name,
       COALESCE(usr.name, usr.email, '') AS created_by_name,
       COALESCE(awaiter.name, awaiter.email, '') AS awaiting_reply_from_name
       FROM tickets t
       INNER JOIN projects p ON p.id = t.project_id
       LEFT JOIN users usr ON usr.id = t.created_by_user_id
       LEFT JOIN users awaiter ON awaiter.id = t.awaiting_reply_from_user_id`;

const TICKET_ALIVE = `t.deleted_at IS NULL`;

export type TicketListStage = "open" | "closed";

export async function listTicketsDto(
  user: AuthUser,
  opts: {
    projectId?: string;
    limit?: number;
    stage?: TicketListStage;
    confirmedFrom?: string;
    confirmedTo?: string;
  } = {}
): Promise<TicketDto[]> {
  const stage: TicketListStage = opts.stage ?? "open";
  if (stage === "closed") {
    const from = opts.confirmedFrom;
    const to = opts.confirmedTo;
    if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
      throw new HttpError(400, "VALIDATION", "Dados inválidos.");
    }
    if (inclusiveDaySpan(from, to) > MAX_CLOSED_RANGE_DAYS) {
      throw new HttpError(400, "VALIDATION", "Dados inválidos.");
    }
  }

  const f = bindClientFilter(user, 1);
  const params = [...f.params];
  let extra = ` AND ${TICKET_ALIVE}`;
  if (opts.projectId) {
    await getAccessibleProject(user, opts.projectId);
    params.push(opts.projectId);
    extra += ` AND t.project_id = $${params.length}`;
  }
  if (stage === "closed") {
    extra += ` AND t.stage = 'closed'`;
    params.push(opts.confirmedFrom);
    extra += ` AND COALESCE(t.client_confirmed_at, t.updated_at) >= $${params.length}::date`;
    params.push(opts.confirmedTo);
    extra += ` AND COALESCE(t.client_confirmed_at, t.updated_at) < ($${params.length}::date + interval '1 day')`;
  } else {
    extra += ` AND t.stage <> 'closed'`;
  }
  const limit = opts.limit ?? 100;
  params.push(limit);
  const orderBy =
    stage === "closed"
      ? "COALESCE(t.client_confirmed_at, t.updated_at) DESC"
      : "t.created_at DESC";
  const rows = await query<TicketRow>(
    `${TICKET_SELECT}
     WHERE ${f.sql}${extra}
     ORDER BY ${orderBy}
     LIMIT $${params.length}`,
    params
  );
  const ids = rows.rows.map((r) => String(r.id));
  const [events, attachments, messages] = await Promise.all([
    loadEvents(ids),
    loadAttachments(ids),
    loadMessages(ids),
  ]);
  return rows.rows.map((r) =>
    serializeTicket(
      r,
      events.get(String(r.id)) ?? [],
      attachments.get(String(r.id)) ?? [],
      messages.get(String(r.id)) ?? []
    )
  );
}

async function getTicketRow(user: AuthUser, id: string): Promise<TicketRow | null> {
  const f = bindClientFilter(user, 2);
  const result = await query<TicketRow>(
    `${TICKET_SELECT}
     WHERE t.id = $1 AND ${f.sql} AND ${TICKET_ALIVE}`,
    [id, ...f.params]
  );
  return result.rows[0] ?? null;
}

async function dtoForTicket(user: AuthUser, id: string): Promise<TicketDto | null> {
  const row = await getTicketRow(user, id);
  if (!row) return null;
  return toTicketDto(row);
}

async function eligibleClientUser(
  userId: string,
  projectId: string,
  clientId: string
): Promise<boolean> {
  const row = await query(
    `SELECT u.id
     FROM users u
     INNER JOIN user_client_access m ON m.user_id = u.id AND m.client_id = $2
     WHERE u.id = $1
       AND u.role = 'client'
       AND u.active = TRUE
       AND (
         m.access_all_projects
         OR EXISTS (
           SELECT 1 FROM user_project_access a
           WHERE a.user_id = u.id AND a.project_id = $3
         )
       )`,
    [userId, clientId, projectId]
  );
  return Boolean(row.rows[0]);
}

async function defaultWaitForUserId(
  projectId: string,
  clientId: string,
  createdByUserId: string | null
): Promise<string | null> {
  if (createdByUserId && (await eligibleClientUser(createdByUserId, projectId, clientId))) {
    return createdByUserId;
  }
  const ids = await projectClientUserIds(projectId, clientId);
  return ids[0] ?? null;
}

async function insertEvent(
  ticketId: string,
  actorId: string,
  fromStage: string | null,
  toStage: string,
  note = ""
) {
  await query(
    `INSERT INTO ticket_events (ticket_id, actor_id, from_stage, to_stage, note)
     VALUES ($1,$2,$3,$4,$5)`,
    [ticketId, actorId, fromStage, toStage, note]
  );
}

async function notifyTicketStaff(
  kind: TicketEmailKind,
  ticket: { id: string; title: string; projectName: string },
  excludeUserId?: string | null,
  note?: string
) {
  const mail = ticketStageEmail({
    kind,
    ticketTitle: ticket.title,
    projectName: ticket.projectName,
    note,
    ctaUrl: `${env.webOrigin}/admin/chamados`,
  });
  await notifyUsers({
    userIds: await staffUserIds(excludeUserId),
    clientId: null,
    title: mail.title,
    body: mail.body,
    href: "/admin/chamados",
    excludeUserId,
    email: mail,
    relatedTicketId: ticket.id,
  });
}

async function notifyTicketClients(
  kind: TicketEmailKind,
  opts: {
    projectId: string;
    clientId: string;
    ticketId: string;
    title: string;
    projectName: string;
    excludeUserId?: string | null;
    note?: string;
  }
) {
  const mail = ticketStageEmail({
    kind,
    ticketTitle: opts.title,
    projectName: opts.projectName,
    note: opts.note,
    ctaUrl: `${env.webOrigin}/client/chamados`,
  });
  const userIds = await projectClientUserIds(opts.projectId, opts.clientId, opts.excludeUserId);
  if (userIds.length === 0) {
    console.warn("[notify] no client users", opts.clientId, opts.projectId);
  }
  await notifyUsers({
    userIds,
    clientId: opts.clientId,
    title: mail.title,
    body: mail.body,
    href: "/client/chamados",
    excludeUserId: opts.excludeUserId,
    email: mail,
    relatedTicketId: opts.ticketId,
  });
}

function canMoveStage(from: string, to: string): boolean {
  if (from === "closed") return false;
  if (to === "closed") return false;
  const fi = STAGES.indexOf(from as (typeof STAGES)[number]);
  const ti = STAGES.indexOf(to as (typeof STAGES)[number]);
  if (fi < 0 || ti < 0) return false;
  return Math.abs(ti - fi) === 1;
}

function isTicketAuthor(row: TicketRow, userId: string): boolean {
  return Boolean(row.created_by_user_id) && String(row.created_by_user_id) === userId;
}

function ticketContentEditable(stage: string, events: TicketEventDto[]): boolean {
  return stage === "fix" && !events.some((ev) => Boolean(ev.fromStage));
}

const contentSchema = z.object({
  type: ticketTypeEnum,
  title: z.string().trim().min(1).max(200),
  fields: z.unknown(),
});

const skipTestLimiter = () => (process.env.AVADESK_TEST || "").trim() === "1";

const skipTicketLimiter = (req: { user?: AuthUser }) =>
  skipTestLimiter() || Boolean(req.user && isStaff(req.user));

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: skipTicketLimiter,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitos chamados. Tente mais tarde." } },
});

const attachLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  skip: skipTicketLimiter,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas imagens. Tente mais tarde." } },
});

const messageLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  skip: skipTicketLimiter,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas mensagens. Tente mais tarde." } },
});

const pdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  skip: skipTicketLimiter,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitos downloads. Tente mais tarde." } },
});

const deleteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  skip: skipTestLimiter,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas exclusões. Tente mais tarde." } },
});

export const v2TicketsRouter = Router();

v2TicketsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const projectId = queryStr(req.query.projectId);
    const stageRaw = queryStr(req.query.stage) ?? "open";
    const from = queryStr(req.query.from);
    const to = queryStr(req.query.to);
    if (projectId && !uuid.safeParse(projectId).success) {
      return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    }
    if (stageRaw !== "open" && stageRaw !== "closed") {
      return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    }
    if (stageRaw === "closed") {
      if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to) || from > to) {
        return sendError(res, 400, "VALIDATION", "Dados inválidos.");
      }
      if (inclusiveDaySpan(from, to) > MAX_CLOSED_RANGE_DAYS) {
        return sendError(res, 400, "VALIDATION", "Dados inválidos.");
      }
    }
    const tickets = await listTicketsDto(req.user!, {
      projectId,
      stage: stageRaw,
      confirmedFrom: stageRaw === "closed" ? from : undefined,
      confirmedTo: stageRaw === "closed" ? to : undefined,
    });
    return res.json({ tickets });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets]");
  }
});

v2TicketsRouter.get("/:id", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const row = await getTicketRow(req.user!, id.data);
    if (!row) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    return res.json({ ticket: await toTicketDto(row) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:get]");
  }
});

v2TicketsRouter.delete("/:id", requireAuth, requireRole("admin", "manager"), deleteLimiter, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const user = req.user!;
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const updated = await query(
      `UPDATE tickets
       SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id.data, user.id]
    );
    if (!updated.rowCount) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await writeAudit(user.id, "ticket_delete", "ticket", id.data);
    const project = await getAccessibleProject(user, String(existing.project_id));
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:delete]");
  }
});

v2TicketsRouter.get("/:id/pdf", requireAuth, pdfLimiter, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  if (!isStaff(req.user!)) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const row = await getTicketRow(req.user!, id.data);
    if (!row) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const ticket = await toTicketDto(row);
    const bytes = await buildTicketPdf(ticket);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", ticketPdfDisposition(ticket.title));
    return res.send(Buffer.from(bytes));
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:pdf]");
  }
});

v2TicketsRouter.post("/", requireAuth, createLimiter, async (req, res) => {
  const schema = z.object({
    projectId: z.string().uuid(),
    type: ticketTypeEnum,
    title: z.string().trim().min(1).max(200),
    fields: z.unknown(),
    origin: z.enum(["portal", "admin_report"]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const fieldsParsed = parseFields(parsed.data.type, parsed.data.fields ?? {});
  if (!fieldsParsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const user = req.user!;
  if (!isStaff(user) && !clientMaySetTicketType(parsed.data.type)) {
    return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
  }
  const origin = isStaff(user) ? (parsed.data.origin ?? "admin_report") : "portal";
  if (!isStaff(user) && parsed.data.origin === "admin_report") {
    return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  }
  const title = ticketTitleFromFields(parsed.data.type, parsed.data.title, fieldsParsed.data);
  try {
    const project = await getAccessibleProject(user, parsed.data.projectId);
    const row = await query<TicketRow>(
      `INSERT INTO tickets (project_id, type, title, fields, stage, origin, created_by_user_id)
       VALUES ($1,$2,$3,$4::jsonb,'fix',$5,$6)
       RETURNING *`,
      [
        parsed.data.projectId,
        parsed.data.type,
        title,
        JSON.stringify(fieldsParsed.data),
        origin,
        user.id,
      ]
    );
    const ticket = row.rows[0];
    await insertEvent(String(ticket.id), user.id, null, "fix", "open");
    await writeAudit(user.id, "ticket_create", "ticket", String(ticket.id), parsed.data.type);
    if (isStaff(user)) {
      await notifyTicketClients("opened_client", {
        projectId: parsed.data.projectId,
        clientId: project.client_id,
        ticketId: String(ticket.id),
        title,
        projectName: String(project.name ?? ""),
        excludeUserId: user.id,
      });
    } else {
      await notifyTicketStaff(
        "opened_staff",
        {
          id: String(ticket.id),
          title,
          projectName: String(project.name ?? ""),
        },
        user.id
      );
    }
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await getTicketRow(user, String(ticket.id));
    return res.status(201).json({
      ticket: await toTicketDto(full ?? ticket),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:create]");
  }
});

v2TicketsRouter.patch("/:id/content", requireAuth, createLimiter, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = contentSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const fieldsParsed = parseFields(parsed.data.type, parsed.data.fields ?? {});
  if (!fieldsParsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const user = req.user!;
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    if (!isTicketAuthor(existing, user.id)) {
      return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
    }
    if (!isStaff(user) && !clientMaySetTicketType(parsed.data.type, String(existing.type))) {
      return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
    }
    const eventsMap = await loadEvents([id.data]);
    const events = eventsMap.get(id.data) ?? [];
    if (!ticketContentEditable(String(existing.stage), events)) {
      return sendError(
        res,
        409,
        "CONFLICT",
        "Só é possível editar um chamado que ainda não foi iniciado."
      );
    }
    const title = ticketTitleFromFields(parsed.data.type, parsed.data.title, fieldsParsed.data);
    await query(
      `UPDATE tickets
       SET type = $2, title = $3, fields = $4::jsonb, updated_at = NOW()
       WHERE id = $1`,
      [id.data, parsed.data.type, title, JSON.stringify(fieldsParsed.data)]
    );
    await writeAudit(user.id, "ticket_update", "ticket", id.data, parsed.data.type);
    const project = await getAccessibleProject(user, String(existing.project_id));
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await getTicketRow(user, id.data);
    return res.json({ ticket: await toTicketDto(full!) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:content]");
  }
});

v2TicketsRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    stage: z.enum(STAGES),
    note: z.string().trim().max(2000).optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const existing = await getTicketRow(req.user!, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const from = String(existing.stage);
    if (!canMoveStage(from, parsed.data.stage)) {
      return sendError(res, 409, "CONFLICT", "Transição inválida.");
    }
    await query(
      `UPDATE tickets SET stage = $2, updated_at = NOW() WHERE id = $1`,
      [id.data, parsed.data.stage]
    );
    await insertEvent(id.data, req.user!.id, from, parsed.data.stage, parsed.data.note);
    await writeAudit(req.user!.id, "ticket_stage", "ticket", id.data, parsed.data.stage);
    const project = await getAccessibleProject(req.user!, String(existing.project_id));
    const stageKind = parsed.data.stage as TicketEmailKind;
    await notifyTicketClients(stageKind, {
      projectId: String(existing.project_id),
      clientId: project.client_id,
      ticketId: id.data,
      title: String(existing.title),
      projectName: String(existing.project_name ?? project.name ?? ""),
      excludeUserId: req.user!.id,
      note: parsed.data.note || undefined,
    });
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    const full = await getTicketRow(req.user!, id.data);
    return res.json({ ticket: await toTicketDto(full!) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:patch]");
  }
});

v2TicketsRouter.post("/:id/confirm", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const user = req.user!;
  if (isStaff(user)) return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    if (String(existing.stage) !== "resolved") {
      return sendError(res, 409, "CONFLICT", "Só é possível confirmar um chamado resolvido.");
    }
    await query(
      `UPDATE tickets
       SET stage = 'closed', client_confirmed_at = NOW(), client_confirmed_by = $2, updated_at = NOW()
       WHERE id = $1`,
      [id.data, user.id]
    );
    await insertEvent(id.data, user.id, "resolved", "closed", "confirm");
    await writeAudit(user.id, "ticket_confirm", "ticket", id.data);
    await notifyTicketStaff(
      "closed",
      {
        id: id.data,
        title: String(existing.title),
        projectName: String(existing.project_name ?? ""),
      },
      user.id
    );
    const project = await getAccessibleProject(user, String(existing.project_id));
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await getTicketRow(user, id.data);
    return res.json({ ticket: await toTicketDto(full!) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:confirm]");
  }
});

v2TicketsRouter.post("/:id/reopen", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    note: z.string().trim().max(2000).optional().default(""),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const user = req.user!;
  if (!isStaff(user) && !parsed.data.note) {
    return sendError(res, 400, "VALIDATION", "Explique o que ainda não está ok.");
  }
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    if (String(existing.stage) !== "resolved") {
      return sendError(res, 409, "CONFLICT", "Só é possível reabrir um chamado resolvido.");
    }
    await query(
      `UPDATE tickets SET stage = 'fix', updated_at = NOW() WHERE id = $1`,
      [id.data]
    );
    await insertEvent(id.data, user.id, "resolved", "fix", parsed.data.note || "reopen");
    await writeAudit(user.id, "ticket_reopen", "ticket", id.data);
    if (isStaff(user)) {
      const project = await getAccessibleProject(user, String(existing.project_id));
      await notifyTicketClients("reopened", {
        projectId: String(existing.project_id),
        clientId: project.client_id,
        ticketId: id.data,
        title: String(existing.title),
        projectName: String(existing.project_name ?? project.name ?? ""),
        excludeUserId: user.id,
        note: parsed.data.note || undefined,
      });
    } else {
      await notifyTicketStaff(
        "reopened",
        {
          id: id.data,
          title: String(existing.title),
          projectName: String(existing.project_name ?? ""),
        },
        user.id,
        parsed.data.note || undefined
      );
    }
    const project = await getAccessibleProject(user, String(existing.project_id));
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await getTicketRow(user, id.data);
    return res.json({ ticket: await toTicketDto(full!) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:reopen]");
  }
});

v2TicketsRouter.post("/:id/messages", requireAuth, messageLimiter, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    body: z.string().trim().min(1).max(4000),
    waitForUserId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const user = req.user!;
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    if (String(existing.stage) === "closed") {
      return sendError(res, 409, "CONFLICT", "Chamado encerrado.");
    }
    const project = await getAccessibleProject(user, String(existing.project_id));
    const staff = isStaff(user);
    const kind = staff ? "request" : "reply";
    let waitFor: string | null = null;
    if (staff) {
      const requested = parsed.data.waitForUserId;
      if (requested) {
        const ok = await eligibleClientUser(requested, String(existing.project_id), project.client_id);
        if (!ok) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
        waitFor = requested;
      } else {
        waitFor = await defaultWaitForUserId(
          String(existing.project_id),
          project.client_id,
          existing.created_by_user_id ? String(existing.created_by_user_id) : null
        );
        if (!waitFor) {
          return sendError(res, 400, "VALIDATION", "Não há usuário cliente neste projeto.");
        }
      }
    }

    await query(
      `INSERT INTO ticket_messages (ticket_id, actor_id, kind, body)
       VALUES ($1,$2,$3,$4)`,
      [id.data, user.id, kind, parsed.data.body]
    );
    if (staff) {
      await query(
        `UPDATE tickets SET awaiting_reply_from_user_id = $2, updated_at = NOW() WHERE id = $1`,
        [id.data, waitFor]
      );
    } else {
      await query(
        `UPDATE tickets SET awaiting_reply_from_user_id = NULL, updated_at = NOW() WHERE id = $1`,
        [id.data]
      );
    }
    await writeAudit(user.id, "ticket_message", "ticket", id.data, kind);

    const ticketMeta = {
      id: id.data,
      title: String(existing.title),
      projectName: String(existing.project_name ?? project.name ?? ""),
    };
    if (staff && waitFor) {
      const mail = ticketStageEmail({
        kind: "info_requested",
        ticketTitle: ticketMeta.title,
        projectName: ticketMeta.projectName,
        note: parsed.data.body,
        ctaUrl: `${env.webOrigin}/client/chamados`,
      });
      await notifyUsers({
        userIds: [waitFor],
        clientId: project.client_id,
        title: mail.title,
        body: mail.body,
        href: "/client/chamados",
        excludeUserId: user.id,
        email: mail,
        relatedTicketId: id.data,
      });
    } else if (!staff) {
      await notifyTicketStaff("info_replied", ticketMeta, user.id, parsed.data.body);
    }

    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await dtoForTicket(user, id.data);
    return res.status(201).json({ ticket: full });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:messages]");
  }
});

v2TicketsRouter.post("/:id/attachments", requireAuth, attachLimiter, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    name: z.string().trim().min(1).max(200),
    mime: z.string().trim().max(80),
    contentBase64: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const mime = normalizeImageMime(parsed.data.mime);
  const ext = path.extname(parsed.data.name).toLowerCase();
  if (!TICKET_IMAGE_MIME.has(mime) || (ext && !TICKET_IMAGE_EXT.has(ext))) {
    return sendError(res, 400, "VALIDATION", "Envie PNG, JPG ou WebP.");
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(parsed.data.contentBase64, "base64");
  } catch {
    return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  }
  if (!buf.length) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  if (buf.length > MAX_TICKET_IMAGE_BYTES) {
    return sendError(res, 400, "VALIDATION", "Imagem excede 2 MB.");
  }
  const sniffed = detectImageMagic(buf);
  if (!sniffed || sniffed !== mime) {
    return sendError(res, 400, "VALIDATION", "Envie PNG, JPG ou WebP.");
  }
  const user = req.user!;
  try {
    const existing = await getTicketRow(user, id.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");

    const client = await pool.connect();
    let attId = "";
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        `SELECT id FROM tickets WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id.data]
      );
      if (!locked.rowCount) {
        await client.query("ROLLBACK");
        return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      }
      const counted = await client.query<{ n: number }>(
        `SELECT COUNT(*)::int AS n FROM ticket_attachments WHERE ticket_id = $1`,
        [id.data]
      );
      if ((counted.rows[0]?.n ?? 0) >= MAX_TICKET_ATTACHMENTS) {
        await client.query("ROLLBACK");
        return sendError(res, 409, "CONFLICT", "No máximo 4 imagens por chamado.");
      }
      const ins = await client.query<{ id: string }>(
        `INSERT INTO ticket_attachments
           (ticket_id, original_name, stored_name, mime, size_bytes, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id`,
        [id.data, safeOriginalName(parsed.data.name), "pending", mime, buf.length, user.id]
      );
      attId = ins.rows[0].id;
      const dir = storageRoot();
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, attId), buf);
      await client.query(`UPDATE ticket_attachments SET stored_name = $2 WHERE id = $1`, [
        attId,
        attId,
      ]);
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      if (attId) {
        try {
          await fs.unlink(path.join(storageRoot(), attId));
        } catch {
          /* ignore */
        }
      }
      throw err;
    } finally {
      client.release();
    }

    await writeAudit(user.id, "ticket_attach", "ticket", id.data, attId);
    const project = await getAccessibleProject(user, String(existing.project_id));
    publishLive({
      reason: "ticket",
      clientId: project.client_id,
      actorId: user.id,
    });
    const full = await getTicketRow(user, id.data);
    return res.status(201).json({ ticket: await toTicketDto(full!) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:attach]");
  }
});

v2TicketsRouter.get("/:id/attachments/:attId/download", requireAuth, async (req, res) => {
  const ticketId = uuid.safeParse(req.params.id);
  const attId = uuid.safeParse(req.params.attId);
  if (!ticketId.success || !attId.success) {
    return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  }
  try {
    const existing = await getTicketRow(req.user!, ticketId.data);
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const row = await query<{
      original_name: string;
      stored_name: string;
      mime: string;
    }>(
      `SELECT original_name, stored_name, mime
       FROM ticket_attachments
       WHERE id = $1 AND ticket_id = $2`,
      [attId.data, ticketId.data]
    );
    const att = row.rows[0];
    if (!att) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const mime = normalizeImageMime(att.mime);
    if (!TICKET_IMAGE_MIME.has(mime)) {
      return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    }
    const stored = att.stored_name;
    if (!/^[0-9a-f-]{36}$/i.test(stored)) {
      return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    }
    const root = storageRoot();
    const abs = path.join(root, stored);
    if (!abs.startsWith(root)) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const data = await fs.readFile(abs);
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeOriginalName(att.original_name)}"`
    );
    return res.send(data);
  } catch (err) {
    return handleRouteError(res, err, "[v2/tickets:attach-download]");
  }
});
