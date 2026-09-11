"use client";

import { useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { EmptyState, FilterBar, FilterChip, PageHeader, PageSkeleton, Timeline } from "@/components/hub";
import { useClientTenant } from "@/hooks/use-client-tenant";
import type { UpdateType } from "@/types";
import { updateTypeLabel } from "@/lib/utils";

const TYPE_FILTERS: { value: "ALL" | UpdateType }[] = [
  { value: "ALL" },
  { value: "FEATURE" },
  { value: "FIX" },
  { value: "UPDATE" },
  { value: "RELEASE" },
  { value: "DOCUMENTATION" },
];

export default function ClientUpdatesPage() {
  const { hydrated, visibleUpdates, projectNames } = useClientTenant();
  const [typeFilter, setTypeFilter] = useState<"ALL" | UpdateType>("ALL");

  const filtered = useMemo(
    () =>
      typeFilter === "ALL"
        ? visibleUpdates
        : visibleUpdates.filter((u) => u.type === typeFilter),
    [visibleUpdates, typeFilter]
  );

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={Rocket}
        title="Evolução"
        description="O que já foi publicado para você acompanhar — do mais recente ao mais antigo."
      />

      <FilterBar>
        {TYPE_FILTERS.map((f) => (
          <FilterChip
            key={f.value}
            active={typeFilter === f.value}
            onClick={() => setTypeFilter(f.value)}
          >
            {f.value === "ALL" ? "Todos" : updateTypeLabel(f.value)}
          </FilterChip>
        ))}
      </FilterBar>

      {filtered.length > 0 ? (
        <Timeline
          items={filtered}
          projectNames={projectNames}
          detailBase="/client/projects"
          updatesHref="/client/updates"
        />
      ) : (
        <EmptyState
            title="Ainda não há atualizações publicadas"
            description={
              typeFilter === "ALL"
                ? "Quando a equipe publicar novidades visíveis, elas aparecerão nesta linha do tempo."
                : `Nenhum item do tipo ${updateTypeLabel(typeFilter)}.`
            }
        />
      )}
    </div>
  );
}
