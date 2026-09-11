"use client";

import Link from "next/link";
import { ArrowRight, LayoutGrid } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton, ProgressBar, StatusBadge } from "@/components/hub";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { formatRelative } from "@/lib/utils";

export default function ClientProjectsPage() {
  const { hydrated, clientProjects } = useClientTenant();

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <PageHeader
        icon={LayoutGrid}
        title="Projetos"
        description="Visão consolidada dos projetos vinculados à sua organização."
      />

      {clientProjects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Ainda não há projetos disponíveis para sua conta."
        />
      ) : (
        <ul className="space-y-4">
          {clientProjects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/client/projects/${project.id}`}
                className="hub-surface group block p-5 transition-colors hover:border-[var(--accent)]/40 hub-focus"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-medium group-hover:text-[var(--accent)]">{project.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{project.summary}</p>
                  </div>
                  <StatusBadge status={project.status} />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-xs text-[var(--text-muted)]">
                    <span>{project.progressPct}% concluído</span>
                    <span>{formatRelative(project.updatedAt)}</span>
                  </div>
                  <ProgressBar value={project.progressPct} />
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)]">
                  Abrir detalhes
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {clientProjects.length > 0 ? (
        <Button variant="outline" size="sm" asChild className="mt-2">
          <Link href="/client/access">Credenciais de acesso</Link>
        </Button>
      ) : null}
    </div>
  );
}
