import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { bindClientFilter, getAccessibleProject, isStaff } from "../lib/access.js";
import { writeAudit } from "../lib/audit.js";
import { handleRouteError, sendError } from "../lib/http.js";
import { env } from "../lib/env.js";
import { fromUiRole, sessionDto } from "../lib/dto.js";
import { sendWelcomeEmail } from "../lib/notify.js";
import {
  dtoMemberships,
  MembershipError,
  membershipsFromBody,
  replaceMemberships,
} from "../lib/memberships.js";
import { setActiveClientCookie } from "../lib/auth.js";
import { isSafePushHref } from "../lib/push-href.js";
import { sendWebPush } from "../lib/push.js";
import { serializeProject } from "./projects-updates.js";
import { listTicketsDto } from "./tickets.js";
import { publishLive } from "../lib/live.js";
import {
  ALLOWED_EXT,
  ALLOWED_MIME,
  MAX_FILE_BYTES,
  safeOriginalName,
  storageRoot,
} from "../lib/storage.js";
import {
  displayFileCategoryLabel,
  normalizeStoredFileCategory,
  resolveWriteCategory,
} from "../lib/file-category.js";
import type { AuthUser } from "../types/index.js";
import { cnpjOrNull, isPgUniqueViolation, onlyDigits } from "../lib/br-contact.js";
import { lookupCnpj } from "../lib/cnpj-lookup.js";

const uuid = z.string().uuid();

const LAST_ADMIN_PATCH_MSG =
  "Não é possível desativar ou rebaixar o último administrador ativo.";
const LAST_ADMIN_DELETE_MSG = "Não é possível excluir o último administrador.";

async function remainingAdminCount(excludeId: string, onlyActive: boolean): Promise<number> {
  const sql = onlyActive
    ? `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND active = TRUE AND id <> $1`
    : `SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND id <> $1`;
  const row = await query<{ n: number }>(sql, [excludeId]);
  return Number(row.rows[0]?.n ?? 0);
}

function isEnoent(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code: string }).code === "ENOENT"
  );
}

export const v2ClientsRouter = Router();

const cnpjLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyGenerator: (req) => String(req.user?.id ?? "anon"),
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas consultas de CNPJ. Tente mais tarde." } },
});

function validationMessage(parsed: { success: false; error: { issues: { message: string }[] } }): string {
  return parsed.error.issues[0]?.message || "Dados inválidos.";
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const phoneSchema = z
  .string()
  .transform((s) => onlyDigits(s))
  .refine((d) => d.length >= 10 && d.length <= 13, { message: "Informe um telefone válido." });

const cnpjSchema = z
  .string()
  .transform((s) => onlyDigits(s))
  .refine((d) => d.length === 0 || d.length === 14, { message: "CNPJ deve ter 14 dígitos." });

const clientCreateSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(200),
  contactEmail: z.string().trim().email("E-mail inválido.").max(320),
  phone: phoneSchema,
  whatsapp: phoneSchema,
  company: z.string().trim().max(200).optional().default(""),
  segment: z.string().trim().max(120).optional().default(""),
  cnpj: cnpjSchema.optional().default(""),
  notes: z.string().trim().max(2000).optional().default(""),
});

const clientStaffPatchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  contactEmail: z.string().trim().email("E-mail inválido.").max(320).optional(),
  phone: phoneSchema.optional(),
  whatsapp: phoneSchema.optional(),
  company: z.string().trim().max(200).optional(),
  segment: z.string().trim().max(120).optional(),
  cnpj: cnpjSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
});

function serializeClient(c: Record<string, unknown>) {
  const phone = String(c.phone ?? "");
  const primary = phone || String(c.primary_contact ?? "");
  return {
    id: c.id,
    name: c.name,
    company: c.company ?? "",
    segment: c.segment ?? "",
    logoInitials:
      c.logo_initials ||
      initialsFromName(String(c.name ?? "")),
    primaryContact: primary,
    cnpj: c.cnpj ?? "",
    contactEmail: c.contact_email ?? "",
    phone,
    whatsapp: c.whatsapp ?? "",
    notes: c.notes ?? "",
    createdAt: c.created_at,
  };
}

v2ClientsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    if (isStaff(user)) {
      const rows = await query(`SELECT * FROM clients ORDER BY name ASC`);
      return res.json({ clients: rows.rows.map(serializeClient) });
    }
    if (!user.client_ids?.length) return res.json({ clients: [] });
    const rows = await query(`SELECT * FROM clients WHERE id = ANY($1::uuid[]) ORDER BY name ASC`, [
      user.client_ids,
    ]);
    return res.json({ clients: rows.rows.map(serializeClient) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/clients]");
  }
});

v2ClientsRouter.get("/cnpj/:cnpj", requireAuth, cnpjLimiter, async (req, res) => {
  const digits = onlyDigits(String(req.params.cnpj ?? ""));
  if (digits.length !== 14) {
    return sendError(res, 400, "VALIDATION", "CNPJ deve ter 14 dígitos.");
  }
  try {
    const found = await lookupCnpj(digits);
    if (!found) return sendError(res, 404, "NOT_FOUND", "CNPJ não encontrado.");
    return res.json(found);
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    if (aborted || (err instanceof Error && err.message === "cnpj_upstream")) {
      return sendError(res, 502, "UPSTREAM", "Não foi possível consultar o CNPJ.");
    }
    return handleRouteError(res, err, "[v2/clients:cnpj]");
  }
});

