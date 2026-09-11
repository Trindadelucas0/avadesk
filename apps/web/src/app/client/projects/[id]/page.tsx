"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText, KeyRound, Ticket } from "lucide-react";
import {
  ClosedTicketsPanel,
  EmptyState,
  ErrorState,
  PageSkeleton,
  ProgressBar,
  ProjectHeader,
  StatusBadge,
  TicketBoard,
  Timeline,
} from "@/components/hub";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { isTicketOpen } from "@/lib/tickets";
import { statusLabel } from "@/lib/utils";

export default function ClientProjectDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { hydrated, clientProjects, projectNames, visibleUpdates, tickets } = useClientTenant();

  if (!hydrated) return <PageSkeleton />;

  const project = clientProjects.find((p) => p.id === id);

  if (!project) {
    return (
      <ErrorState
        title="Projeto não encontrado"
        description="Este projeto não existe ou não está disponível para sua conta."
        onRetry={() => window.history.back()}
      />
    );
  }

  const projectUpdates = visibleUpdates.filter((u) => u.projectId === project.id).slice(0, 5);
  const nextSteps = [...project.nextSteps].sort((a, b) => a.order - b.order);
  const building = project.currentlyBuilding;

  return (
    <div className="mx-auto max-w-3xl space-y-8 animate-fade-in">
      <ProjectHeader
        name={project.name}
        status={<StatusBadge status={project.status} />}
        progress={project.progressPct}
        meta={statusLabel(project.status)}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="accent" size="sm" asChild>
              <Link href="/client/access">
                <KeyRound className="h-3.5 w-3.5" />
                Acesso
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/client/chamados">
                <Ticket className="h-3.5 w-3.5" />
                Chamados
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/client/files?project=${project.id}`}>
                <FileText className="h-3.5 w-3.5" />
                Arquivos
              </Link>
            </Button>
          </div>
        }
      />

      {project.summary ? (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{project.summary}</p>
      ) : null}

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Chamados
        </h2>
        <div className="space-y-6">
          <TicketBoard
            tickets={tickets.filter((t) => t.projectId === project.id && isTicketOpen(t))}
            projects={[{ id: project.id, name: project.name }]}
            mode="client"
            defaultProjectId={project.id}
          />
          <ClosedTicketsPanel
            mode="client"
            projects={[{ id: project.id, name: project.name }]}
            projectId={project.id}
          />
        </div>
      </section>

      {project.modules.length > 0 ? (
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Módulos
          </h2>
          <ul className="space-y-4">
            {project.modules.map((mod) => (
              <li key={mod.id} className="hub-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{mod.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {mod.ownerName} · {statusLabel(mod.status)}
                    </p>
                  </div>
                  <span className="text-xs text-[var(--text-muted)]">{mod.progressPct}%</span>
                </div>
                <ProgressBar value={mod.progressPct} className="mt-3" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {building ? (
        <section className="hub-surface p-5">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Em construção</p>
          <h2 className="mt-1 text-lg font-medium">{building.title}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{building.description}</p>
          <ProgressBar value={building.progressPct} className="mt-4" />
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {building.ownerName} · {building.etaLabel}
          </p>
        </section>
      ) : null}

      {nextSteps.length > 0 ? (
        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Próximos passos
          </h2>
          <ol className="space-y-2">
            {nextSteps.map((step) => (
              <li
                key={step.id}
                className="flex gap-3 rounded-md border border-[var(--border)] px-4 py-3 text-sm"
              >
                <span className="font-mono text-[var(--accent)]">
                  {String(step.order).padStart(2, "0")}
                </span>
                <span>{step.title}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Updates recentes
          </h2>
          <Link href="/client/updates" className="text-xs text-[var(--accent)] hover:underline">
            Ver todos
          </Link>
        </div>
        {projectUpdates.length > 0 ? (
          <Timeline
            items={projectUpdates}
            projectNames={projectNames}
            detailBase="/client/projects"
            updatesHref="/client/updates"
          />
        ) : (
          <EmptyState title="Sem updates" description="Nenhuma atualização publicada para este projeto." />
        )}
      </section>
    </div>
  );
}
