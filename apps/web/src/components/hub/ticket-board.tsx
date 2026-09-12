"use client";

import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { Plus, Rocket, UserRound, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/hub/states";
import { Modal } from "@/components/hub/modal";
import { TicketCard } from "@/components/hub/ticket-card";
import { TicketForm } from "@/components/hub/ticket-form";
import { useHubStore } from "@/stores/hub-store";
import { canMoveTicketStage, CLIENT_TICKET_TYPE_VALUES, isTicketOpen } from "@/lib/tickets";
import { cn } from "@/lib/utils";
import type { Ticket, TicketStage } from "@/types";

const KANBAN_COLUMNS: {
  stage: TicketStage;
  label: string;
  hint?: string;
  icon: typeof Wrench;
  colClass: string;
}[] = [
  { stage: "fix", label: "Correção", icon: Wrench, colClass: "kanban-col-fix" },
  { stage: "production", label: "Produção", icon: Rocket, colClass: "kanban-col-production" },
  { stage: "resolved", label: "Aguardando cliente", icon: UserRound, colClass: "kanban-col-resolved" },
];

function columnLabel(stage: TicketStage): string {
  return KANBAN_COLUMNS.find((c) => c.stage === stage)?.label ?? stage;
}

export function TicketBoard({
  tickets,
  projects,
  mode,
  defaultProjectId,
  emptyDescription,
  highlightStage,
  toolbar,
}: {
  tickets: Ticket[];
  projects: { id: string; name: string }[];
  mode: "client" | "admin";
  defaultProjectId?: string;
  emptyDescription?: string;
  highlightStage?: TicketStage | null;
  toolbar?: ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const names = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const setTicketStage = useHubStore((s) => s.setTicketStage);
  const openTickets = useMemo(() => tickets.filter(isTicketOpen), [tickets]);

  const byStage = useMemo(() => {
    const map: Record<TicketStage, Ticket[]> = {
      fix: [],
      production: [],
      resolved: [],
      closed: [],
    };
    for (const ticket of openTickets) {
      map[ticket.stage].push(ticket);
    }
    return map;
  }, [openTickets]);

  useEffect(() => {
    if (mode !== "admin" || !highlightStage) return;
    const el = document.getElementById(`kanban-col-${highlightStage}`);
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [mode, highlightStage]);

  const tryMove = async (ticketId: string, to: TicketStage) => {
    const ticket = openTickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.stage === to || movingId) return;
    if (to === "closed") {
      toast.error("Só o cliente confirma o encerramento.");
      return;
    }
    if (ticket.stage === "closed" || !canMoveTicketStage(ticket.stage, to)) {
      toast.error("Só um passo por vez.");
      return;
    }
    setMovingId(ticketId);
    try {
      await setTicketStage(ticketId, to);
      toast.success(`Etapa: ${columnLabel(to)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setMovingId(null);
    }
  };

  const onBoardDrop = (e: DragEvent) => {
    e.preventDefault();
    const ticketId =
      e.dataTransfer.getData("text/ticket-id") || e.dataTransfer.getData("text/plain");
    const target = (e.target as HTMLElement).closest("[data-stage]");
    const stage = target?.getAttribute("data-stage") as TicketStage | null;
    if (!ticketId || !stage) return;
    void tryMove(ticketId, stage);
  };

  const toggle = (id: string) => {
    setOpenId((current) => (current === id ? null : id));
  };

  const list =
    openTickets.length === 0 ? (
      <EmptyState
        title="Nenhum chamado em andamento"
        description={
          emptyDescription ?? "Abra o primeiro para acompanhar correções e entregas."
        }
        action={
          <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} disabled={projects.length === 0}>
            Abrir chamado
          </Button>
        }
      />
    ) : (
      <ul className="grid gap-3 lg:grid-cols-2">
        {openTickets.map((ticket) => (
          <li key={ticket.id}>
            <TicketCard
              ticket={ticket}
              expanded={openId === ticket.id}
              onToggle={() => toggle(ticket.id)}
              mode={mode}
              projectName={names[ticket.projectId]}
            />
          </li>
        ))}
      </ul>
    );

  const kanban = (
    <div
      className="overflow-x-auto pb-4"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={onBoardDrop}
    >
      <div className="flex gap-3">
        {KANBAN_COLUMNS.map((col) => {
          const colTickets = byStage[col.stage];
          const highlighted = highlightStage === col.stage;
          return (
            <section
              key={col.stage}
              id={`kanban-col-${col.stage}`}
              data-stage={col.stage}
              aria-label={col.hint ? `${col.label}. ${col.hint}` : col.label}
              className={cn(
                "kanban-col flex w-[280px] shrink-0 flex-col sm:w-[300px]",
                col.colClass,
                highlighted && "ring-2 ring-[var(--accent)]/40"
              )}
            >
              <div className="flex items-center justify-between gap-2 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <col.icon className="kanban-col-title h-3.5 w-3.5 shrink-0" aria-hidden />
                  <h3 className="kanban-col-title truncate text-xs font-semibold uppercase tracking-wider">
                    {col.label}
                  </h3>
                </div>
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--bg-subtle)] px-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  {colTickets.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 px-2 pb-2" data-drop={col.stage}>
                {colTickets.map((ticket) => {
                  const canDrag = ticket.stage !== "closed" && openId !== ticket.id;
                  return (
                    <div key={ticket.id}>
                      <TicketCard
                        ticket={ticket}
                        expanded={openId === ticket.id}
                        onToggle={() => toggle(ticket.id)}
                        mode={mode}
                        projectName={names[ticket.projectId]}
                        dragHandle={canDrag}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex flex-col gap-4",
          toolbar ? "md:flex-row md:items-end md:justify-between" : "items-stretch sm:items-end sm:justify-end"
        )}
      >
        {toolbar ? <div className="min-w-0 flex-1">{toolbar}</div> : null}
        <Button
          variant="accent"
          size="lg"
          className={cn(toolbar ? "w-full shrink-0 md:w-auto" : "w-full sm:w-auto")}
          onClick={() => setFormOpen(true)}
          disabled={projects.length === 0}
        >
          <Plus className="h-4 w-4" />
          Abrir chamado
        </Button>
      </div>

      {mode === "admin" ? (openTickets.length === 0 ? list : kanban) : list}

      <Modal
        open={formOpen}
        onOpenChange={setFormOpen}
        title="Novo chamado"
        description={
          mode === "admin"
            ? "Registre o que o cliente pediu ou abra pelo portal."
            : "Escolha o tipo e descreva o que está acontecendo."
        }
      >
        <TicketForm
          projects={projects}
          defaultProjectId={defaultProjectId}
          showOrigin={mode === "admin"}
          allowedTypes={mode === "client" ? CLIENT_TICKET_TYPE_VALUES : undefined}
          onCreated={() => setFormOpen(false)}
        />
      </Modal>
    </div>
  );
}