v2ClientsRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = clientCreateSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", validationMessage(parsed));
  try {
    const initials = initialsFromName(parsed.data.name);
    const cnpj = cnpjOrNull(parsed.data.cnpj);
    const row = await query(
      `INSERT INTO clients (
         name, company, segment, primary_contact, logo_initials,
         cnpj, contact_email, phone, whatsapp, notes
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        parsed.data.name,
        parsed.data.company,
        parsed.data.segment,
        parsed.data.phone,
        initials,
        cnpj,
        parsed.data.contactEmail.toLowerCase(),
        parsed.data.phone,
        parsed.data.whatsapp,
        parsed.data.notes,
      ]
    );
    await writeAudit(req.user!.id, "create_client", "client", row.rows[0].id);
    return res.status(201).json({ client: serializeClient(row.rows[0]) });
  } catch (err) {
    if (isPgUniqueViolation(err, "idx_clients_cnpj_unique")) {
      return sendError(res, 400, "VALIDATION", "Este CNPJ já está cadastrado.");
    }
    return handleRouteError(res, err, "[v2/clients:create]");
  }
});

v2ClientsRouter.patch("/:id", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const user = req.user!;
  if (!isStaff(user)) {
    return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
  }

  const parsed = clientStaffPatchSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", validationMessage(parsed));

  const data = parsed.data;
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 2;

  const push = (column: string, value: unknown) => {
    sets.push(`${column} = $${i++}`);
    values.push(value);
  };

  if (data.name !== undefined) {
    push("name", data.name);
    push("logo_initials", initialsFromName(data.name));
  }
  if (data.company !== undefined) push("company", data.company);
  if (data.segment !== undefined) push("segment", data.segment);
  if (data.contactEmail !== undefined) push("contact_email", data.contactEmail.toLowerCase());
  if (data.phone !== undefined) {
    push("phone", data.phone);
    push("primary_contact", data.phone);
  }
  if (data.whatsapp !== undefined) push("whatsapp", data.whatsapp);
  if (data.cnpj !== undefined) push("cnpj", cnpjOrNull(data.cnpj));
  if (data.notes !== undefined) push("notes", data.notes);

  try {
    if (sets.length === 0) {
      const current = await query(`SELECT * FROM clients WHERE id = $1`, [id.data]);
      if (!current.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      return res.json({ client: serializeClient(current.rows[0]) });
    }
    const row = await query(
      `UPDATE clients SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      [id.data, ...values]
    );
    if (!row.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await writeAudit(user.id, "update_client", "client", id.data);
    return res.json({ client: serializeClient(row.rows[0]) });
  } catch (err) {
    if (isPgUniqueViolation(err, "idx_clients_cnpj_unique")) {
      return sendError(res, 400, "VALIDATION", "Este CNPJ já está cadastrado.");
    }
    return handleRouteError(res, err, "[v2/clients:patch]");
  }
});

export const v2UsersRouter = Router();

function serializeUser(
  u: Record<string, unknown>,
  projectIds: string[],
  memberships: ReturnType<typeof dtoMemberships> = []
) {
  const role = fromUiRole(String(u.role)) ?? "client";
  const accessAll =
    memberships.length > 0
      ? memberships.every((m) => m.accessAllProjects)
      : u.access_all_projects !== false;
  return {
    id: u.id,
    email: u.email,
    name: u.name || "",
    role: role === "admin" ? "ADMIN" : role === "manager" ? "MANAGER" : "CLIENT",
    clientId: u.client_id,
    clientIds: memberships.map((m) => m.clientId),
    memberships,
    avatarInitials: u.avatar_initials || "U",
    active: u.active !== false,
    title: u.title ?? "",
    mustCompleteProfile: Boolean(u.must_complete_profile),
    instagramCompany: u.instagram_company,
    instagramPersonal: u.instagram_personal,
    profileCompletedAt: u.profile_completed_at,
    projectIds,
    accessAllProjects: accessAll,
  };
}

async function loadProjectClientMap(projectIds: string[]): Promise<Map<string, string>> {
  if (projectIds.length === 0) return new Map();
  const rows = await query<{ id: string; client_id: string }>(
    `SELECT id, client_id FROM projects WHERE id = ANY($1::uuid[])`,
    [projectIds]
  );
  return new Map(rows.rows.map((p) => [p.id, p.client_id]));
}

async function serializeUserById(id: string) {
  const row = await query(`SELECT * FROM users WHERE id = $1`, [id]);
  if (!row.rows[0]) return null;
  const acc = await query<{ project_id: string }>(
    `SELECT project_id FROM user_project_access WHERE user_id = $1`,
    [id]
  );
  const mem = await query<{ client_id: string; access_all_projects: boolean }>(
    `SELECT m.client_id, m.access_all_projects
     FROM user_client_access m
     INNER JOIN clients c ON c.id = m.client_id
     WHERE m.user_id = $1
     ORDER BY c.name ASC`,
    [id]
  );
  const projectIds = acc.rows.map((r) => r.project_id);
  const pmap = await loadProjectClientMap(projectIds);
  return serializeUser(row.rows[0], projectIds, dtoMemberships(mem.rows, projectIds, pmap));
}

const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

const welcomeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

const passwordSchema = z.object({
  password: z.string().min(8).max(200),
});

v2UsersRouter.get("/", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const users = await query(`SELECT * FROM users ORDER BY email`);
    const access = await query<{ user_id: string; project_id: string }>(
      `SELECT user_id, project_id FROM user_project_access`
    );
    const mems = await query<{ user_id: string; client_id: string; access_all_projects: boolean }>(
      `SELECT user_id, client_id, access_all_projects FROM user_client_access`
    );
    const map = new Map<string, string[]>();
    for (const a of access.rows) {
      const list = map.get(a.user_id) ?? [];
      list.push(a.project_id);
      map.set(a.user_id, list);
    }
    const memMap = new Map<string, { client_id: string; access_all_projects: boolean }[]>();
    for (const m of mems.rows) {
      const list = memMap.get(m.user_id) ?? [];
      list.push({ client_id: m.client_id, access_all_projects: m.access_all_projects });
      memMap.set(m.user_id, list);
    }
    const allPids = access.rows.map((a) => a.project_id);
    const pmap = await loadProjectClientMap(allPids);
    return res.json({
      users: users.rows.map((u) => {
        const pids = map.get(u.id as string) ?? [];
        return serializeUser(
          u,
          pids,
          dtoMemberships(memMap.get(u.id as string) ?? [], pids, pmap)
        );
      }),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/users]");
  }
});

v2UsersRouter.get("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const user = await serializeUserById(id.data);
    if (!user) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    return res.json({ user });
  } catch (err) {
    return handleRouteError(res, err, "[v2/users:get]");
  }
});

