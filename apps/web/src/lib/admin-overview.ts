import { attentionKindClient, PROJECT_STATUSES } from "@/lib/project-attention";
import type {
  Client,
  Project,
  ProjectStatus,
  Task,
  Ticket,
  TicketStage,
  TicketType,
  UpdateItem,
  User,
} from "@/types";

export interface AdminOverview {
  generatedAt: string;
  systems: {
    total: number;
    byStatus: Record<ProjectStatus, number>;
    stale: number;
    quietPublished: number;
    avgProgressActive: number;
  };
  tickets: {
    open: number;
    byStage: Record<TicketStage, number>;
    bugsOpen: number;
  };
  tasks: {
    doing: number;
    review: number;
    highOpen: number;
  };
  updates: {
    visibleLast7d: number;
    internalLast7d: number;
  };
  directory: {
    clients: number;
    clientUsersActive: number;
  };
}

export type NeedYouKind = "stale" | "bug_fix" | "waiting_client" | "client_replied";

export interface NeedYouItem {
  id: string;
  kind: NeedYouKind;
  projectId: string;
  title: string;
  hint: string;
  href: string;
  cta: string;
}

export interface SystemRow {
  id: string;
  name: string;
  company: string;
  status: ProjectStatus;
  progressPct: number;
  lastNewsAt: string | null;
  openTickets: number;
  attention: "stale" | "sem_novidade" | null;
}

const EMPTY_STATUS: Record<ProjectStatus, number> = {
  planning: 0,
  development: 0,
  testing: 0,
  homologation: 0,
  published: 0,
  maintenance: 0,
  paused: 0,
};

const EMPTY_STAGE: Record<TicketStage, number> = {
  fix: 0,
  production: 0,
  resolved: 0,
  closed: 0,
};

export const STATUS_MIX: { key: ProjectStatus; short: string }[] = [
  { key: "planning", short: "Plan" },
  { key: "development", short: "Dev" },
  { key: "testing", short: "Teste" },
  { key: "homologation", short: "Homol" },
  { key: "published", short: "Pub" },
  { key: "maintenance", short: "Man" },
  { key: "paused", short: "Paus" },
];

export function liveSystemsCount(overview: AdminOverview): number {
  return overview.systems.byStatus.published + overview.systems.byStatus.maintenance;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 0;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function buildNeedYouItems(projects: Project[], tickets: Ticket[]): NeedYouItem[] {
  const projectName = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const items: NeedYouItem[] = [];

  for (const project of projects) {
    const attention = attentionKindClient(project.status, project.lastClientUpdateAt ?? project.updatedAt);
    if (attention !== "stale") continue;
    const days = daysSince(project.lastClientUpdateAt ?? project.updatedAt);
    items.push({
      id: `stale-${project.id}`,
      kind: "stale",
      projectId: project.id,
      title: project.name,
      hint: days > 0 ? `PARADO · ${days}d sem novidade` : "PARADO · sem novidade visível",
      href: `/admin/projects/${project.id}`,
      cta: "Atualizar",
    });
  }

  const openBugs = tickets.filter((t) => t.type === "bug" && t.stage === "fix");
  for (const ticket of openBugs) {
    items.push({
      id: `bug-${ticket.id}`,
      kind: "bug_fix",
      projectId: ticket.projectId,
      title: ticket.title,
      hint: `${projectName[ticket.projectId] ?? ticket.projectName} · Bug em correção`,
      href: `/admin/chamados?stage=fix&type=bug`,
      cta: "Chamado",
    });
  }

  const waiting = tickets.filter((t) => t.stage === "resolved");
  for (const ticket of waiting) {
    items.push({
      id: `wait-${ticket.id}`,
      kind: "waiting_client",
      projectId: ticket.projectId,
      title: ticket.title,
      hint: `${projectName[ticket.projectId] ?? ticket.projectName} · Resolvido · espera cliente`,
      href: `/admin/chamados?stage=resolved`,
      cta: "Abrir",
    });
  }

  for (const ticket of tickets) {
    if (ticket.stage === "closed") continue;
    if (ticket.awaitingReplyFromUserId) continue;
    const msgs = ticket.messages ?? [];
    if (msgs.length === 0 || msgs[msgs.length - 1]?.kind !== "reply") continue;
    items.push({
      id: `replied-${ticket.id}`,
      kind: "client_replied",
      projectId: ticket.projectId,
      title: ticket.title,
      hint: `${projectName[ticket.projectId] ?? ticket.projectName} · Cliente respondeu`,
      href: "/admin/chamados",
      cta: "Ler",
    });
  }

  return items;
}

export function buildSystemRows(
  projects: Project[],
  clients: Client[],
  tickets: Ticket[]
): SystemRow[] {
  const companyByClient = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
  const openByProject = new Map<string, number>();
  for (const ticket of tickets) {
    if (ticket.stage === "closed") continue;
    openByProject.set(ticket.projectId, (openByProject.get(ticket.projectId) ?? 0) + 1);
  }

  return [...projects]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((project) => ({
      id: project.id,
      name: project.name,
      company: companyByClient[project.clientId] ?? "—",
      status: project.status,
      progressPct: project.progressPct,
      lastNewsAt: project.lastClientUpdateAt ?? project.updatedAt,
      openTickets: openByProject.get(project.id) ?? 0,
      attention: attentionKindClient(project.status, project.lastClientUpdateAt ?? project.updatedAt),
    }));
}

export function filterSystemRows(
  rows: SystemRow[],
  search: string,
  status: "ALL" | ProjectStatus
): SystemRow[] {
  const q = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (status !== "ALL" && row.status !== status) return false;
    if (!q) return true;
    return row.name.toLowerCase().includes(q) || row.company.toLowerCase().includes(q);
  });
}

