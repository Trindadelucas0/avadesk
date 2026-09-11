"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Headphones } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton, TicketBoard, ClosedTicketsPanel } from "@/components/hub";
import { useHubStore } from "@/stores/hub-store";
import { parseTicketStageParam, parseTicketTypeParam } from "@/lib/admin-overview";
import { isTicketOpen, ticketTypeLabel } from "@/lib/tickets";
import type { TicketType } from "@/types";

function AdminChamadosInner() {
  const tickets = useHubStore((s) => s.tickets);
  const projects = useHubStore((s) => s.projects);
  const searchParams = useSearchParams();
  const stageFromUrl = parseTicketStageParam(searchParams.get("stage"));
  const typeFromUrl = parseTicketTypeParam(searchParams.get("type"));
  const awaitingFromUrl = searchParams.get("awaiting") === "1";

  const [projectId, setProjectId] = useState<string>("ALL");
  const [type, setType] = useState<TicketType | "ALL">(typeFromUrl ?? "ALL");
  const [pending, setPending] = useState<"ALL" | "awaiting">(awaitingFromUrl ? "awaiting" : "ALL");

  useEffect(() => {
    if (typeFromUrl) setType(typeFromUrl);
  }, [typeFromUrl]);

  useEffect(() => {
    if (awaitingFromUrl) setPending("awaiting");
  }, [awaitingFromUrl]);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects]
  );

  const filtered = useMemo(
    () =>
      tickets.filter((t) => {
        if (!isTicketOpen(t)) return false;
        if (projectId !== "ALL" && t.projectId !== projectId) return false;
        if (type !== "ALL" && t.type !== type) return false;
        if (pending === "awaiting" && !t.awaitingReplyFromUserId) return false;
        return true;
      }),
    [tickets, projectId, type, pending]
  );

  const highlightStage = stageFromUrl === "closed" ? null : stageFromUrl;
  const closedProjectId = projectId === "ALL" ? undefined : projectId;

  return (
    <div>
      <PageHeader
        icon={Headphones}
        title="Chamados"
        description="Acompanhe os cards um passo: Correção → Produção → Aguardando cliente. Encerrados ficam em Concluídos, por data."
      />

      {projects.length === 0 ? (
        <EmptyState title="Nenhum projeto" description="Crie um projeto antes de registrar chamados." />
      ) : (
        <>
          <TicketBoard
            tickets={filtered}
            projects={projectOptions}
            mode="admin"
            highlightStage={highlightStage}
            defaultProjectId={closedProjectId}
            emptyDescription={
              type !== "ALL" || pending === "awaiting"
                ? `Nenhum chamado${type !== "ALL" ? ` do tipo ${ticketTypeLabel(type)}` : ""}${pending === "awaiting" ? " aguardando resposta" : ""}.`
                : undefined
            }
            toolbar={
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="admin-ticket-project" className="text-sm font-medium text-[var(--text-secondary)]">
                    Projeto
                  </label>
                  <select
                    id="admin-ticket-project"
                    className="mt-1.5 hub-control"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                  >
                    <option value="ALL">Todos</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-ticket-type" className="text-sm font-medium text-[var(--text-secondary)]">
                    Tipo
                  </label>
                  <select
                    id="admin-ticket-type"
                    className="mt-1.5 hub-control"
                    value={type}
                    onChange={(e) => setType(e.target.value as TicketType | "ALL")}
                  >
                    <option value="ALL">Todos</option>
                    <option value="bug">{ticketTypeLabel("bug")}</option>
                    <option value="implementation">{ticketTypeLabel("implementation")}</option>
                    <option value="feature">{ticketTypeLabel("feature")}</option>
                    <option value="routine">{ticketTypeLabel("routine")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="admin-ticket-pending" className="text-sm font-medium text-[var(--text-secondary)]">
                    Pendência
                  </label>
                  <select
                    id="admin-ticket-pending"
                    className="mt-1.5 hub-control"
                    value={pending}
                    onChange={(e) => setPending(e.target.value as "ALL" | "awaiting")}
                  >
                    <option value="ALL">Todas</option>
                    <option value="awaiting">Aguardando resposta</option>
                  </select>
                </div>
              </div>
            }
          />
          <div className="mt-6">
            <ClosedTicketsPanel
              mode="admin"
              projects={projectOptions}
              projectId={closedProjectId}
              defaultOpen={stageFromUrl === "closed"}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default function AdminChamadosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminChamadosInner />
    </Suspense>
  );
}