const userSchema = z.object({
  email: z.string().email().max(320),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["ADMIN", "MANAGER", "CLIENT", "admin", "manager", "client"]),
  clientId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  accessAllProjects: z.boolean().optional(),
  projectIds: z.array(z.string().uuid()).optional(),
  memberships: z
    .array(
      z.object({
        clientId: z.string().uuid(),
        accessAllProjects: z.boolean().optional(),
        projectIds: z.array(z.string().uuid()).optional(),
      })
    )
    .max(50)
    .optional(),
});

v2UsersRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = userSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const role = fromUiRole(parsed.data.role);
  if (!role) return sendError(res, 400, "VALIDATION", "Papel inválido.");
  const memberships = role === "client" ? membershipsFromBody(parsed.data) : [];
  if (role === "client" && (!memberships || memberships.length === 0)) {
    return sendError(res, 400, "VALIDATION", "Vincule o usuário a uma empresa.");
  }
  try {
    const email = parsed.data.email.toLowerCase().trim();
    const exists = await query(`SELECT id FROM users WHERE lower(email) = $1`, [email]);
    if (exists.rows[0]) return sendError(res, 400, "VALIDATION", "E-mail já cadastrado.");
    const hash = await bcrypt.hash(env.seedPassword, 12);
    const firstClient = role === "client" ? memberships![0].clientId : null;
    const ins = await query(
      `INSERT INTO users (email, password_hash, role, client_id, name, must_complete_profile, access_all_projects, active, avatar_initials)
       VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8) RETURNING *`,
      [
        email,
        hash,
        role,
        firstClient,
        parsed.data.name,
        role === "client",
        true,
        parsed.data.name.slice(0, 2).toUpperCase(),
      ]
    );
    const user = ins.rows[0];
    await replaceMemberships(String(user.id), role, memberships, firstClient);
    await writeAudit(req.user!.id, "create_user", "user", user.id as string);
    await sendWelcomeEmail({
      userId: String(user.id),
      name: parsed.data.name,
      clientId: firstClient,
    });
    const dto = await serializeUserById(String(user.id));
    return res.status(201).json({
      user: dto,
      tempPassword: env.seedPassword,
    });
  } catch (err) {
    if (err instanceof MembershipError) {
      return sendError(res, 400, "VALIDATION", err.message);
    }
    return handleRouteError(res, err, "[v2/users:create]");
  }
});

v2UsersRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = userSchema.partial().safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const current = await query(`SELECT * FROM users WHERE id = $1`, [id.data]);
    const existing = current.rows[0];
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");

    const nextRole = parsed.data.role
      ? fromUiRole(parsed.data.role)
      : fromUiRole(String(existing.role));
    if (!nextRole) return sendError(res, 400, "VALIDATION", "Papel inválido.");

    const clientIdInBody = Object.prototype.hasOwnProperty.call(parsed.data, "clientId");
    const membershipsInBody = Object.prototype.hasOwnProperty.call(parsed.data, "memberships");
    const nextMemberships =
      nextRole === "client"
        ? membershipsInBody || clientIdInBody || parsed.data.projectIds || parsed.data.accessAllProjects !== undefined
          ? membershipsFromBody({
              memberships: parsed.data.memberships,
              clientId: clientIdInBody ? parsed.data.clientId : (existing.client_id as string | null),
              accessAllProjects: parsed.data.accessAllProjects,
              projectIds: parsed.data.projectIds,
            })
          : null
        : [];

    if (nextRole === "client" && nextMemberships && nextMemberships.length === 0) {
      return sendError(res, 400, "VALIDATION", "Vincule o usuário a uma empresa.");
    }

    const prevEmail = String(existing.email).toLowerCase().trim();
    let nextEmail = prevEmail;
    if (parsed.data.email) {
      nextEmail = parsed.data.email.toLowerCase().trim();
      const dup = await query(`SELECT id FROM users WHERE lower(email) = $1 AND id <> $2`, [
        nextEmail,
        id.data,
      ]);
      if (dup.rows[0]) return sendError(res, 400, "VALIDATION", "E-mail já cadastrado.");
    }
    const emailChanged = nextEmail !== prevEmail;

    const nextInitials = parsed.data.name ? parsed.data.name.slice(0, 2).toUpperCase() : null;
    const nextActive = parsed.data.active ?? Boolean(existing.active);
    if (
      String(existing.role) === "admin" &&
      Boolean(existing.active) &&
      (nextActive === false || nextRole !== "admin")
    ) {
      const n = await remainingAdminCount(id.data, true);
      if (n === 0) {
        return sendError(res, 409, "CONFLICT", LAST_ADMIN_PATCH_MSG);
      }
    }

    let nextClientId = (existing.client_id as string | null) ?? null;
    let nextAccessAll = Boolean(existing.access_all_projects);
    if (nextRole !== "client") {
      const cleared = await replaceMemberships(id.data, nextRole, [], null);
      nextClientId = cleared.clientId;
      nextAccessAll = cleared.accessAll;
    } else if (nextMemberships) {
      if (nextMemberships.length === 0) {
        return sendError(res, 400, "VALIDATION", "Vincule o usuário a uma empresa.");
      }
      const applied = await replaceMemberships(
        id.data,
        nextRole,
        nextMemberships,
        nextClientId
      );
      nextClientId = applied.clientId;
      nextAccessAll = applied.accessAll;
    } else if (String(existing.role) !== "client") {
      return sendError(res, 400, "VALIDATION", "Vincule o usuário a uma empresa.");
    }

    await query(
      `UPDATE users SET
         name = COALESCE($2, name),
         active = COALESCE($3, active),
         role = $4,
         client_id = $5,
         access_all_projects = $6,
         email = $7,
         avatar_initials = COALESCE($8, avatar_initials)
       WHERE id = $1`,
      [
        id.data,
        parsed.data.name ?? null,
        parsed.data.active ?? null,
        nextRole,
        nextClientId,
        nextAccessAll,
        nextEmail,
        nextInitials,
      ]
    );
    const user = await serializeUserById(id.data);
    if (!user) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await writeAudit(req.user!.id, "update_user", "user", id.data);
    if (nextRole === "client" && emailChanged) {
      await sendWelcomeEmail({
        userId: id.data,
        name: String(parsed.data.name ?? existing.name ?? ""),
        clientId: nextClientId,
      });
    }
    return res.json({ user });
  } catch (err) {
    if (err instanceof MembershipError) {
      return sendError(res, 400, "VALIDATION", err.message);
    }
    return handleRouteError(res, err, "[v2/users:patch]");
  }
});