export function deriveOverviewFromStore(input: {
  projects: Project[];
  tickets: Ticket[];
  tasks: Task[];
  updates: UpdateItem[];
  clients: Client[];
  users: User[];
}): AdminOverview {
  const byStatus = { ...EMPTY_STATUS };
  let stale = 0;
  let quietPublished = 0;
  let progressSum = 0;
  let progressN = 0;
  const active = new Set(["planning", "development", "testing", "homologation"]);

  for (const project of input.projects) {
    byStatus[project.status] += 1;
    const attention = attentionKindClient(project.status, project.lastClientUpdateAt);
    if (attention === "stale") stale += 1;
    if (attention === "sem_novidade") quietPublished += 1;
    if (active.has(project.status)) {
      progressSum += project.progressPct;
      progressN += 1;
    }
  }

  const byStage = { ...EMPTY_STAGE };
  let open = 0;
  let bugsOpen = 0;
  for (const ticket of input.tickets) {
    byStage[ticket.stage] += 1;
    if (ticket.stage !== "closed") {
      open += 1;
      if (ticket.type === "bug") bugsOpen += 1;
    }
  }

  let doing = 0;
  let review = 0;
  let highOpen = 0;
  for (const task of input.tasks) {
    if (task.status === "doing") doing += 1;
    if (task.status === "review") review += 1;
    if (task.priority === "high" && task.status !== "done") highOpen += 1;
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let visibleLast7d = 0;
  let internalLast7d = 0;
  for (const update of input.updates) {
    if (new Date(update.createdAt).getTime() < weekAgo) continue;
    if (update.visibleToClient) visibleLast7d += 1;
    else internalLast7d += 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    systems: {
      total: input.projects.length,
      byStatus,
      stale,
      quietPublished,
      avgProgressActive: progressN ? Math.round(progressSum / progressN) : 0,
    },
    tickets: { open, byStage, bugsOpen },
    tasks: { doing, review, highOpen },
    updates: { visibleLast7d, internalLast7d },
    directory: {
      clients: input.clients.length,
      clientUsersActive: input.users.filter((u) => u.role === "CLIENT" && u.active).length,
    },
  };
}

export const TICKET_STAGE_QUERY = ["fix", "production", "resolved", "closed"] as const;
export const TICKET_TYPE_QUERY = ["bug", "implementation", "feature", "routine"] as const;

export function parseTicketStageParam(value: string | null): TicketStage | null {
  if (!value) return null;
  return (TICKET_STAGE_QUERY as readonly string[]).includes(value) ? (value as TicketStage) : null;
}

export function parseTicketTypeParam(value: string | null): TicketType | null {
  if (!value) return null;
  return (TICKET_TYPE_QUERY as readonly string[]).includes(value) ? (value as TicketType) : null;
}

export { PROJECT_STATUSES };
