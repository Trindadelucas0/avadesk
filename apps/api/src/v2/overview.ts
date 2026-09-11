import { Router } from "express";
import { query } from "../lib/db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { handleRouteError } from "../lib/http.js";

const PROJECT_STATUSES = [
  "planning",
  "development",
  "testing",
  "homologation",
  "published",
  "maintenance",
  "paused",
] as const;

const TICKET_STAGES = ["fix", "production", "resolved", "closed"] as const;

function n(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const v2AdminOverviewRouter = Router();

v2AdminOverviewRouter.get("/", requireAuth, requireRole("admin", "manager"), async (_req, res) => {
  try {
    const [systems, tickets, tasks, updates, clients, users] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE archived_at IS NULL) AS total,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'planning') AS planning,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'development') AS development,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'testing') AS testing,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'homologation') AS homologation,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'published') AS published,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'maintenance') AS maintenance,
           COUNT(*) FILTER (WHERE archived_at IS NULL AND status = 'paused') AS paused,
           COUNT(*) FILTER (
             WHERE archived_at IS NULL
               AND status <> 'paused'
               AND status NOT IN ('published', 'maintenance')
               AND last_client_update_at IS NOT NULL
               AND last_client_update_at < NOW() - INTERVAL '7 days'
           ) AS stale,
           COUNT(*) FILTER (
             WHERE archived_at IS NULL
               AND status IN ('published', 'maintenance')
               AND last_client_update_at IS NOT NULL
               AND last_client_update_at < NOW() - INTERVAL '7 days'
           ) AS quiet_published,
           COALESCE(
             AVG(progress_pct) FILTER (
               WHERE archived_at IS NULL
                 AND status IN ('planning', 'development', 'testing', 'homologation')
             ),
             0
           ) AS avg_progress_active
         FROM projects`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE t.stage <> 'closed') AS open,
           COUNT(*) FILTER (WHERE t.stage = 'fix') AS fix,
           COUNT(*) FILTER (WHERE t.stage = 'production') AS production,
           COUNT(*) FILTER (WHERE t.stage = 'resolved') AS resolved,
           COUNT(*) FILTER (WHERE t.stage = 'closed') AS closed,
           COUNT(*) FILTER (WHERE t.type = 'bug' AND t.stage <> 'closed') AS bugs_open
         FROM tickets t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE p.archived_at IS NULL`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE t.status = 'doing') AS doing,
           COUNT(*) FILTER (WHERE t.status = 'review') AS review,
           COUNT(*) FILTER (WHERE t.priority = 'high' AND t.status <> 'done') AS high_open
         FROM tasks t
         INNER JOIN projects p ON p.id = t.project_id
         WHERE p.archived_at IS NULL`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE u.visible_to_client = TRUE AND u.created_at >= NOW() - INTERVAL '7 days') AS visible_last_7d,
           COUNT(*) FILTER (WHERE u.visible_to_client = FALSE AND u.created_at >= NOW() - INTERVAL '7 days') AS internal_last_7d
         FROM updates u
         INNER JOIN projects p ON p.id = u.project_id
         WHERE p.archived_at IS NULL`
      ),
      query(`SELECT COUNT(*) AS n FROM clients`),
      query(`SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND active = TRUE`),
    ]);

    const sys = systems.rows[0] ?? {};
    const tic = tickets.rows[0] ?? {};
    const tsk = tasks.rows[0] ?? {};
    const upd = updates.rows[0] ?? {};

    const byStatus = Object.fromEntries(PROJECT_STATUSES.map((status) => [status, n(sys[status])])) as Record<
      (typeof PROJECT_STATUSES)[number],
      number
    >;
    const byStage = Object.fromEntries(TICKET_STAGES.map((stage) => [stage, n(tic[stage])])) as Record<
      (typeof TICKET_STAGES)[number],
      number
    >;

    return res.json({
      generatedAt: new Date().toISOString(),
      systems: {
        total: n(sys.total),
        byStatus,
        stale: n(sys.stale),
        quietPublished: n(sys.quiet_published),
        avgProgressActive: Math.round(n(sys.avg_progress_active)),
      },
      tickets: {
        open: n(tic.open),
        byStage,
        bugsOpen: n(tic.bugs_open),
      },
      tasks: {
        doing: n(tsk.doing),
        review: n(tsk.review),
        highOpen: n(tsk.high_open),
      },
      updates: {
        visibleLast7d: n(upd.visible_last_7d),
        internalLast7d: n(upd.internal_last_7d),
      },
      directory: {
        clients: n(clients.rows[0]?.n),
        clientUsersActive: n(users.rows[0]?.n),
      },
    });
  } catch (err) {
    return handleRouteError(res, err, "[v2/admin/overview]");
  }
});
