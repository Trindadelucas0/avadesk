"use client";

import { Check, ChevronDown, GripVertical, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TicketForm } from "@/components/hub/ticket-form";
import { useHubStore } from "@/stores/hub-store";
import type { Ticket, TicketStage, User } from "@/types";
import { cn, formatRelative } from "@/lib/utils";
import {
  PIPELINE_STAGES,
  canEditTicketContent,
  canMoveTicketStage,
  originLabel,
  stageIndex,
  ticketFieldDefs,
  ticketStageLabels,
  ticketTypeLabel,
  ticketAttachmentUrl,
} from "@/lib/tickets";

function StepIcon({
  state,
  label,
}: {
  state: "done" | "current" | "pending";
  label: string;
}) {
  if (state === "done") {
    return (
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success)] text-[var(--bg-base)]"
        aria-label={`${label} concluído`}
      >
        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center" aria-label={`Em ${label}`}>
        <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border)]"
      aria-label={`${label} pendente`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-muted)]" />
    </span>
  );
}

function typeBadgeClass(type: Ticket["type"]) {
  switch (type) {
    case "bug":
      return "border-[rgba(240,113,120,0.35)] bg-[rgba(240,113,120,0.12)] text-[var(--danger)]";
    case "feature":
      return "border-[rgba(61,220,151,0.35)] bg-[rgba(61,220,151,0.12)] text-[var(--success)]";
    case "implementation":
      return "border-[rgba(167,139,250,0.4)] bg-[rgba(167,139,250,0.12)] text-[#c4b5fd]";
    default:
      return "border-[rgba(245,185,66,0.35)] bg-[rgba(245,185,66,0.12)] text-[var(--warning)]";
  }
}

function ticketSnippet(ticket: Ticket): string {
  for (const field of ticketFieldDefs(ticket.type)) {
    const raw = ticket.fields[field.key];
    const value = typeof raw === "string" ? raw.trim() : "";
    if (value) return value;
  }
  return "";
}

function stageCardClass(stage: TicketStage) {
  if (stage === "production") return "ticket-card-production";
  if (stage === "resolved") return "ticket-card-resolved";
  if (stage === "closed") return "ticket-card-closed";
  return "ticket-card-fix";
}

function stageChipClass(stage: TicketStage) {
  if (stage === "production") return "bg-[rgba(167,139,250,0.14)] text-[#c4b5fd]";
  if (stage === "resolved") return "bg-[rgba(245,185,66,0.14)] text-[var(--warning)]";
  if (stage === "closed") return "bg-[rgba(61,220,151,0.14)] text-[var(--success)]";
  return "bg-[var(--accent-muted)] text-[var(--accent)]";
}

