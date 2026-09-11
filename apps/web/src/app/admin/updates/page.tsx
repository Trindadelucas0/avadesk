"use client";

import { useMemo, useState } from "react";
import { Plus, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar, FilterChip } from "@/components/hub/filter-table";
import { PageHeader } from "@/components/hub/page-header";
import { QuickUpdateModal } from "@/components/hub/quick-update-modal";
import { Timeline } from "@/components/hub/timeline";
import { EmptyState } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import type { UpdateType } from "@/types";
import { updateTypeLabel } from "@/lib/utils";

type VisibilityFilter = "all" | "visible" | "hidden";

export default function AdminUpdatesPage() {
  const updates = useHubStore((s) => s.updates);
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const [typeFilter, setTypeFilter] = useState<UpdateType | "all">("all");
  const [visibility, setVisibility] = useState<VisibilityFilter>("all");
  const [quickOpen, setQuickOpen] = useState(false);

  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );
  const clientNames = useMemo(() => {
    const byId = Object.fromEntries(clients.map((c) => [c.id, c.company || c.name]));
    return Object.fromEntries(
      projects.map((p) => [p.id, byId[p.clientId] ?? ""]).filter(([, name]) => Boolean(name))
    );
  }, [projects, clients]);

  const filtered = useMemo(() => {
    return [...updates]
      .filter((u) => {
        if (typeFilter !== "all" && u.type !== typeFilter) return false;
        if (visibility === "visible" && !u.visibleToClient) return false;
        if (visibility === "hidden" && u.visibleToClient) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [updates, typeFilter, visibility]);

  const types: (UpdateType | "all")[] = [
    "all",
    "FEATURE",
    "FIX",
    "UPDATE",
    "RELEASE",
    "DOCUMENTATION",
  ];

  return (
    <div>
      <PageHeader
        icon={Rocket}
        title="Updates"
        description="Inclui updates ocultos ao cliente. Barra superior também abre Quick Update."
        actions={
          <Button variant="accent" size="sm" onClick={() => setQuickOpen(true)}>
            <Plus className="h-4 w-4" />
            Publicar update
          </Button>
        }
      />

      <FilterBar>
        {types.map((t) => (
          <FilterChip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
            {t === "all" ? "Todos os tipos" : updateTypeLabel(t)}
          </FilterChip>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--border)]" aria-hidden />
        {(
          [
            ["all", "Todos"],
            ["visible", "O cliente vê"],
            ["hidden", "Só a equipe"],
          ] as const
        ).map(([key, label]) => (
          <FilterChip key={key} active={visibility === key} onClick={() => setVisibility(key)}>
            {label}
          </FilterChip>
        ))}
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum update neste filtro"
          action={
            <Button variant="accent" size="sm" onClick={() => setQuickOpen(true)}>
              Publicar update
            </Button>
          }
        />
      ) : (
        <Timeline
          items={filtered}
          projectNames={projectNames}
          clientNames={clientNames}
          showVisibility
          detailBase="/admin/projects"
          updatesHref="/admin/updates"
        />
      )}

      <QuickUpdateModal open={quickOpen} onOpenChange={setQuickOpen} />
    </div>
  );
}
