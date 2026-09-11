"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/hub/page-header";
import { ProgressBar } from "@/components/hub/progress";
import { StatusBadge } from "@/components/hub/status-badge";
import { Timeline } from "@/components/hub/timeline";
import { EmptyState, Skeleton } from "@/components/hub/states";
import { DataTable, FilterChip } from "@/components/hub/filter-table";
import { KpiStat } from "@/components/hub/kpi-stat";
import { StatusMix } from "@/components/hub/status-mix";
import { useHubStore } from "@/stores/hub-store";
import { useAdminOverview } from "@/hooks/use-admin-overview";
import {
  PROJECT_STATUSES,
  buildNeedYouItems,
  buildSystemRows,
  deriveOverviewFromStore,
  filterSystemRows,
  liveSystemsCount,
} from "@/lib/admin-overview";
import type { ProjectStatus } from "@/types";
import { formatRelative, statusLabel } from "@/lib/utils";

export default function AdminDashboardPage() {
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const tickets = useHubStore((s) => s.tickets);
  const tasks = useHubStore((s) => s.tasks);
  const updates = useHubStore((s) => s.updates);
  const users = useHubStore((s) => s.users);

  const { data, error, loading, reload } = useAdminOverview();
  const fallback = useMemo(
    () => deriveOverviewFromStore({ projects, tickets, tasks, updates, clients, users }),
    [projects, tickets, tasks, updates, clients, users]
  );
  const overview = data ?? fallback;
  const approximate = Boolean(error && !data);
  const live = liveSystemsCount(overview);

  const needYou = useMemo(() => buildNeedYouItems(projects, tickets), [projects, tickets]);
  const systemRows = useMemo(
    () => buildSystemRows(projects, clients, tickets),
    [projects, clients, tickets]
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const visibleRows = useMemo(
    () => filterSystemRows(systemRows, search, statusFilter),
    [systemRows, search, statusFilter]
  );

  const recentUpdates = useMemo(
    () =>
      [...updates]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 40),
    [updates]
  );
  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const clientNames = useMemo(() => {
    const byId = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
    return Object.fromEntries(
      projects.map((p) => [p.id, byId[p.clientId] ?? ""]).filter(([, name]) => Boolean(name))
    );
  }, [projects, clients]);

  const kpiLoading = loading && !data;

  return (
    <div>
      <PageHeader
        icon={LayoutDashboard}
        title="Visão geral"
        description="Saúde dos sistemas e o que precisa de você hoje. Quick Update na barra ou ⌘K."
        actions={
          <Button variant="accent" size="sm" asChild>
            <Link href="/admin/updates">Atualizar</Link>
          </Button>
        }
      />

      {error ? (
        <div
          className="mb-6 rounded-lg border border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.08)] px-4 py-3 text-sm text-[var(--text-secondary)]"
          role="alert"
        >
          Não foi possível carregar os totais.{" "}
          {approximate ? "Os números abaixo são aproximados (snapshot)." : null}{" "}
          <button type="button" className="text-[var(--accent)] hover:underline hub-focus" onClick={() => void reload()}>
            Tentar de novo
          </button>
        </div>
      ) : null}

      <div className="-mx-1 mb-8 flex gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-4">
        <KpiStat
          label="Parados"
          value={overview.systems.stale}
          hint="sem novidade >7 dias"
          tone={overview.systems.stale > 0 ? "warning" : "default"}
          href="#precisa"
          loading={kpiLoading}
        />
        <KpiStat
          label="Chamados abertos"
          value={overview.tickets.open}
          hint={overview.tickets.bugsOpen ? `${overview.tickets.bugsOpen} bug(s)` : "não encerrados"}
          tone={overview.tickets.bugsOpen > 0 ? "danger" : overview.tickets.open > 0 ? "warning" : "default"}
          href="/admin/chamados?stage=fix"
          loading={kpiLoading}
        />
        <KpiStat
          label="Aguard. cliente"
          value={overview.tickets.byStage.resolved}
          hint="resolvidos, sem confirmação"
          href="/admin/chamados?stage=resolved"
          loading={kpiLoading}
        />
        <KpiStat
          label="Sistemas no ar"
          value={live}
          hint={`${overview.systems.total} no portfólio`}
          tone={live > 0 ? "success" : "default"}
          href="/admin/projects"
          loading={kpiLoading}
        />
      </div>

      {kpiLoading ? (
        <Skeleton className="mb-8 h-24 w-full" />
      ) : (
        <div className="mb-8">
          <StatusMix
            byStatus={overview.systems.byStatus}
            total={overview.systems.total}
            avgProgressActive={overview.systems.avgProgressActive}
          />
        </div>
      )}

      <section id="precisa" className="mb-10 scroll-mt-24">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Precisa de você
        </h2>
        {needYou.length === 0 ? (
          <p className="hub-surface px-4 py-3 text-sm text-[var(--text-secondary)]">
            Nada parado nem esperando confirmação. Use Quick Update quando houver novidade real.
          </p>
        ) : (
          <ul className="space-y-2">
            {needYou.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="hub-surface flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{item.hint}</p>
                  </div>
                  <Button size="sm" variant={item.kind === "stale" ? "accent" : "outline"} asChild>
                    <span>{item.cta}</span>
                  </Button>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Sistemas
          </h2>
          <Link
            href="/admin/projects"
            className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            Ver todos <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {projects.length === 0 ? (
          <EmptyState
            title="Nenhum sistema ainda"
            description="Crie um cliente e o primeiro projeto para acompanhar o portfólio."
            action={
              <Button variant="accent" size="sm" asChild>
                <Link href="/admin/clients">Criar cliente</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="sr-only" htmlFor="admin-systems-search">
                Buscar sistema
              </label>
              <Input
                id="admin-systems-search"
                placeholder="Buscar por sistema ou empresa"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:max-w-xs"
              />
              <div className="flex flex-wrap gap-1">
                <FilterChip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")}>
                  Todos
                </FilterChip>
                {PROJECT_STATUSES.map((status) => (
                  <FilterChip
                    key={status}
                    active={statusFilter === status}
                    onClick={() => setStatusFilter(status)}
                  >
                    {statusLabel(status)}
                  </FilterChip>
                ))}
              </div>
            </div>

            <div className="hidden md:block">
              <DataTable
                columns={[
                  { key: "name", header: "Sistema" },
                  { key: "company", header: "Empresa" },
                  { key: "status", header: "Status" },
                  { key: "progress", header: "%" },
                  { key: "news", header: "Novidade" },
                  { key: "tickets", header: "Chamados" },
                  { key: "attention", header: "Atenção" },
                ]}
                rows={visibleRows.map((row) => ({
                  name: (
                    <Link href={`/admin/projects/${row.id}`} className="font-medium hover:text-[var(--accent)]">
                      {row.name}
                    </Link>
                  ),
                  company: row.company,
                  status: <StatusBadge status={row.status} />,
                  progress: (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={row.progressPct} size="sm" className="max-w-[72px]" />
                      <span className="text-xs tabular-nums">{row.progressPct}%</span>
                    </div>
                  ),
                  news: formatRelative(row.lastNewsAt),
                  tickets: (
                    <span className="tabular-nums">
                      {row.openTickets > 0 ? `${row.openTickets} aberto${row.openTickets === 1 ? "" : "s"}` : "—"}
                    </span>
                  ),
                  attention:
                    row.attention === "stale" ? (
                      <StatusBadge stale />
                    ) : row.attention === "sem_novidade" ? (
                      <span className="text-xs text-[var(--text-muted)]">sem novidade</span>
                    ) : (
                      "—"
                    ),
                }))}
                empty={
                  <p className="hub-surface px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                    Nenhum sistema neste filtro.
                  </p>
                }
              />
            </div>

            <ul className="space-y-2 md:hidden">
              {visibleRows.length === 0 ? (
                <li className="hub-surface px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                  Nenhum sistema neste filtro.
                </li>
              ) : (
                visibleRows.map((row) => (
                  <li key={row.id}>
                    <Link
                      href={`/admin/projects/${row.id}`}
                      className="hub-surface block p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{row.name}</span>
                        <StatusBadge status={row.status} />
                        {row.attention === "stale" ? <StatusBadge stale /> : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{row.company}</p>
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-[var(--text-muted)]">
                          <span>Evolução</span>
                          <span>{row.progressPct}%</span>
                        </div>
                        <ProgressBar value={row.progressPct} size="sm" />
                      </div>
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        {formatRelative(row.lastNewsAt)}
                        {row.openTickets > 0 ? ` · ${row.openTickets} chamado(s)` : ""}
                        {row.attention === "sem_novidade" ? " · sem novidade" : ""}
                      </p>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Atividade recente
          </h2>
          <Link
            href="/admin/updates"
            className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
          >
            Todos os updates <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentUpdates.length === 0 ? (
          <EmptyState title="Nenhuma atualização ainda" description="Publique a primeira via Quick Update." />
        ) : (
          <Timeline
            items={recentUpdates}
            projectNames={projectNames}
            clientNames={clientNames}
            scrollable
            showVisibility
            detailBase="/admin/projects"
            updatesHref="/admin/updates"
          />
        )}
      </section>
    </div>
  );
}
