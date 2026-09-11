"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type AuthUser, type Role } from "@/lib/api";

export function useAuth(requiredRole?: Role) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        if (requiredRole && me.role !== requiredRole) {
          router.replace(me.role === "admin" ? "/admin" : "/portal");
          return;
        }
        setUser(me);
      } catch {
        if (!cancelled) router.replace("/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requiredRole, router]);

  return { user, loading };
}