v2UsersRouter.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const current = await query<{ id: string; role: string }>(
      `SELECT id, role FROM users WHERE id = $1`,
      [id.data]
    );
    const existing = current.rows[0];
    if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    if (req.user!.id === id.data) {
      return sendError(res, 400, "VALIDATION", "Você não pode excluir a própria conta.");
    }
    if (req.user!.role === "manager" && existing.role === "admin") {
      return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
    }
    if (existing.role === "admin") {
      const n = await remainingAdminCount(id.data, false);
      if (n === 0) {
        return sendError(res, 409, "CONFLICT", LAST_ADMIN_DELETE_MSG);
      }
    }
    await query(`DELETE FROM users WHERE id = $1`, [id.data]);
    await writeAudit(req.user!.id, "delete_user", "user", id.data);
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/users:delete]");
  }
});

v2UsersRouter.post(
  "/:id/password",
  requireAuth,
  requireRole("admin", "manager"),
  passwordLimiter,
  async (req, res) => {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
    try {
      const current = await query(`SELECT id FROM users WHERE id = $1`, [id.data]);
      if (!current.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      const hash = await bcrypt.hash(parsed.data.password, 12);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hash, id.data]);
      await writeAudit(req.user!.id, "password_set_by_admin", "user", id.data);
      const user = await serializeUserById(id.data);
      if (!user) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      return res.json({ user });
    } catch (err) {
      return handleRouteError(res, err, "[v2/users:password]");
    }
  }
);

v2UsersRouter.post(
  "/:id/welcome",
  requireAuth,
  requireRole("admin", "manager"),
  welcomeLimiter,
  async (req, res) => {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    try {
      const current = await query<{
        id: string;
        name: string;
        client_id: string | null;
        active: boolean;
      }>(`SELECT id, name, client_id, active FROM users WHERE id = $1`, [id.data]);
      const existing = current.rows[0];
      if (!existing) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
      if (!existing.active) {
        return sendError(res, 409, "CONFLICT", "Ative a conta para enviar o e-mail.");
      }
      const result = await sendWelcomeEmail({
        userId: id.data,
        name: String(existing.name ?? ""),
        clientId: existing.client_id,
      });
      await writeAudit(req.user!.id, "send_welcome_email", "user", id.data);
      return res.json({ welcomeEmail: result.status });
    } catch (err) {
      return handleRouteError(res, err, "[v2/users:welcome]");
    }
  }
);

export const v2TasksRouter = Router();

v2TasksRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const params = [...f.params];
    let extra = "";
    if (projectId) {
      await getAccessibleProject(user, projectId);
      params.push(projectId);
      extra = ` AND t.project_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT t.* FROM tasks t
       INNER JOIN projects p ON p.id = t.project_id
       WHERE ${f.sql}${extra}
       ORDER BY t.updated_at DESC`,
      params
    );
    return res.json({
      tasks: rows.rows.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee_name,
        updatedAt: t.updated_at,
      })),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tasks]");
  }
});

v2TasksRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const schema = z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().max(4000).optional().default(""),
    status: z.enum(["backlog", "todo", "doing", "review", "done"]).optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    assigneeName: z.string().max(120).optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    await getAccessibleProject(req.user!, parsed.data.projectId);
    const row = await query(
      `INSERT INTO tasks (project_id, title, description, status, priority, assignee_name)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        parsed.data.projectId,
        parsed.data.title,
        parsed.data.description,
        parsed.data.status ?? "todo",
        parsed.data.priority ?? "medium",
        parsed.data.assigneeName,
      ]
    );
    const t = row.rows[0];
    return res.status(201).json({
      task: {
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee_name,
        updatedAt: t.updated_at,
      },
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tasks:create]");
  }
});

v2TasksRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    status: z.enum(["backlog", "todo", "doing", "review", "done"]).optional(),
    title: z.string().trim().min(1).max(200).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const existing = await query<{ project_id: string }>(`SELECT project_id FROM tasks WHERE id = $1`, [
      id.data,
    ]);
    if (!existing.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, existing.rows[0].project_id);
    const row = await query(
      `UPDATE tasks SET status = COALESCE($2, status), title = COALESCE($3, title), updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id.data, parsed.data.status ?? null, parsed.data.title ?? null]
    );
    const t = row.rows[0];
    await writeAudit(req.user!.id, "move_task", "task", id.data, parsed.data.status ?? "");
    return res.json({
      task: {
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee_name,
        updatedAt: t.updated_at,
      },
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/tasks:patch]");
  }
});

export const v2NotificationsRouter = Router();

v2NotificationsRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const schema = z.object({
    userId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(2000),
    href: z
      .string()
      .max(300)
      .optional()
      .default("/client")
      .transform((v) => (v.trim() === "" ? "/client" : v.trim()))
      .refine(isSafePushHref),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const target = await query<{ id: string; client_id: string | null }>(
      `SELECT id, client_id FROM users WHERE id = $1`,
      [parsed.data.userId]
    );
    if (!target.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const row = await query(
      `INSERT INTO notifications (user_id, client_id, title, body, href)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [parsed.data.userId, target.rows[0].client_id, parsed.data.title, parsed.data.body, parsed.data.href]
    );
    const n = row.rows[0];
    await sendWebPush(parsed.data.userId, {
      title: parsed.data.title,
      body: parsed.data.body,
      href: parsed.data.href,
      id: n.id,
    });
    return res.status(201).json({
      notification: {
        id: n.id,
        userId: n.user_id,
        clientId: n.client_id,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n.created_at,
      },
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/notifications:create]");
  }
});

v2NotificationsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`,
      [req.user!.id]
    );
    return res.json({
      notifications: rows.rows.map((n) => ({
        id: n.id,
        userId: n.user_id,
        clientId: n.client_id,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n.created_at,
      })),
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/notifications]");
  }
});

v2NotificationsRouter.patch("/:id/read", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const row = await query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id.data, req.user!.id]
    );
    if (!row.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/notifications:read]");
  }
});

