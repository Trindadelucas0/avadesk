"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/hub/filter-table";
import { Modal } from "@/components/hub/modal";
import { PageHeader } from "@/components/hub/page-header";
import { ProgressBar } from "@/components/hub/progress";
import { StatusBadge } from "@/components/hub/status-badge";
import { EmptyState } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import type { ProjectStatus } from "@/types";
import { PROJECT_STATUSES } from "@/lib/project-attention";
import { formatRelative, statusLabel } from "@/lib/utils";

const STATUSES: ProjectStatus[] = PROJECT_STATUSES;

export default function AdminProjectsPage() {
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const upsertProject = useHubStore((s) => s.upsertProject);
  const isStale = useHubStore((s) => s.isStale);

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients]
  );

  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<ProjectStatus>("planning");
  const [summary, setSummary] = useState("");

  const openCreate = () => {
    setClientId(clients[0]?.id ?? "");
    setOpen(true);
  };

  const submit = async () => {
    if (!clientId || !name.trim()) {
      toast.error(
        clients.length === 0
          ? "Crie um cliente antes de criar o projeto."
          : "Selecione cliente e nome."
      );
      return;
    }
    await upsertProject({
      clientId,
      name: name.trim(),
      status,
      summary: summary.trim(),
    });
    toast.success("Projeto criado");
    setName("");
    setSummary("");
    setStatus("planning");
    setOpen(false);
  };

  const rows = projects.map((p) => ({
    name: (
      <Link href={`/admin/projects/${p.id}`} className="font-medium hover:text-[var(--accent)]">
        {p.name}
      </Link>
    ),
    client: clientMap[p.clientId] ?? "—",
    status: (
      <div className="flex flex-wrap gap-1">
        <StatusBadge status={p.status} />
        {isStale(p.id) ? <StatusBadge stale /> : null}
      </div>
    ),
    progress: (
      <div className="flex items-center gap-2">
        <ProgressBar value={p.progressPct} size="sm" className="max-w-[88px]" />
        <span className="text-xs tabular-nums">{p.progressPct}%</span>
      </div>
    ),
    updated: formatRelative(p.updatedAt),
  }));

  return (
    <div>
      <PageHeader
        icon={LayoutGrid}
        title="Projetos"
        description="Pipeline e saúde de entrega."
        actions={
          <Button variant="accent" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Novo projeto
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: "name", header: "Projeto" },
          { key: "client", header: "Cliente" },
          { key: "status", header: "Status" },
          { key: "progress", header: "Progresso" },
          { key: "updated", header: "Atualizado" },
        ]}
        rows={rows}
        empty={
          <EmptyState
            title="Nenhum projeto"
            description={
              clients.length === 0
                ? "Crie um cliente em Clientes antes de criar o primeiro projeto."
                : undefined
            }
            action={
              clients.length === 0 ? (
                <Button variant="accent" size="sm" asChild>
                  <Link href="/admin/clients">Criar cliente</Link>
                </Button>
              ) : (
                <Button variant="accent" size="sm" onClick={openCreate}>
                  Criar projeto
                </Button>
              )
            }
          />
        }
      />

      <Modal open={open} onOpenChange={setOpen} title="Novo projeto" description="Vincule a um cliente existente.">
        <div className="space-y-4">
          <div>
            <Label htmlFor="pr-client">Cliente</Label>
            {clients.length === 0 ? (
              <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
                Nenhum cliente ainda.{" "}
                <Link href="/admin/clients" className="text-[var(--accent)] hover:underline">
                  Criar cliente
                </Link>
              </p>
            ) : (
              <select
                id="pr-client"
                className="mt-1.5 hub-control"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <Label htmlFor="pr-name">Nome</Label>
            <Input id="pr-name" className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pr-status">Status inicial</Label>
            <select
              id="pr-status"
              className="mt-1.5 hub-control"
              value={status}
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
            <Label htmlFor="pr-summary">Resumo</Label>
            <Input
              id="pr-summary"
              className="mt-1.5"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={() => void submit()}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
