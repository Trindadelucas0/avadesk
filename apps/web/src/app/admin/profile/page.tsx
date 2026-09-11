"use client";

import { PageHeader, PageSkeleton } from "@/components/hub";
import { UserRound } from "lucide-react";
import { OwnProfileCard } from "@/components/hub/own-profile-card";
import { useHubStore } from "@/stores/hub-store";

export default function AdminProfilePage() {
  const hydrated = useHubStore((s) => s.hydrated);
  const session = useHubStore((s) => s.session);

  if (!hydrated || !session) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-md space-y-6 animate-fade-in">
      <PageHeader icon={UserRound} title="Perfil" description="Dados da sua sessão na Avadesk." />
      <OwnProfileCard />
    </div>
  );
}
