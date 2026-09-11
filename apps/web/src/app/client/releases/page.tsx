"use client";

import { EmptyState, PageHeader, PageSkeleton, ReleaseCard } from "@/components/hub";
import { Tag } from "lucide-react";
import { useClientTenant } from "@/hooks/use-client-tenant";

export default function ClientReleasesPage() {
  const { hydrated, tenantReleases, projectNames } = useClientTenant();

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={Tag}
        title="Releases"
        description="Versões entregues e notas de cada release."
      />

      {tenantReleases.length > 0 ? (
        <ul className="space-y-4">
          {tenantReleases.map((release) => (
            <li key={release.id}>
              <ReleaseCard release={release} projectName={projectNames[release.projectId]} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Nenhuma release"
          description="Releases publicadas para seus projetos serão listadas aqui."
        />
      )}
    </div>
  );
}
