"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, v2 } from "@/lib/v2-client";
import type { AdminOverview } from "@/lib/admin-overview";

export function useAdminOverview() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await v2<AdminOverview>("/admin/overview");
      setData(payload);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Não foi possível carregar os totais."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}
