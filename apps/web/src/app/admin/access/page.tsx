"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState, PageSkeleton } from "@/components/hub/states";
import { ProjectAccessForm } from "@/components/hub/project-access-form";
import { Button } from "@/components/ui/button";
import { useHubStore } from "@/stores/hub-store";

function AccessBody() {
  const hydrated = useHubStore((s) => s.hydrated);
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const searchParams = useSearchParams();
  const focusId = searchParams.get("project");

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients]
  );

  const ordered = useMemo(() => {
    const list = [...projects];
    if (!focusId) return list;
    return list.sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
  }, [projects, focusId]);

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={KeyRound}
        title="Acesso ao sistema"
        description="URL, usuário e senha que o cliente usa em Acesso. A senha só aparece ao revelar."
      />
      {ordered.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Crie um projeto para cadastrar o login do sistema."
          action={
            <Button variant="accent" size="sm" asChild>
              <Link href="/admin/projects">Criar projeto</Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {ordered.map((p) => (
            <li key={p.id} id={`project-${p.id}`}>
              <ProjectAccessForm project={p} clientName={clientMap[p.clientId]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminAccessPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AccessBody />
    </Suspense>
  );
}
