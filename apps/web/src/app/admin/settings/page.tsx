"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/hub/page-header";
import { Settings } from "lucide-react";
import { DataTable } from "@/components/hub/filter-table";
import { EmptyState } from "@/components/hub/states";
import { ThemePicker } from "@/components/hub/theme-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHubStore } from "@/stores/hub-store";
import { DEFAULT_COMPANY_NAME } from "@/lib/brand";
import { formatRelative } from "@/lib/utils";

export default function AdminSettingsPage() {
  const auditLogs = useHubStore((s) => s.auditLogs);
  const users = useHubStore((s) => s.users);
  const organizationName = useHubStore((s) => s.organizationName);
  const setOrganizationName = useHubStore((s) => s.setOrganizationName);
  const [orgDraft, setOrgDraft] = useState(organizationName);

  useEffect(() => {
    setOrgDraft(organizationName);
  }, [organizationName]);

  const actorMap = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.name])),
    [users]
  );

  const lastTen = useMemo(
    () =>
      [...auditLogs]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10),
    [auditLogs]
  );

  const rows = lastTen.map((log) => ({
    when: formatRelative(log.createdAt),
    actor: actorMap[log.actorId] ?? log.actorId,
    action: log.action,
    entity: `${log.entity}${log.meta ? ` · ${log.meta}` : ""}`,
    id: (
      <span className="font-mono text-xs text-[var(--text-muted)]">{log.entityId.slice(0, 12)}…</span>
    ),
  }));

  return (
    <div>
      <PageHeader icon={Settings} title="Configurações" description="Preferências da organização." />

      <section className="hub-surface mb-6 p-5">
        <h2 className="text-sm font-medium">Aparência</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Tema da interface neste dispositivo.
        </p>
        <ThemePicker className="mt-4 max-w-md" />
      </section>

      <section className="hub-surface mb-10 p-5">
        <h2 className="text-sm font-medium">Organização</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="organizationName" className="text-xs text-[var(--text-muted)]">
              Nome da empresa
            </Label>
            <Input
              id="organizationName"
              className="mt-1.5"
              value={orgDraft}
              maxLength={120}
              autoComplete="organization"
              onChange={(e) => setOrgDraft(e.target.value)}
              onBlur={() => {
                const value = orgDraft.trim() || DEFAULT_COMPANY_NAME;
                void setOrganizationName(value);
              }}
            />
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)]">Alerta de projeto parado</p>
            <p className="mt-1.5 text-sm">7 dias sem update no projeto</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Auditoria (últimas 10)
        </h2>
        <DataTable
          columns={[
            { key: "when", header: "Quando" },
            { key: "actor", header: "Quem" },
            { key: "action", header: "Ação" },
            { key: "entity", header: "Entidade" },
            { key: "id", header: "ID" },
          ]}
          rows={rows}
          empty={<EmptyState title="Sem registros de auditoria" />}
        />
      </section>
    </div>
  );
}
