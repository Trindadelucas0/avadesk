"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHubStore } from "@/stores/hub-store";
import { roleHome } from "@/components/auth-gate";
import { PageSkeleton } from "@/components/hub/states";

export default function HomePage() {
  const router = useRouter();
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    if (session) router.replace(roleHome(session.role, session.mustCompleteProfile));
    else router.replace("/login");
  }, [hydrated, session, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <PageSkeleton />
    </div>
  );
}