v2NotificationsRouter.post("/read-all", requireAuth, async (req, res) => {
  try {
    await query(`UPDATE notifications SET read = TRUE WHERE user_id = $1`, [req.user!.id]);
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/notifications:read-all]");
  }
});

export const v2ReleasesRouter = Router();

function serializeRelease(r: Record<string, unknown>) {
  return {
    id: r.id,
    projectId: r.project_id,
    version: r.version,
    title: r.title,
    notes: r.notes,
    highlights: r.highlights ?? [],
    releasedAt: r.released_at,
  };
}

v2ReleasesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const params = [...f.params];
    let extra = "";
    if (projectId) {
      await getAccessibleProject(user, projectId);
      params.push(projectId);
      extra = ` AND r.project_id = $${params.length}`;
    }
    const rows = await query(
      `SELECT r.* FROM releases r
       INNER JOIN projects p ON p.id = r.project_id
       WHERE ${f.sql}${extra}
       ORDER BY r.released_at DESC`,
      params
    );
    return res.json({ releases: rows.rows.map((r) => serializeRelease(r)) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/releases]");
  }
});

const releaseSchema = z.object({
  projectId: z.string().uuid(),
  version: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(8000).optional().default(""),
  highlights: z.array(z.string().max(200)).optional().default([]),
});

v2ReleasesRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = releaseSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    await getAccessibleProject(req.user!, parsed.data.projectId);
    const row = await query(
      `INSERT INTO releases (project_id, version, title, notes, highlights, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        parsed.data.projectId,
        parsed.data.version,
        parsed.data.title,
        parsed.data.notes,
        parsed.data.highlights,
        req.user!.id,
      ]
    );
    await writeAudit(req.user!.id, "create_release", "release", row.rows[0].id as string);
    return res.status(201).json({ release: serializeRelease(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/releases:create]");
  }
});

v2ReleasesRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = releaseSchema.partial().safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const existing = await query<{ project_id: string }>(`SELECT project_id FROM releases WHERE id = $1`, [
      id.data,
    ]);
    if (!existing.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, existing.rows[0].project_id);
    const row = await query(
      `UPDATE releases SET
         version = COALESCE($2, version),
         title = COALESCE($3, title),
         notes = COALESCE($4, notes),
         highlights = COALESCE($5, highlights)
       WHERE id = $1 RETURNING *`,
      [
        id.data,
        parsed.data.version ?? null,
        parsed.data.title ?? null,
        parsed.data.notes ?? null,
        parsed.data.highlights ?? null,
      ]
    );
    return res.json({ release: serializeRelease(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/releases:patch]");
  }
});

v2ReleasesRouter.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const existing = await query<{ project_id: string }>(`SELECT project_id FROM releases WHERE id = $1`, [
      id.data,
    ]);
    if (!existing.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, existing.rows[0].project_id);
    await query(`DELETE FROM releases WHERE id = $1`, [id.data]);
    await writeAudit(req.user!.id, "delete_release", "release", id.data);
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/releases:delete]");
  }
});

export const v2DocumentsRouter = Router();

async function documentDto(docId: string) {
  const doc = await query(`SELECT * FROM documents WHERE id = $1`, [docId]);
  const versions = await query(
    `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY uploaded_at ASC`,
    [docId]
  );
  const d = doc.rows[0];
  if (!d) return null;
  const latest = versions.rows[versions.rows.length - 1];
  return {
    id: d.id,
    projectId: d.project_id,
    title: d.title,
    version: latest?.version ?? "1.0",
    category: d.category,
    uploadedBy: "",
    uploadedAt: latest?.uploaded_at ?? d.created_at,
    sizeLabel: latest?.size_label ?? "",
    history: versions.rows.map((v) => ({
      version: v.version,
      uploadedAt: v.uploaded_at,
      note: v.note,
      fileId: v.file_id,
    })),
  };
}

v2DocumentsRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const rows = await query(
      `SELECT d.id FROM documents d
       INNER JOIN projects p ON p.id = d.project_id
       WHERE ${f.sql}
       ORDER BY d.created_at DESC`,
      f.params
    );
    const docs = [];
    for (const r of rows.rows) {
      const dto = await documentDto(r.id as string);
      if (dto) docs.push(dto);
    }
    return res.json({ documents: docs });
  } catch (err) {
    return handleRouteError(res, err, "[v2/documents]");
  }
});

v2DocumentsRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const schema = z.object({
    projectId: z.string().uuid(),
    title: z.string().trim().min(1).max(200),
    version: z.string().trim().min(1).max(40).default("1.0"),
    category: z.string().max(80).optional().default("documentação"),
    note: z.string().max(500).optional().default("Versão inicial"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    await getAccessibleProject(req.user!, parsed.data.projectId);
    const doc = await query(
      `INSERT INTO documents (project_id, title, category, created_by) VALUES ($1,$2,$3,$4) RETURNING id`,
      [parsed.data.projectId, parsed.data.title, parsed.data.category, req.user!.id]
    );
    await query(
      `INSERT INTO document_versions (document_id, version, note, uploaded_by, size_label)
       VALUES ($1,$2,$3,$4,$5)`,
      [doc.rows[0].id, parsed.data.version, parsed.data.note, req.user!.id, ""]
    );
    await writeAudit(req.user!.id, "create_document", "document", doc.rows[0].id as string);
    return res.status(201).json({ document: await documentDto(doc.rows[0].id as string) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/documents:create]");
  }
});

v2DocumentsRouter.post("/:id/versions", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const schema = z.object({
    version: z.string().trim().min(1).max(40),
    note: z.string().max(500).optional().default(""),
    fileId: z.string().uuid().optional().nullable(),
    sizeLabel: z.string().max(40).optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const doc = await query<{ project_id: string }>(`SELECT project_id FROM documents WHERE id = $1`, [
      id.data,
    ]);
    if (!doc.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, doc.rows[0].project_id);
    await query(
      `INSERT INTO document_versions (document_id, version, note, file_id, uploaded_by, size_label)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id.data, parsed.data.version, parsed.data.note, parsed.data.fileId ?? null, req.user!.id, parsed.data.sizeLabel]
    );
    return res.status(201).json({ document: await documentDto(id.data) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/documents:version]");
  }
});

