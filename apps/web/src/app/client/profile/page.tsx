"use client";

import { UserRound } from "lucide-react";
import { PageHeader, PageSkeleton } from "@/components/hub";
import { OwnProfileCard } from "@/components/hub/own-profile-card";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { useHubStore } from "@/stores/hub-store";

export default function ClientProfilePage() {
  const { hydrated, session } = useClientTenant();
  const users = useHubStore((s) => s.users);
  const fullUser = users.find((u) => u.id === session?.id);

  if (!hydrated || !session) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-lg space-y-6 animate-fade-in">
      <PageHeader icon={UserRound} title="Perfil" description="Sua conta no portal." />

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
    </div>
  );
}
