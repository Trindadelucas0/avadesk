"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Home, KeyRound } from "lucide-react";
import {
  EmptyState,
  PageSkeleton,
  ProgressBar,
  ProjectProgress,
  ReleaseCard,
  StatusBadge,
  Timeline,
} from "@/components/hub";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { cn, formatGreetingDate, formatRelative } from "@/lib/utils";
import type { Project } from "@/types";

const PROGRESS_DISCLAIMER =
  "Evolução estimada do que já foi entregue — não é um prazo contratual.";

function AgoraProximoGrid({ project, embedded }: { project: Project; embedded?: boolean }) {
  const nextSteps = [...project.nextSteps].sort((a, b) => a.order - b.order).slice(0, 4);
  const building = project.currentlyBuilding;
  const articleClass = embedded ? "min-w-0" : "hub-surface p-5";

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", embedded ? "border-t border-[var(--border)] p-5" : "")}>
      <article className={articleClass}>
        <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Agora</p>
        {building ? (
          <>
            <h3 className="mt-1 text-lg font-medium">{building.title}</h3>
            {building.description ? (
              <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-4">{building.description}</p>
            ) : null}
            <div className="mt-4 space-y-2">
              <ProgressBar value={building.progressPct} />
              <p className="text-xs text-[var(--text-muted)]">
                {[building.ownerName, building.etaLabel].filter(Boolean).join(" · ") || "Em desenvolvimento"}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            A equipe ainda não marcou o que está em construção neste momento.
          </p>
        )}
      </article>
      <article className={articleClass}>
        <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Próximo</p>
        {nextSteps[0] ? (
          <ol className="mt-2 space-y-3">
            {nextSteps.map((step) => (
              <li key={step.id}>
                <p className="text-lg font-medium leading-snug">{step.title}</p>
                {step.dueLabel ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{step.dueLabel}</p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            O próximo passo aparece aqui quando for planejado com você.
          </p>
        )}
      </article>
    </div>
  );
}

function SystemProgressCard({
  project,
  showIdentity,
  expanded,
  onToggle,
}: {
  project: Project;
  showIdentity: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const panelId = `system-progress-panel-${project.id}`;
  const label = project.summary || PROGRESS_DISCLAIMER;

  if (!showIdentity) {
    return (
      <section className="space-y-4">
        <div className="hub-surface p-6">
          <ProjectProgress value={project.progressPct} label={label} />
        </div>
        <AgoraProximoGrid project={project} />
      </section>
    );
  }

  return (
    <section className="hub-surface overflow-hidden">
      <div className="flex flex-wrap items-stretch">
        <button
          type="button"
          className="min-h-10 min-w-[16rem] flex-1 p-4 text-left transition-colors duration-fast hover:bg-[var(--bg-hover)] hub-focus sm:p-5"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>
              <StatusBadge status={project.status} />
            </div>
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] motion-safe:transition-transform motion-safe:duration-fast",
                expanded && "rotate-180"
              )}
              aria-hidden
            />
          </div>
          <span className="sr-only">{expanded ? "Ocultar Agora e Próximo" : "Mostrar Agora e Próximo"}</span>
          <ProjectProgress className="mt-4" value={project.progressPct} label={label} />
        </button>
        <div className="flex shrink-0 items-start p-4 sm:p-5">
          <Button variant="accent" size="sm" asChild>
            <Link href={`/client/projects/${project.id}`}>
              Ver projeto
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
      {expanded ? (
        <div id={panelId}>
          <AgoraProximoGrid project={project} embedded />
        </div>
      ) : null}
    </section>
  );
}

export default function ClientDashboardPage() {
  const { hydrated, session, client, clientProjects, projectNames, visibleUpdates, tenantReleases } =
    useClientTenant();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!hydrated) return <PageSkeleton />;

  const firstName = session?.name.split(" ")[0] ?? "Cliente";
  const recentUpdates = visibleUpdates.slice(0, 5);
  const latestRelease = tenantReleases[0];
  const latestVisible = visibleUpdates[0];
  const firstAccess = visibleUpdates.length === 0;
  const multiple = clientProjects.length > 1;
  const single = clientProjects[0];

  if (!single) {
    return (
      <EmptyState
        title="Seu acompanhamento começa aqui"
        description="Quando a equipe vincular um projeto à sua conta, você verá o que está sendo feito agora e o próximo passo — sem números vazios."
      />
    );
  }

  const heading = multiple ? client?.company || "Seus sistemas" : single.name;

  return (
    <div className="mx-auto max-w-4xl space-y-10 animate-fade-in">
      <header className="flex items-start gap-3">
        <div
          className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white shadow-[0_8px_18px_rgba(107,140,255,0.35)]"
          style={{ background: "var(--brand-gradient)" }}
          aria-hidden
        >
          <Home className="h-5 w-5" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 space-y-1">
        <p className="text-sm text-[var(--text-muted)]">
          Olá, {firstName} · {formatGreetingDate()}
        </p>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{heading}</h1>
        {!multiple ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <StatusBadge status={single.status} />
            <span className="text-sm text-[var(--text-secondary)]">
              Evolução estimada · {single.progressPct}%
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-4">
          {!multiple ? (
            <Button variant="accent" size="sm" asChild>
              <Link href={`/client/projects/${single.id}`}>
                Ver projeto
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" asChild>
            <Link href="/client/access">
              <KeyRound className="h-3.5 w-3.5" />
              Acesso ao sistema
            </Link>
          </Button>
        </div>
        </div>
      </header>

      <div className={multiple ? "space-y-3" : undefined}>
        {clientProjects.map((project) => (
          <SystemProgressCard
            key={project.id}
            project={project}
            showIdentity={multiple}
            expanded={expandedId === project.id}
            onToggle={() => setExpandedId((id) => (id === project.id ? null : project.id))}
          />
        ))}
      </div>

      <section>
        <p className="mb-2 text-xs uppercase tracking-wider text-[var(--text-muted)]">Antes</p>
        {firstAccess ? (
          <EmptyState
            title="Ainda não há atualizações publicadas"
            description="Quando a equipe registrar o que mudou, a evolução aparece nesta linha do tempo."
          />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,280px)]">
            <div>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Atualizações recentes
                </h2>
                <Link
                  href="/client/updates"
                  className="text-xs text-[var(--accent)] hover:underline hub-focus rounded-sm"
                >
                  Ver todas
                </Link>
              </div>
              <Timeline items={recentUpdates} projectNames={projectNames} />
              {latestVisible ? (
                <p className="mt-3 text-xs text-[var(--text-muted)]">
                  Última novidade · {formatRelative(latestVisible.createdAt)}
                </p>
              ) : null}
            </div>
            {latestRelease ? (
              <aside>
                <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
                  Última release
                </h2>
                <ReleaseCard release={latestRelease} projectName={projectNames[latestRelease.projectId]} />
                <Link
                  href="/client/releases"
                  className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline"
                >
                  Todas as releases
                </Link>
              </aside>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