v2DocumentsRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = z.object({ title: z.string().trim().min(1).max(200) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const doc = await query<{ project_id: string }>(`SELECT project_id FROM documents WHERE id = $1`, [
      id.data,
    ]);
    if (!doc.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const project = await getAccessibleProject(req.user!, doc.rows[0].project_id);
    await query(`UPDATE documents SET title = $2 WHERE id = $1`, [id.data, parsed.data.title]);
    await writeAudit(req.user!.id, "update_document", "document", id.data);
    publishLive({
      reason: "file",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    return res.json({ document: await documentDto(id.data) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/documents:patch]");
  }
});

v2DocumentsRouter.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const doc = await query<{ project_id: string }>(`SELECT project_id FROM documents WHERE id = $1`, [
      id.data,
    ]);
    if (!doc.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const project = await getAccessibleProject(req.user!, doc.rows[0].project_id);
    await query(`DELETE FROM documents WHERE id = $1`, [id.data]);
    await writeAudit(req.user!.id, "delete_document", "document", id.data);
    publishLive({
      reason: "file",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/documents:delete]");
  }
});

export const v2FilesRouter = Router();

function fileDto(f: Record<string, unknown>) {
  const bytes = Number(f.size_bytes ?? 0);
  const sizeLabel =
    bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  const category = normalizeStoredFileCategory(f.category);
  return {
    id: f.id,
    projectId: f.project_id,
    name: f.original_name,
    category,
    categoryLabel: displayFileCategoryLabel(category, f.category_label),
    sizeLabel,
    uploadedBy: "",
    uploadedAt: f.created_at,
    mime: f.mime,
  };
}

v2FilesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const rows = await query(
      `SELECT fl.* FROM files fl
       INNER JOIN projects p ON p.id = fl.project_id
       WHERE ${f.sql}
       ORDER BY fl.created_at DESC`,
      f.params
    );
    return res.json({ files: rows.rows.map((r) => fileDto(r)) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/files]");
  }
});

v2FilesRouter.post("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const schema = z.object({
    projectId: z.string().uuid(),
    name: z.string().min(1).max(200),
    mime: z.string().max(120).optional().default("application/octet-stream"),
    category: z.string().max(40).optional(),
    categoryLabel: z.string().max(80).optional(),
    contentBase64: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const resolved = resolveWriteCategory({
    category: parsed.data.category,
    categoryLabel: parsed.data.categoryLabel,
  });
  if (!resolved.ok) return sendError(res, 400, "VALIDATION", resolved.message);
  try {
    const project = await getAccessibleProject(req.user!, parsed.data.projectId);
    const ext = path.extname(parsed.data.name).toLowerCase();
    if (ext && !ALLOWED_EXT.has(ext)) {
      return sendError(res, 400, "VALIDATION", "Tipo de arquivo não permitido.");
    }
    if (!ALLOWED_MIME.has(parsed.data.mime) && parsed.data.mime !== "application/octet-stream") {
      return sendError(res, 400, "VALIDATION", "Tipo de arquivo não permitido.");
    }
    const buf = Buffer.from(parsed.data.contentBase64, "base64");
    if (buf.length > MAX_FILE_BYTES) {
      return sendError(res, 400, "VALIDATION", "Arquivo excede 10 MB.");
    }
    const ins = await query<{ id: string }>(
      `INSERT INTO files (project_id, original_name, stored_name, mime, category, category_label, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        parsed.data.projectId,
        safeOriginalName(parsed.data.name),
        "pending",
        parsed.data.mime,
        resolved.category,
        resolved.categoryLabel,
        buf.length,
        req.user!.id,
      ]
    );
    const id = ins.rows[0].id;
    const dir = storageRoot();
    await fs.mkdir(dir, { recursive: true });
    const stored = id;
    await fs.writeFile(path.join(dir, stored), buf);
    await query(`UPDATE files SET stored_name = $2 WHERE id = $1`, [id, stored]);
    const row = await query(`SELECT * FROM files WHERE id = $1`, [id]);
    await writeAudit(req.user!.id, "upload_file", "file", id);
    publishLive({
      reason: "file",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    return res.status(201).json({ file: fileDto(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/files:create]");
  }
});

const filePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    category: z.string().max(40).optional(),
    categoryLabel: z.string().max(80).optional(),
  })
  .refine((d) => d.name !== undefined || d.category !== undefined || d.categoryLabel !== undefined);

v2FilesRouter.patch("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  const parsed = filePatchSchema.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    const existing = await query(`SELECT * FROM files WHERE id = $1`, [id.data]);
    if (!existing.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const project = await getAccessibleProject(req.user!, existing.rows[0].project_id as string);
    const nextName =
      parsed.data.name !== undefined
        ? safeOriginalName(parsed.data.name)
        : String(existing.rows[0].original_name);
    let nextCategory = String(existing.rows[0].category);
    let nextLabel = (existing.rows[0].category_label as string | null) ?? null;
    if (parsed.data.category !== undefined || parsed.data.categoryLabel !== undefined) {
      const resolved = resolveWriteCategory({
        category: parsed.data.category,
        categoryLabel: parsed.data.categoryLabel,
      });
      if (!resolved.ok) return sendError(res, 400, "VALIDATION", resolved.message);
      nextCategory = resolved.category;
      nextLabel = resolved.categoryLabel;
    }
    await query(
      `UPDATE files SET original_name = $2, category = $3, category_label = $4 WHERE id = $1`,
      [id.data, nextName, nextCategory, nextLabel]
    );
    const row = await query(`SELECT * FROM files WHERE id = $1`, [id.data]);
    await writeAudit(req.user!.id, "update_file", "file", id.data);
    publishLive({
      reason: "file",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    return res.json({ file: fileDto(row.rows[0]) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/files:patch]");
  }
});

v2FilesRouter.delete("/:id", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const existing = await query<{
      project_id: string;
      stored_name: string;
    }>(`SELECT project_id, stored_name FROM files WHERE id = $1`, [id.data]);
    if (!existing.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const project = await getAccessibleProject(req.user!, existing.rows[0].project_id);
    const stored = existing.rows[0].stored_name;
    if (!/^[0-9a-f-]{36}$/i.test(stored) && stored !== id.data) {
      return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    }
    const root = storageRoot();
    const abs = path.join(root, stored);
    if (!abs.startsWith(root)) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    try {
      await fs.unlink(abs);
    } catch (err) {
      if (!isEnoent(err)) throw err;
    }
    await query(`DELETE FROM files WHERE id = $1`, [id.data]);
    await writeAudit(req.user!.id, "delete_file", "file", id.data);
    publishLive({
      reason: "file",
      clientId: project.client_id,
      actorId: req.user!.id,
    });
    return res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "[v2/files:delete]");
  }
});

v2FilesRouter.get("/:id/download", requireAuth, async (req, res) => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
  try {
    const row = await query<{
      project_id: string;
      original_name: string;
      stored_name: string;
      mime: string;
    }>(`SELECT project_id, original_name, stored_name, mime FROM files WHERE id = $1`, [id.data]);
    if (!row.rows[0]) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    await getAccessibleProject(req.user!, row.rows[0].project_id);
    const stored = row.rows[0].stored_name;
    if (!/^[0-9a-f-]{36}$/i.test(stored) && stored !== id.data) {
      return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    }
    const abs = path.join(storageRoot(), stored);
    const root = storageRoot();
    if (!abs.startsWith(root)) return sendError(res, 404, "NOT_FOUND", "Não encontrado.");
    const data = await fs.readFile(abs);
    res.setHeader("Content-Type", row.rows[0].mime || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeOriginalName(row.rows[0].original_name)}"`
    );
    return res.send(data);
  } catch (err) {
    return handleRouteError(res, err, "[v2/files:download]");
  }
});

