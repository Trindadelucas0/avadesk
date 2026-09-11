"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHubStore } from "@/stores/hub-store";
import type { Role } from "@/types";
import { PageSkeleton } from "@/components/hub/states";

export function AuthGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (!allow.includes(session.role)) {
      router.replace(roleHome(session.role, session.mustCompleteProfile));
    }
  }, [hydrated, session, allow, router]);

  if (!hydrated || !session || !allow.includes(session.role)) {
    return (
      <div className="p-8">
        <PageSkeleton />
      </div>
    );
  }

  return <>{children}</>;
}

export function roleHome(role: Role, mustCompleteProfile = false): string {
  if (role === "CLIENT" && mustCompleteProfile) return "/client/onboarding";
  return role === "CLIENT" ? "/client" : "/admin";
}
