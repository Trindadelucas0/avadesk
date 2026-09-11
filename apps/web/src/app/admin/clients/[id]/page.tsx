"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ClientDataFields,
  clientDataError,
  clientDataPayload,
  clientToFormValues,
  type ClientDataValues,
} from "@/components/hub/client-data-fields";
import { DataTable } from "@/components/hub/filter-table";
import { PageHeader } from "@/components/hub/page-header";
import { ProgressBar } from "@/components/hub/progress";
import { StatusBadge } from "@/components/hub/status-badge";
import { EmptyState } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import { ApiError } from "@/lib/v2-client";
import { formatDate, formatRelative } from "@/lib/utils";

export default function AdminClientDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const client = useHubStore((s) => s.clients.find((c) => c.id === id));
  const allProjects = useHubStore((s) => s.projects);
  const isStale = useHubStore((s) => s.isStale);
  const upsertClient = useHubStore((s) => s.upsertClient);

  const [form, setForm] = useState<ClientDataValues | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (client) setForm(clientToFormValues(client));
  }, [client]);

  const projects = useMemo(
    () => allProjects.filter((p) => p.clientId === id),
    [allProjects, id]
  );

  const rows = useMemo(
    () =>
      projects.map((p) => ({
        name: (
          <Link href={`/admin/projects/${p.id}`} className="font-medium hover:text-[var(--accent)]">
            {p.name}
          </Link>
        ),
        status: (
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={p.status} />
            {isStale(p.id) ? <StatusBadge stale /> : null}
          </div>
        ),
        progress: (
          <div className="flex items-center gap-2">
            <ProgressBar value={p.progressPct} size="sm" className="max-w-[100px]" />
            <span className="text-xs text-[var(--text-muted)]">{p.progressPct}%</span>
          </div>
        ),
        updated: formatRelative(p.updatedAt),
      })),
    [projects, isStale]
  );

  if (!client) {
    return (
      <EmptyState
        title="Cliente não encontrado"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/clients">Voltar</Link>
          </Button>
        }
      />
    );
  }

  const subtitle = [client.company, client.segment].filter(Boolean).join(" · ");

  const save = async () => {
    if (!form) return;
    const error = clientDataError(form);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      await upsertClient({ id: client.id, ...clientDataPayload(form) });
      toast.success("Dados do cliente atualizados");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/admin/clients">
          <ArrowLeft className="h-4 w-4" />
          Clientes
        </Link>
      </Button>

      <PageHeader
        icon={Building2}
        title={client.name}
        description={subtitle || "Ficha da empresa"}
        actions={
          <Button variant="accent" size="sm" asChild>
            <Link href="/admin/users">Criar usuário</Link>
          </Button>
        }
      />

      <div className="hub-surface mb-8 p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">
            Dados da empresa
          </p>
          <p className="text-xs text-[var(--text-muted)]">Cliente desde {formatDate(client.createdAt)}</p>
        </div>
        {form ? (
          <>
            <ClientDataFields
              idPrefix="cl-edit"
              values={form}
              onChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
              disabled={busy}
            />
            <div className="mt-4 flex justify-end">
              <Button variant="accent" size="sm" onClick={() => void save()} disabled={busy}>
                {busy ? "Salvando…" : "Salvar dados"}
              </Button>
            </div>
          </>
        ) : null}
      </div>

      <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
        Projetos deste cliente
      </h2>
      <DataTable
        columns={[
          { key: "name", header: "Projeto" },
          { key: "status", header: "Status" },
          { key: "progress", header: "Progresso" },
          { key: "updated", header: "Atualizado" },
        ]}
        rows={rows}
        empty={<EmptyState title="Sem projetos" description="Crie um projeto vinculado a este cliente." />}
      />
    </div>
  );
}
