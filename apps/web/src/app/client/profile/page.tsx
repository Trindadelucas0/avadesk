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

export default function ClientProfilePage() {
  const { hydrated, session, client } = useClientTenant();
  const users = useHubStore((s) => s.users);
  const upsertClient = useHubStore((s) => s.upsertClient);
  const fullUser = users.find((u) => u.id === session?.id);

  const [form, setForm] = useState<ClientDataValues | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (client) setForm(clientToFormValues(client));
  }, [client]);

  if (!hydrated || !session) return <PageSkeleton />;

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
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <PageHeader icon={UserRound} title="Perfil" description="Sua conta e os dados da empresa." />

      <OwnProfileCard
        extras={
          fullUser?.instagramCompany || fullUser?.instagramPersonal ? (
            <dl className="space-y-2 border-t border-[var(--border)] pt-4 text-sm">
              {fullUser.instagramCompany ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Instagram empresa</dt>
                  <dd>{fullUser.instagramCompany}</dd>
                </div>
              ) : null}
              {fullUser.instagramPersonal ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-[var(--text-muted)]">Instagram pessoal</dt>
                  <dd>{fullUser.instagramPersonal}</dd>
                </div>
              ) : null}
            </dl>
          ) : null
        }
      />

      {client && form ? (
        <div className="hub-surface space-y-5 p-5">
          <div>
            <h2 className="text-sm font-medium">Dados da empresa</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Complete o que faltar. Nome, e-mail, telefone e WhatsApp são obrigatórios.
            </p>
          </div>
          <ClientDataFields
            idPrefix="cl-profile"
            values={form}
            onChange={(patch) => setForm((prev) => (prev ? { ...prev, ...patch } : prev))}
            disabled={busy}
          />
          <Button variant="accent" size="sm" onClick={() => void saveCompany()} disabled={busy}>
            {busy ? "Salvando…" : "Salvar dados da empresa"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