export const v2SettingsRouter = Router();

v2SettingsRouter.get("/", requireAuth, async (_req, res) => {
  try {
    const row = await query<{ organization_name: string }>(
      `SELECT organization_name FROM app_settings WHERE id = 'default'`
    );
    return res.json({ organizationName: row.rows[0]?.organization_name ?? "Avadesk" });
  } catch (err) {
    return handleRouteError(res, err, "[v2/settings]");
  }
});

v2SettingsRouter.patch("/", requireAuth, requireRole("admin", "manager"), async (req, res) => {
  const parsed = z.object({ organizationName: z.string().trim().min(1).max(80) }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  try {
    await query(
      `INSERT INTO app_settings (id, organization_name, updated_at)
       VALUES ('default', $1, NOW())
       ON CONFLICT (id) DO UPDATE SET organization_name = EXCLUDED.organization_name, updated_at = NOW()`,
      [parsed.data.organizationName]
    );
    return res.json({ organizationName: parsed.data.organizationName });
  } catch (err) {
    return handleRouteError(res, err, "[v2/settings:patch]");
  }
});

export const v2MeRouter = Router();

const activeClientLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => (process.env.AVADESK_TEST || "").trim() === "1",
  message: { error: { code: "RATE_LIMIT", message: "Muitas tentativas. Tente mais tarde." } },
});

