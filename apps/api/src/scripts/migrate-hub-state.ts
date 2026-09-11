/**
 * One-shot: copy hub_state.payload into relational tables.
 * Skips invalid rows. Does not delete hub_state.
 */
import bcrypt from "bcryptjs";
import { pool } from "../lib/db.js";
import { env } from "../lib/env.js";
import { encryptSecret } from "../lib/crypto-secret.js";
import { mapProjectStatus } from "../lib/dto.js";

type AnyRec = Record<string, unknown>;

function str(v: unknown): string {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function bool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

async function migrate() {
  const client = await pool.connect();
  const idMap = new Map<string, string>();

  const skip = (kind: string, reason: string) => {
    console.warn(`[migrate-hub] skip ${kind}: ${reason}`);
  };

  try {
    const state = await client.query<{ payload: AnyRec }>(
      `SELECT payload FROM hub_state WHERE id = 'default'`
    );
    const payload = state.rows[0]?.payload;
    if (!payload || typeof payload !== "object") {
      console.log("[migrate-hub] no hub_state payload — nothing to copy");
      return;
    }

    const org = str(payload.organizationName) || "Avadesk";
    await client.query(
      `INSERT INTO app_settings (id, organization_name) VALUES ('default', $1)
       ON CONFLICT (id) DO UPDATE SET organization_name = EXCLUDED.organization_name`,
      [org]
    );

    const clients = Array.isArray(payload.clients) ? (payload.clients as AnyRec[]) : [];
    for (const c of clients) {
      try {
        const name = str(c.name).trim();
        const company = str(c.company).trim() || name;
        if (!name) {
          skip("client", "missing name");
          continue;
        }
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM clients WHERE name = $1 AND company = $2 LIMIT 1`,
          [name, company]
        );
        if (existing.rows[0]) {
          if (typeof c.id === "string") idMap.set(c.id, existing.rows[0].id);
          continue;
        }
        const ins = await client.query<{ id: string }>(
          `INSERT INTO clients (name, company, segment, primary_contact, logo_initials)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [name, company, str(c.segment), str(c.primaryContact), str(c.logoInitials).slice(0, 4)]
        );
        if (typeof c.id === "string") idMap.set(c.id, ins.rows[0].id);
      } catch (err) {
        skip("client", err instanceof Error ? err.message : "error");
      }
    }

    const passwords =
      payload.userPasswords && typeof payload.userPasswords === "object"
        ? (payload.userPasswords as Record<string, string>)
        : {};

    const users = Array.isArray(payload.users) ? (payload.users as AnyRec[]) : [];
    for (const u of users) {
      try {
        const email = str(u.email).toLowerCase().trim();
        if (!email || !email.includes("@")) {
          skip("user", "invalid email");
          continue;
        }
        const roleRaw = str(u.role).toLowerCase();
        const role = roleRaw === "admin" || roleRaw === "manager" || roleRaw === "client" ? roleRaw : "client";
        const existing = await client.query<{ id: string }>(`SELECT id FROM users WHERE lower(email) = $1`, [
          email,
        ]);
        if (existing.rows[0]) {
          if (typeof u.id === "string") idMap.set(u.id, existing.rows[0].id);
          continue;
        }
        const plain = passwords[email] || env.seedPassword;
        const hash = await bcrypt.hash(plain, 12);
        let clientId: string | null = null;
        if (role === "client") {
          const oldCid = str(u.clientId);
          clientId = idMap.get(oldCid) ?? null;
          if (!clientId) {
            skip("user", `client ${email} missing client mapping`);
            continue;
          }
        }
        const ins = await client.query<{ id: string }>(
          `INSERT INTO users (email, password_hash, role, client_id, name, must_complete_profile, access_all_projects, active, avatar_initials)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            email,
            hash,
            role,
            clientId,
            str(u.name) || email.split("@")[0],
            bool(u.mustCompleteProfile, role === "client"),
            bool(u.accessAllProjects, true),
            u.active !== false,
            str(u.avatarInitials).slice(0, 4) || "U",
          ]
        );
        if (typeof u.id === "string") idMap.set(u.id, ins.rows[0].id);
      } catch (err) {
        skip("user", err instanceof Error ? err.message : "error");
      }
    }

    const projects = Array.isArray(payload.projects) ? (payload.projects as AnyRec[]) : [];
    for (const p of projects) {
      try {
        const name = str(p.name).trim();
        if (!name) {
          skip("project", "missing name");
          continue;
        }
        const oldCid = str(p.clientId);
        const clientId = idMap.get(oldCid);
        if (!clientId) {
          skip("project", `${name} missing client`);
          continue;
        }
        const status = mapProjectStatus(str(p.status) || "planning");
        const building = p.currentlyBuilding && typeof p.currentlyBuilding === "object" ? (p.currentlyBuilding as AnyRec) : null;
        const nextSteps = Array.isArray(p.nextSteps) ? (p.nextSteps as AnyRec[]) : [];
        const next = nextSteps[0];
        const ins = await client.query<{ id: string }>(
          `INSERT INTO projects (
             client_id, name, status, progress_pct, summary, slug, system_url, access_user,
             currently_building_title, currently_building_progress_pct, currently_building_owner,
             currently_building_eta, currently_building_description,
             next_step_title, next_step_due_label, last_client_update_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
           RETURNING id`,
          [
            clientId,
            name,
            status,
            Number(p.progressPct ?? 0) || 0,
            str(p.summary),
            str(p.slug) || name.toLowerCase().replace(/\s+/g, "-"),
            str(p.systemUrl) || null,
            str(p.accessUser) || null,
            building ? str(building.title) : null,
            building ? Number(building.progressPct ?? 0) : null,
            building ? str(building.ownerName) : null,
            building ? str(building.etaLabel) : null,
            building ? str(building.description) : null,
            next ? str(next.title) : null,
            next ? str(next.dueLabel) : null,
            asDate(p.updatedAt),
          ]
        );
        const pid = ins.rows[0].id;
        if (typeof p.id === "string") idMap.set(p.id, pid);
        const pwd = str(p.accessPassword);
        await client.query(
          `INSERT INTO project_credentials (project_id, system_url, access_user, password_ciphertext)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (project_id) DO UPDATE SET
             system_url = EXCLUDED.system_url,
             access_user = EXCLUDED.access_user,
             password_ciphertext = COALESCE(EXCLUDED.password_ciphertext, project_credentials.password_ciphertext)`,
          [pid, str(p.systemUrl) || null, str(p.accessUser) || null, pwd ? encryptSecret(pwd) : null]
        );
      } catch (err) {
        skip("project", err instanceof Error ? err.message : "error");
      }
    }

    for (const u of users) {
      try {
        const newUid = typeof u.id === "string" ? idMap.get(u.id) : undefined;
        if (!newUid) continue;
        const pids = Array.isArray(u.projectIds) ? (u.projectIds as string[]) : [];
        for (const oldPid of pids) {
          const np = idMap.get(oldPid);
          if (!np) continue;
          await client.query(
            `INSERT INTO user_project_access (user_id, project_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [newUid, np]
          );
        }
      } catch (err) {
        skip("access", err instanceof Error ? err.message : "error");
      }
    }

    const admin = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('admin','manager') ORDER BY created_at ASC LIMIT 1`
    );
    const fallbackAuthor = admin.rows[0]?.id;

    const updates = Array.isArray(payload.updates) ? (payload.updates as AnyRec[]) : [];
    for (const u of updates) {
      try {
        const projectId = idMap.get(str(u.projectId));
        if (!projectId) {
          skip("update", "missing project");
          continue;
        }
        const authorId = idMap.get(str(u.authorId)) || fallbackAuthor;
        if (!authorId) {
          skip("update", "missing author");
          continue;
        }
        const content = str(u.content).trim();
        if (!content) {
          skip("update", "empty content");
          continue;
        }
        const status = ["planejado", "em_andamento", "concluido"].includes(str(u.status))
          ? str(u.status)
          : "em_andamento";
        await client.query(
          `INSERT INTO updates (project_id, author_id, content, status, visible_to_client, title, type, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, NOW()))`,
          [
            projectId,
            authorId,
            content,
            status,
            bool(u.visibleToClient, true),
            str(u.title) || content.slice(0, 80),
            str(u.type) || "UPDATE",
            asDate(u.createdAt),
          ]
        );
      } catch (err) {
        skip("update", err instanceof Error ? err.message : "error");
      }
    }

    await client.query(
      `UPDATE projects p SET last_client_update_at = (
         SELECT MAX(u.created_at) FROM updates u
         WHERE u.project_id = p.id AND u.visible_to_client = TRUE
       )`
    );

    const releases = Array.isArray(payload.releases) ? (payload.releases as AnyRec[]) : [];
    for (const r of releases) {
      try {
        const projectId = idMap.get(str(r.projectId));
        if (!projectId || !str(r.title) || !str(r.version)) {
          skip("release", "invalid");
          continue;
        }
        const highlights = Array.isArray(r.highlights) ? r.highlights.map(String) : [];
        await client.query(
          `INSERT INTO releases (project_id, version, title, notes, highlights, released_at)
           VALUES ($1,$2,$3,$4,$5,COALESCE($6, NOW()))`,
          [projectId, str(r.version), str(r.title), str(r.notes), highlights, asDate(r.releasedAt)]
        );
      } catch (err) {
        skip("release", err instanceof Error ? err.message : "error");
      }
    }

    const tasks = Array.isArray(payload.tasks) ? (payload.tasks as AnyRec[]) : [];
    for (const t of tasks) {
      try {
        const projectId = idMap.get(str(t.projectId));
        if (!projectId || !str(t.title)) {
          skip("task", "invalid");
          continue;
        }
        const status = ["backlog", "todo", "doing", "review", "done"].includes(str(t.status))
          ? str(t.status)
          : "todo";
        await client.query(
          `INSERT INTO tasks (project_id, title, description, status, priority, assignee_name)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            projectId,
            str(t.title),
            str(t.description),
            status,
            ["low", "medium", "high"].includes(str(t.priority)) ? str(t.priority) : "medium",
            str(t.assigneeName),
          ]
        );
      } catch (err) {
        skip("task", err instanceof Error ? err.message : "error");
      }
    }

    console.log("[migrate-hub] done");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("[migrate-hub] failed", err);
  process.exit(1);
});
