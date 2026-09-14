"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/hub/states";
import { TicketCard } from "@/components/hub/ticket-card";
import { useHubStore } from "@/stores/hub-store";
import {
  closedDateRangeError,
  firstDayOfMonthLocal,
  isoDateLocal,
} from "@/lib/tickets";
import { cn } from "@/lib/utils";
import type { Ticket } from "@/types";

export function ClosedTicketsPanel({
  mode,
  projects,
  projectId,
  defaultOpen = false,
}: {
  mode: "client" | "admin";
  projects: { id: string; name: string }[];
  projectId?: string;
  defaultOpen?: boolean;
}) {
  const listClosedTickets = useHubStore((s) => s.listClosedTickets);
  const ticketStamp = useHubStore((s) =>
    s.tickets.map((t) => `${t.id}:${t.updatedAt}`).join("|")
  );
  const names = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  const [open, setOpen] = useState(defaultOpen);
  const [from, setFrom] = useState(firstDayOfMonthLocal);
  const [to, setTo] = useState(isoDateLocal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [searched, setSearched] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const fromId = useId();
  const toId = useId();
  const appliedRef = useRef<{ from: string; to: string } | null>(null);
  const autoStarted = useRef(false);

  const runQuery = useCallback(
    async (range: { from: string; to: string }) => {
      const invalid = closedDateRangeError(range.from, range.to);
      if (invalid) {
        setError(invalid);
        setSearched(false);
        appliedRef.current = null;
        return;
      }
      setLoading(true);
      setError(null);
      const result = await listClosedTickets({
        from: range.from,
        to: range.to,
        projectId,
      });
      setLoading(false);
      if (!result.ok) {
        setError(result.error);
        setSearched(true);
        setTickets([]);
        return;
      }
      appliedRef.current = range;
      setTickets(result.tickets);
      setSearched(true);
    },
    [listClosedTickets, projectId]
  );

  useEffect(() => {
    if (!defaultOpen || autoStarted.current) return;
    autoStarted.current = true;
    setOpen(true);
    void runQuery({ from: firstDayOfMonthLocal(), to: isoDateLocal() });
  }, [defaultOpen, runQuery]);

  useEffect(() => {
    if (!appliedRef.current) return;
    void runQuery(appliedRef.current);
  }, [projectId, ticketStamp, runQuery]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void runQuery({ from, to });
  };

  return (
    <section className="kanban-col kanban-col-closed overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hub-focus"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-3">
          <CheckCircle2 className="kanban-col-title h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="kanban-col-title block text-sm font-medium">Concluídos</span>
            <span className="mt-0.5 block text-xs text-[var(--text-muted)]">
              Consultar por data de confirmação do cliente
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-[var(--border)] px-4 py-4">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <Label htmlFor={fromId}>De</Label>
              <Input
                id={fromId}
                type="date"
                className="mt-1.5"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor={toId}>Até</Label>
              <Input
                id={toId}
                type="date"
                className="mt-1.5"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <Button type="submit" variant="outline" disabled={loading} className="w-full sm:w-auto">
              {loading ? "Buscando…" : "Consultar"}
            </Button>
          </form>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          {loading && !searched ? (
            <p className="text-sm text-[var(--text-muted)]" aria-busy="true">
              Buscando…
            </p>
          ) : null}

          {searched && !error && tickets.length === 0 ? (
            <EmptyState
              className="py-10"
              title="Nenhum chamado concluído neste período"
              description="Ajuste as datas De e Até e consulte de novo."
            />
          ) : null}

          {tickets.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">
                Encerrados no período: {tickets.length}
              </p>
              <ul className="grid gap-3 lg:grid-cols-2">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <TicketCard
                      ticket={ticket}
                      expanded={openId === ticket.id}
                      onToggle={() => setOpenId((current) => (current === ticket.id ? null : ticket.id))}
                      mode={mode}
                      projectName={names[ticket.projectId]}
                      onDeleted={(id) => {
                        setTickets((current) => current.filter((item) => item.id !== id));
                        setOpenId((current) => (current === id ? null : current));
                      }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {!searched && !loading && !error ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Informe o intervalo e toque em Consultar. A lista principal continua só com o que ainda não foi
              encerrado.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