v2MeRouter.post("/active-client", requireAuth, activeClientLimiter, async (req, res) => {
  const parsed = z.object({ clientId: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, "VALIDATION", "Dados inválidos.");
  const user = req.user!;
  if (user.role !== "client") {
    return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
  }
  if (!user.client_ids?.includes(parsed.data.clientId)) {
    return sendError(res, 403, "FORBIDDEN", "Sem permissão.");
  }
  try {
    setActiveClientCookie(res, parsed.data.clientId);
    await query(`UPDATE users SET client_id = $2 WHERE id = $1 AND role = 'client'`, [
      user.id,
      parsed.data.clientId,
    ]);
    const mem = user.memberships?.find((m) => m.client_id === parsed.data.clientId);
    if (mem) {
      await query(`UPDATE users SET access_all_projects = $2 WHERE id = $1`, [
        user.id,
        mem.access_all_projects,
      ]);
    }
    const scoped = {
      ...user,
      client_id: parsed.data.clientId,
      active_client_id: parsed.data.clientId,
      access_all_projects: mem ? mem.access_all_projects !== false : true,
    };
    return res.json({ user: sessionDto(scoped) });
  } catch (err) {
    return handleRouteError(res, err, "[v2/me:active-client]");
  }
});

export const v2BootstrapRouter = Router();

v2BootstrapRouter.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const f = bindClientFilter(user, 1);
    const [projects, clients, updates, releases, tasks, documents, files, notifications, settings, access, tickets] =
      await Promise.all([
        query(
          `SELECT p.*,
                  c.system_url AS cred_url, c.access_user AS cred_user,
                  (c.password_ciphertext IS NOT NULL AND c.password_ciphertext <> '') AS has_password,
                  b.title AS fallback_building_title, b.content AS fallback_building_content,
                  n.title AS fallback_next_title
           FROM projects p
           LEFT JOIN project_credentials c ON c.project_id = p.id
           LEFT JOIN LATERAL (
             SELECT title, content FROM updates u
             WHERE u.project_id = p.id AND u.visible_to_client = TRUE AND u.status = 'em_andamento'
             ORDER BY u.created_at DESC LIMIT 1
           ) b ON TRUE
           LEFT JOIN LATERAL (
             SELECT title FROM updates u
             WHERE u.project_id = p.id AND u.visible_to_client = TRUE AND u.status = 'planejado'
             ORDER BY u.created_at DESC LIMIT 1
           ) n ON TRUE
           WHERE ${f.sql} AND p.archived_at IS NULL
           ORDER BY p.updated_at DESC`,
          f.params
        ),
        isStaff(user)
          ? query(`SELECT * FROM clients ORDER BY name`)
          : user.client_ids?.length
            ? query(`SELECT * FROM clients WHERE id = ANY($1::uuid[]) ORDER BY name`, [user.client_ids])
            : Promise.resolve({ rows: [] as Record<string, unknown>[] }),
        query(
          `SELECT u.*, usr.email AS author_email, COALESCE(usr.name, usr.email) AS author_name
           FROM updates u
           INNER JOIN projects p ON p.id = u.project_id
           LEFT JOIN users usr ON usr.id = u.author_id
           WHERE ${f.sql}${isStaff(user) ? "" : " AND u.visible_to_client = TRUE"}
           ORDER BY u.created_at DESC LIMIT 300`,
          f.params
        ),
        query(
          `SELECT r.* FROM releases r INNER JOIN projects p ON p.id = r.project_id WHERE ${f.sql} ORDER BY r.released_at DESC`,
          f.params
        ),
        query(
          `SELECT t.* FROM tasks t INNER JOIN projects p ON p.id = t.project_id WHERE ${f.sql}`,
          f.params
        ),
        query(
          `SELECT d.id FROM documents d INNER JOIN projects p ON p.id = d.project_id WHERE ${f.sql}`,
          f.params
        ),
        query(
          `SELECT fl.* FROM files fl INNER JOIN projects p ON p.id = fl.project_id WHERE ${f.sql}`,
          f.params
        ),
        query(`SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [
          user.id,
        ]),
        query(`SELECT organization_name FROM app_settings WHERE id = 'default'`),
        query(`SELECT project_id FROM user_project_access WHERE user_id = $1`, [user.id]),
        listTicketsDto(user, { limit: 100, stage: "open" }),
      ]);

    const usersPayload = isStaff(user)
      ? (
          await query(`SELECT id, email, role, client_id, name, must_complete_profile, access_all_projects, active, avatar_initials, title, instagram_company, instagram_personal, profile_completed_at FROM users`)
        ).rows.map((u) =>
          serializeUserLite(u)
        )
      : [serializeUserLite(user as unknown as Record<string, unknown>)];

    const docs = [];
    for (const d of documents.rows) {
      const dto = await documentDto(d.id as string);
      if (dto) docs.push(dto);
    }

    const dto = sessionDto(user);
    dto.projectIds = access.rows.map((r) => r.project_id as string);

    const auditLogs = isStaff(user)
      ? (
          await query(
            `SELECT id, actor_id, action, entity, entity_id, meta, created_at
             FROM audit_logs ORDER BY created_at DESC LIMIT 40`
          )
        ).rows.map((a) => ({
          id: a.id,
          actorId: a.actor_id,
          action: a.action,
          entity: a.entity,
          entityId: a.entity_id,
          meta: a.meta,
          createdAt: a.created_at,
        }))
      : [];

    return res.json({
      session: dto,
      organizationName: (settings.rows[0] as { organization_name?: string } | undefined)?.organization_name ?? "Avadesk",
      clients: clients.rows.map((c) => serializeClient(c as Record<string, unknown>)),
      projects: projects.rows.map((p) => serializeProject(p as Record<string, unknown>)),
      updates: updates.rows.map((u) => ({
        id: u.id,
        projectId: u.project_id,
        authorId: u.author_id,
        authorName: u.author_name || u.author_email || "Autor removido",
        type: u.type || "UPDATE",
        title: u.title || "",
        content: u.content,
        status: u.status,
        visibleToClient: u.visible_to_client,
        createdAt: u.created_at,
      })),
      releases: releases.rows.map((r) => serializeRelease(r as Record<string, unknown>)),
      tasks: tasks.rows.map((t) => ({
        id: t.id,
        projectId: t.project_id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeName: t.assignee_name,
        updatedAt: t.updated_at,
      })),
      tickets,
      documents: docs,
      files: files.rows.map((r) => fileDto(r as Record<string, unknown>)),
      notifications: notifications.rows.map((n) => ({
        id: n.id,
        userId: n.user_id,
        clientId: n.client_id,
        title: n.title,
        body: n.body,
        href: n.href,
        read: n.read,
        createdAt: n.created_at,
      })),
      users: usersPayload,
      auditLogs,
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/bootstrap]");
  }
});

function serializeUserLite(u: Record<string, unknown> | AuthUser) {
  const rec = u as Record<string, unknown>;
  const role = String(rec.role ?? "");
  return {
    id: rec.id,
    email: rec.email,
    name: rec.name || "",
    role: role === "admin" || role === "ADMIN" ? "ADMIN" : role === "manager" || role === "MANAGER" ? "MANAGER" : "CLIENT",
    clientId: rec.client_id ?? rec.clientId ?? null,
    avatarInitials: rec.avatar_initials || rec.avatarInitials || "U",
    active: rec.active !== false,
    title: rec.title ?? "",
    mustCompleteProfile: Boolean(rec.must_complete_profile ?? rec.mustCompleteProfile),
    instagramCompany: rec.instagram_company ?? rec.instagramCompany,
    instagramPersonal: rec.instagram_personal ?? rec.instagramPersonal,
    profileCompletedAt: rec.profile_completed_at ?? rec.profileCompletedAt,
    projectIds: [] as string[],
    accessAllProjects: rec.access_all_projects !== false && rec.accessAllProjects !== false,
    clientIds: rec.client_ids ?? rec.clientIds ?? (rec.client_id || rec.clientId ? [rec.client_id ?? rec.clientId] : []),
    memberships: Array.isArray(rec.memberships)
      ? (rec.memberships as Array<Record<string, unknown>>).map((m) => ({
          clientId: String(m.clientId ?? m.client_id ?? ""),
          accessAllProjects: Boolean(m.accessAllProjects ?? m.access_all_projects !== false),
          projectIds: Array.isArray(m.projectIds) ? (m.projectIds as string[]) : [],
        }))
      : [],
    activeClientId: rec.active_client_id ?? rec.activeClientId ?? rec.client_id ?? rec.clientId ?? null,
  };
}
