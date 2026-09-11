"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Rocket, Ticket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, ProjectHeader } from "@/components/hub/page-header";
import { ProgressBar } from "@/components/hub/progress";
import { StatusBadge } from "@/components/hub/status-badge";
import { Timeline } from "@/components/hub/timeline";
import { EmptyState } from "@/components/hub/states";
import { ClosedTicketsPanel } from "@/components/hub/closed-tickets-panel";
import { useHubStore } from "@/stores/hub-store";
import type { ProjectStatus } from "@/types";
import { PROJECT_STATUSES } from "@/lib/project-attention";
import { isTicketOpen } from "@/lib/tickets";
import { formatRelative, statusLabel } from "@/lib/utils";

const STATUSES = PROJECT_STATUSES;

export default function AdminProjectDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const project = useHubStore((s) => s.projects.find((p) => p.id === id));
  const clients = useHubStore((s) => s.clients);
  const updates = useHubStore((s) => s.updates);
  const tickets = useHubStore((s) => s.tickets);
  const upsertProject = useHubStore((s) => s.upsertProject);
  const isStale = useHubStore((s) => s.isStale);
  const session = useHubStore((s) => s.session);

  const [progressPct, setProgressPct] = useState<number | null>(null);
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  const client = clients.find((c) => c.id === project?.clientId);
  const projectUpdates = useMemo(
    () =>
      updates
        .filter((u) => u.projectId === id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [updates, id]
  );

  const currentProgress = progressPct ?? project?.progressPct ?? 0;
  const currentStatus = status ?? project?.status ?? "planning";

  if (!project) {
    return (
      <EmptyState
        title="Projeto não encontrado"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/projects">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const save = async () => {
    await upsertProject({
      id: project.id,
      clientId: project.clientId,
      name: project.name,
      progressPct: currentProgress,
      status: currentStatus,
    });
    toast.success("Projeto atualizado");
  };

  const stale = isStale(project.id);

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/admin/projects">
          <ArrowLeft className="h-4 w-4" />
          Projetos
        </Link>
      </Button>

      <ProjectHeader
        name={project.name}
        status={
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={project.status} />
            {stale ? <StatusBadge stale /> : null}
          </div>
        }
        progress={project.progressPct}
        meta={client ? `${client.name} · ${formatRelative(project.updatedAt)}` : undefined}
      />

      <div className="mb-8 flex flex-wrap items-center gap-2 hub-surface px-4 py-3 text-sm text-[var(--text-secondary)]">
        <Rocket className="h-4 w-4 text-[var(--accent)]" aria-hidden />
        Use <strong className="font-medium text-[var(--text-primary)]">Quick Update</strong> na barra ou ⌘K para
        publicar novidades deste projeto.
        <span className="flex flex-wrap gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/access?project=${project.id}`}>Acesso</Link>
          </Button>
          {session?.role === "ADMIN" ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/environments?project=${project.id}`}>Ambientes</Link>
            </Button>
          ) : null}
        </span>
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Chamados
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/chamados">
              <Ticket className="h-3.5 w-3.5" />
              Ver todos
            </Link>
          </Button>
        </div>
        {tickets.filter((t) => t.projectId === project.id && isTicketOpen(t)).length === 0 ? (
          <EmptyState
            title="Nenhum chamado em andamento"
            description="Abra a partir do relato do cliente em Chamados. Encerrados ficam em Concluídos, por data."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/chamados">Abrir chamado</Link>
              </Button>
            }
          />
        ) : (
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            {tickets.filter((t) => t.projectId === project.id && isTicketOpen(t)).length} chamado(s) em
            andamento neste projeto.{" "}
            <Link href="/admin/chamados" className="text-[var(--accent)] hover:underline">
              Gerenciar etapas
            </Link>
          </p>
        )}
        <ClosedTicketsPanel
          mode="admin"
          projects={[{ id: project.id, name: project.name }]}
          projectId={project.id}
        />
      </section>

      <section className="hub-surface mb-10 p-4">
        <h2 className="mb-4 text-sm font-medium">Editar status e progresso</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pd-status">Status</Label>
            <select
              id="pd-status"
              className="mt-1.5 hub-control"
              value={currentStatus}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pd-progress">Progresso (%)</Label>
            <Input
              id="pd-progress"
              type="number"
              min={0}
              max={100}
              className="mt-1.5"
              value={currentProgress}
              onChange={(e) => setProgressPct(Number(e.target.value))}
            />
            <ProgressBar value={currentProgress} className="mt-2" size="sm" />
          </div>
        </div>
        <Button variant="accent" size="sm" className="mt-4" onClick={save}>
          Salvar alterações
        </Button>
      </section>

      {project.summary ? (
        <p className="mb-8 text-sm text-[var(--text-secondary)]">{project.summary}</p>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Módulos</h2>
        {project.modules.length === 0 ? (
          <EmptyState title="Sem módulos cadastrados" />
        ) : (
          <ul className="space-y-2">
            {project.modules.map((m) => (
              <li
                key={m.id}
                className="hub-surface flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">{m.ownerName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={m.status} />
                  <span className="text-xs tabular-nums">{m.progressPct}%</span>
                  <ProgressBar value={m.progressPct} size="sm" className="w-24" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <PageHeader title="Updates" description="Histórico deste projeto." className="mb-4" />
        {projectUpdates.length === 0 ? (
          <EmptyState title="Nenhum update" description="Publique via Quick Update." />
        ) : (
          <Timeline
            items={projectUpdates}
            projectNames={{ [project.id]: project.name }}
            clientNames={client?.company || client?.name ? { [project.id]: client.company || client.name } : undefined}
            showVisibility
            detailBase="/admin/projects"
            updatesHref="/admin/updates"
          />
        )}
      </section>
    </div>
  );
}
