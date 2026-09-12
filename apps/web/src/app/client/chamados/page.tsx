"use client";

import { ClosedTicketsPanel, EmptyState, PageHeader, PageSkeleton, TicketBoard } from "@/components/hub";
import { Headphones } from "lucide-react";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { isTicketOpen } from "@/lib/tickets";

export default function ClientChamadosPage() {
  const { hydrated, tickets, clientProjects } = useClientTenant();

  if (!hydrated) return <PageSkeleton />;

  const projects = clientProjects.map((p) => ({ id: p.id, name: p.name }));
  const ordered = [...tickets].sort((a, b) => {
    const ap = a.awaitingReplyFromUserId ? 0 : 1;
    const bp = b.awaitingReplyFromUserId ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="mx-auto max-w-3xl animate-fade-in">
      <PageHeader
        icon={Headphones}
        title="Chamados"
        description="Bugs e outras solicitações. Toque no card para ver o contexto. Encerrados ficam em Concluídos, por data."
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ativo"
          description="Quando houver um projeto vinculado, você poderá abrir chamados aqui."
        />
      ) : (
        <div className="space-y-6">
          <TicketBoard tickets={ordered.filter(isTicketOpen)} projects={projects} mode="client" />
          <ClosedTicketsPanel mode="client" projects={projects} />
        </div>
      )}
    </div>
  );
}