export function TicketCard({
  ticket,
  expanded,
  onToggle,
  mode,
  projectName,
  dragHandle,
  compact,
}: {
  ticket: Ticket;
  expanded: boolean;
  onToggle: () => void;
  mode: "client" | "admin";
  projectName?: string;
  dragHandle?: boolean;
  compact?: boolean;
}) {
  const session = useHubStore((s) => s.session);
  const users = useHubStore((s) => s.users);
  const projects = useHubStore((s) => s.projects);
  const confirmTicket = useHubStore((s) => s.confirmTicket);
  const reopenTicket = useHubStore((s) => s.reopenTicket);
  const setTicketStage = useHubStore((s) => s.setTicketStage);
  const postTicketMessage = useHubStore((s) => s.postTicketMessage);
  const [busy, setBusy] = useState(false);
  const [reopenNote, setReopenNote] = useState("");
  const [showReopen, setShowReopen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [messageBody, setMessageBody] = useState("");
  const [waitForUserId, setWaitForUserId] = useState("");
  const canEdit = canEditTicketContent(ticket, session?.id);

  const project = projects.find((p) => p.id === ticket.projectId);
  const recipients = useMemo(() => {
    return users.filter((u: User) => {
      if (u.role !== "CLIENT" || !u.active) return false;
      if (project && u.clientId !== project.clientId) return false;
      if (
        u.accessAllProjects ||
        u.projectIds.includes(ticket.projectId) ||
        u.id === ticket.createdByUserId ||
        u.id === ticket.awaitingReplyFromUserId
      ) {
        return true;
      }
      return false;
    });
  }, [
    users,
    project,
    ticket.projectId,
    ticket.createdByUserId,
    ticket.awaitingReplyFromUserId,
  ]);

  useEffect(() => {
    if (!expanded) setEditing(false);
  }, [expanded]);

  useEffect(() => {
    const preferred =
      ticket.awaitingReplyFromUserId || ticket.createdByUserId || recipients[0]?.id || "";
    setWaitForUserId((current) => {
      if (current && recipients.some((r) => r.id === current)) return current;
      if (preferred && recipients.some((r) => r.id === preferred)) return preferred;
      return recipients[0]?.id ?? "";
    });
  }, [ticket.id, ticket.awaitingReplyFromUserId, ticket.createdByUserId, recipients]);

  const labels = ticketStageLabels(ticket.type);
  const idx = stageIndex(ticket.stage);
  const panelId = `ticket-panel-${ticket.id}`;
  const waitingConfirm = ticket.stage === "resolved";
  const closed = ticket.stage === "closed";

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setShowReopen(false);
      setReopenNote("");
      setMessageBody("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar.");
    } finally {
      setBusy(false);
    }
  };

  const snippet = compact ? ticketSnippet(ticket) : "";
  const currentStageLabel = ticket.stage === "closed" ? "Concluído" : labels[ticket.stage];

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border shadow-[0_10px_24px_rgba(0,0,0,0.28)]",
        stageCardClass(ticket.stage)
      )}
    >
      <h3 className="sr-only">{ticket.title}</h3>
      <div className="flex items-start">
      {dragHandle ? (
        <span
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("text/ticket-id", ticket.id);
            e.dataTransfer.setData("text/plain", ticket.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={(e) => e.stopPropagation()}
          className="flex shrink-0 cursor-grab items-start px-1.5 py-3 text-[var(--text-muted)] active:cursor-grabbing"
          aria-label="Arrastar chamado"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </span>
      ) : null}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left hub-focus"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{ticket.title}</span>
            <span
              className={cn(
                "shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                typeBadgeClass(ticket.type)
              )}
            >
              {ticketTypeLabel(ticket.type)}
            </span>
            {closed ? (
              <span className="shrink-0 text-[10px] font-medium uppercase text-[var(--success)]">OK</span>
            ) : null}
            {ticket.awaitingReplyFromUserId ? (
              <span className="shrink-0 rounded-md border border-[var(--accent)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                Aguardando resposta {ticket.awaitingReplyFromName || "cliente"}
              </span>
            ) : null}
          </div>
          {compact && snippet && !expanded ? (
            <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-muted)]">{snippet}</p>
          ) : null}
          {compact && !expanded ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)]">
              {projectName ? <span>{projectName}</span> : null}
              {ticket.createdByName ? <span>· {ticket.createdByName}</span> : null}
              <span>· {formatRelative(ticket.createdAt)}</span>
            </div>
          ) : null}
          {compact && !expanded ? (
            <span
              className={cn(
                "mt-2 inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium",
                stageChipClass(ticket.stage)
              )}
            >
              {currentStageLabel}
            </span>
          ) : null}
          {!compact ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[var(--text-secondary)]">
              {PIPELINE_STAGES.map((stage, i) => {
                const state: "done" | "current" | "pending" =
                  closed || i < idx ? "done" : i === idx ? "current" : "pending";
                return (
                  <span key={stage} className="inline-flex items-center gap-1.5">
                    <StepIcon state={state} label={labels[stage]} />
                    <span className={cn(state === "pending" && "text-[var(--text-muted)]")}>
                      {labels[stage]}
                    </span>
                  </span>
                );
              })}
              {waitingConfirm && !expanded ? (
                <span className="text-[var(--accent)]">Toque para confirmar</span>
              ) : null}
              {closed ? <span>Confirmado</span> : null}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      </div>

      {expanded ? (
        <div id={panelId} className="space-y-4 border-t border-[var(--border)] px-3 py-3">
          <p className="text-xs text-[var(--text-muted)]">
            Aberto por {ticket.createdByName || "alguém"} · {formatRelative(ticket.createdAt)} · origem{" "}
            {originLabel(ticket.origin)}
            {projectName ? ` · ${projectName}` : null}
          </p>

          {editing ? (
            <div onClick={(e) => e.stopPropagation()}>
              <p className="mb-3 text-sm font-medium">Editar chamado</p>
              <TicketForm
                ticket={ticket}
                onCancel={() => setEditing(false)}
                onSaved={() => setEditing(false)}
              />
            </div>
          ) : (
            <>
              <dl className="space-y-3">
                {ticketFieldDefs(ticket.type).map((field) => {
                  const raw = ticket.fields[field.key];
                  const value = typeof raw === "string" ? raw.trim() : "";
                  if (!value) return null;
                  return (
                    <div key={field.key}>
                      <dt className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                        {field.label}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{value}</dd>
                    </div>
                  );
                })}
              </dl>
              {(ticket.attachments ?? []).length > 0 ? (
                <div>
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                    Imagens
                  </p>
                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {(ticket.attachments ?? []).map((att) => (
                      <li key={att.id}>
                        <a
                          href={ticketAttachmentUrl(ticket.id, att.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="block hub-focus rounded-md"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={ticketAttachmentUrl(ticket.id, att.id)}
                            alt={att.originalName || "Imagem do chamado"}
                            className="h-24 w-full rounded-md border border-[var(--border)] object-cover"
                          />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                >
                  Editar
                </Button>
              ) : null}
            </>
          )}

          {!editing && (ticket.events ?? []).length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Histórico
              </p>
              <ol className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                {(ticket.events ?? []).map((ev) => (
                  <li key={ev.id}>
                    {formatRelative(ev.createdAt)} ·{" "}
                    {!ev.fromStage && ev.toStage === "fix"
                      ? "Aberto"
                      : ev.toStage === "closed"
                        ? "Confirmado"
                        : labels[ev.toStage as "fix"] ?? ev.toStage}
                    {ev.actorName ? ` · ${ev.actorName}` : ""}
                    {ev.note && ev.note !== "open" && ev.note !== "confirm" && ev.note !== "reopen"
                      ? ` — ${ev.note}`
                      : ""}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {!editing && (ticket.messages ?? []).length > 0 ? (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                Conversa
              </p>
              <ul className="space-y-2">
                {(ticket.messages ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2"
                  >
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {m.actorName || (m.kind === "request" ? "Time" : "Cliente")} ·{" "}
                      {formatRelative(m.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-secondary)]">{m.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!editing && mode === "client" && ticket.awaitingReplyFromUserId ? (
            <p className="text-sm text-[var(--accent)]">Pendência: o time espera sua resposta.</p>
          ) : null}

          {!editing && mode === "admin" && !closed ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Label htmlFor={`ask-${ticket.id}`} className="text-sm font-medium">
                Pedir informação ao cliente
              </Label>
              {recipients.length > 1 ? (
                <div>
                  <Label htmlFor={`wait-${ticket.id}`} className="text-xs text-[var(--text-muted)]">
                    Destinatário
                  </Label>
                  <select
                    id={`wait-${ticket.id}`}
                    className="mt-1 flex hub-control"
                    value={waitForUserId}
                    onChange={(e) => setWaitForUserId(e.target.value)}
                  >
                    {recipients.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name || u.email}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <Textarea
                id={`ask-${ticket.id}`}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                maxLength={4000}
                placeholder="O que falta para avançar…"
              />
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={busy || !messageBody.trim() || recipients.length === 0}
                onClick={() =>
                  void run(
                    () =>
                      postTicketMessage(
                        ticket.id,
                        messageBody.trim(),
                        waitForUserId || undefined
                      ),
                    "Pedido enviado. Aguardando resposta."
                  )
                }
              >
                Enviar e aguardar resposta
              </Button>
              {recipients.length === 0 ? (
                <p className="text-xs text-[var(--danger)]">Não há usuário cliente neste projeto.</p>
              ) : null}
            </div>
          ) : null}

          {!editing && mode === "client" && !closed ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <Label htmlFor={`reply-${ticket.id}`} className="text-sm font-medium">
                {ticket.awaitingReplyFromUserId ? "Sua resposta" : "Complementar"}
              </Label>
              <Textarea
                id={`reply-${ticket.id}`}
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                maxLength={4000}
              />
              <Button
                variant="accent"
                className="w-full sm:w-auto"
                disabled={busy || !messageBody.trim()}
                onClick={() =>
                  void run(
                    () => postTicketMessage(ticket.id, messageBody.trim()),
                    "Resposta enviada. O time foi avisado."
                  )
                }
              >
                Enviar resposta
              </Button>
            </div>
          ) : null}

          {closed && ticket.clientConfirmedAt ? (
            <p className="text-xs text-[var(--success)]">
              Confirmado {formatRelative(ticket.clientConfirmedAt)}
            </p>
          ) : null}

          {!editing && mode === "client" && waitingConfirm ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="accent"
                size="lg"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  void run(() => confirmTicket(ticket.id), "Confirmado. Obrigado.");
                }}
              >
                Confirmar que {ticket.type === "bug" ? "o bug foi resolvido" : "está ok"}
              </Button>
              <Button
                variant="danger"
                size="lg"
                className="w-full sm:w-auto"
                disabled={busy}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReopen((v) => !v);
                }}
              >
                Ainda não está ok
              </Button>
            </div>
          ) : null}

          {!editing && mode === "client" && waitingConfirm && showReopen ? (
            <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
              <div>
                <Label
                  htmlFor={`reopen-${ticket.id}`}
                  className="text-base font-semibold text-[var(--text-primary)]"
                >
                  O que ainda não está ok?
                </Label>
                <p className="mt-1 text-sm text-[var(--danger)]">
                  O chamado volta para Correção e o time é avisado.
                </p>
              </div>
              <Textarea
                id={`reopen-${ticket.id}`}
                value={reopenNote}
                onChange={(e) => setReopenNote(e.target.value)}
                maxLength={2000}
              />
              <Button
                variant="danger"
                className="w-full sm:w-auto"
                disabled={busy || !reopenNote.trim()}
                onClick={() =>
                  void run(
                    () => reopenTicket(ticket.id, reopenNote.trim()),
                    "Chamado reaberto. O time volta para a correção."
                  )
                }
              >
                Reabrir chamado
              </Button>
            </div>
          ) : null}

          {!editing && mode === "admin" && !closed ? (
            <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
              {PIPELINE_STAGES.map((stage) => {
                const active = ticket.stage === stage;
                const allowed = canMoveTicketStage(ticket.stage, stage);
                return (
                  <Button
                    key={stage}
                    size="sm"
                    variant={active ? "accent" : "outline"}
                    disabled={busy || active || !allowed}
                    onClick={() =>
                      void run(
                        () => setTicketStage(ticket.id, stage as TicketStage),
                        `Etapa: ${labels[stage]}`
                      )
                    }
                  >
                    {labels[stage]}
                  </Button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
