"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, PageSkeleton } from "@/components/hub";
import { UserRound } from "lucide-react";
import {
  ClientDataFields,
  clientDataError,
  clientDataPayload,
  clientToFormValues,
  type ClientDataValues,
} from "@/components/hub/client-data-fields";
import { OwnProfileCard } from "@/components/hub/own-profile-card";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { useHubStore } from "@/stores/hub-store";
import { ApiError } from "@/lib/v2-client";

const COMPANY_ROWS: { key: keyof ClientDataValues; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "contactEmail", label: "E-mail de contato" },
  { key: "phone", label: "Telefone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "cnpj", label: "CNPJ" },
  { key: "company", label: "Empresa" },
  { key: "segment", label: "Segmento" },
  { key: "notes", label: "Mais informações" },
];

function displayValue(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : "—";
}

export default function ClientProfilePage() {
  const { hydrated, session, client } = useClientTenant();
  const users = useHubStore((s) => s.users);
  const upsertClient = useHubStore((s) => s.upsertClient);
  const fullUser = users.find((u) => u.id === session?.id);

  const [form, setForm] = useState<ClientDataValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);

  useEffect(() => {
    if (client) setForm(clientToFormValues(client));
  }, [client]);

  useEffect(() => {
    if (!editingCompany) return;
    document.getElementById("cl-profile-name")?.focus();
  }, [editingCompany]);

  if (!hydrated || !session) return <PageSkeleton />;

  const startCompanyEdit = () => {
    if (client) setForm(clientToFormValues(client));
    setEditingCompany(true);
  };

  const cancelCompanyEdit = () => {
    if (client) setForm(clientToFormValues(client));
    setEditingCompany(false);
  };

  const saveCompany = async () => {
    if (!client || !form) return;
    const error = clientDataError(form);
    if (error) {
      toast.error(error);
      return;
    }
    setBusy(true);
    try {
      await upsertClient({ id: client.id, ...clientDataPayload(form) });
      toast.success("Dados da empresa atualizados");
      setEditingCompany(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  const companyIncomplete = Boolean(form && clientDataError(form));

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <PageHeader icon={UserRound} title="Perfil" description="Sua conta e os dados da empresa." />

      <OwnProfileCard
        extras={
          fullUser?.instagramCompany || fullUser?.instagramPersonal ? (
            <>
              {fullUser.instagramCompany ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Instagram empresa</dt>
                  <dd className="text-right">{fullUser.instagramCompany}</dd>
                </div>
              ) : null}
              {fullUser.instagramPersonal ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Instagram pessoal</dt>
                  <dd className="text-right">{fullUser.instagramPersonal}</dd>
                </div>
              ) : null}
            </>
          ) : null
        }
      />

      {client && form ? (
        <div className="hub-surface space-y-5 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium">Dados da empresa</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {editingCompany
                  ? "Complete o que faltar. Nome, e-mail, telefone e WhatsApp são obrigatórios."
                  : "Ficha da empresa vinculada à sua conta."}
              </p>
            </div>
            {editingCompany ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={cancelCompanyEdit}
                disabled={busy}
              >
                Cancelar
              </Button>
            ) : (
              <Button
                variant={companyIncomplete ? "accent" : "outline"}
                size="sm"
                className="w-full sm:w-auto"
                onClick={startCompanyEdit}
              >
                Editar
              </Button>
            )}
          </div>

          {!editingCompany && companyIncomplete ? (
            <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 text-sm text-[var(--text-secondary)]">
              Complete os dados da empresa.
            </p>
          ) : null}

          {editingCompany ? (
            <>
              <ClientDataFields
                idPrefix="cl-profile"
                values={form}
                onChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
                disabled={busy}
              />
              <Button variant="accent" size="sm" onClick={() => void saveCompany()} disabled={busy}>
                {busy ? "Salvando…" : "Salvar dados da empresa"}
              </Button>
            </>
          ) : (
            <dl className="space-y-2 text-sm">
              {COMPANY_ROWS.map((row) => {
                const value = displayValue(form[row.key]);
                const stacked = row.key === "notes" && value !== "—";
                return (
                  <div
                    key={row.key}
                    className={stacked ? "space-y-1" : "flex justify-between gap-4"}
                  >
                    <dt className="text-[var(--text-muted)]">{row.label}</dt>
                    <dd className={stacked ? "whitespace-pre-wrap text-[var(--text-secondary)]" : "text-right"}>
                      {value}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      ) : null}
    </div>
  );
}
