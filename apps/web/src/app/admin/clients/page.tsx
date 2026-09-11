"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ClientDataFields,
  EMPTY_CLIENT_DATA,
  clientDataError,
  clientDataPayload,
  type ClientDataValues,
} from "@/components/hub/client-data-fields";
import { DataTable } from "@/components/hub/filter-table";
import { Modal } from "@/components/hub/modal";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import { formatBrPhone } from "@/lib/br-contact";
import { ApiError } from "@/lib/v2-client";
import { formatDate } from "@/lib/utils";

export default function AdminClientsPage() {
  const clients = useHubStore((s) => s.clients);
  const projects = useHubStore((s) => s.projects);
  const upsertClient = useHubStore((s) => s.upsertClient);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<ClientDataValues>(EMPTY_CLIENT_DATA);

  const reset = () => setForm(EMPTY_CLIENT_DATA);

  const submit = async () => {
    const error = clientDataError(form);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      await upsertClient(clientDataPayload(form));
      toast.success("Cliente criado");
      reset();
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const rows = clients.map((c) => {
    const count = projects.filter((p) => p.clientId === c.id).length;
    return {
      name: (
        <Link href={`/admin/clients/${c.id}`} className="font-medium hover:text-[var(--accent)]">
          {c.name}
        </Link>
      ),
      company: c.company || "—",
      segment: c.segment || "—",
      projects: count,
      contact: formatBrPhone(c.phone) || c.primaryContact || "—",
      since: formatDate(c.createdAt),
    };
  });

  return (
    <div>
      <PageHeader
        icon={Building2}
        title="Clientes"
        description="Contas e contatos principais."
        actions={
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      <DataTable
        columns={[
          { key: "name", header: "Nome" },
          { key: "company", header: "Empresa" },
          { key: "segment", header: "Segmento" },
          { key: "projects", header: "Projetos" },
          { key: "contact", header: "Contato" },
          { key: "since", header: "Desde" },
        ]}
        rows={rows}
        empty={
          <EmptyState
            title="Nenhum cliente"
            action={
              <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
                Criar cliente
              </Button>
            }
          />
        }
      />

      <Modal
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
        title="Novo cliente"
        description="Ficha da empresa. * obrigatório."
      >
        <ClientDataFields
          idPrefix="cl-new"
          values={form}
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          disabled={busy}
        />
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button variant="accent" onClick={() => void submit()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
