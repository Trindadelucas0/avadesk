"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHubStore } from "@/stores/hub-store";
import { toast } from "sonner";
import { ApiError, v2 } from "@/lib/v2-client";
import type { SessionUser } from "@/types";

const ROLE_LABEL: Record<SessionUser["role"], string> = {
  CLIENT: "Cliente",
  ADMIN: "Admin",
  MANAGER: "Manager",
};

export function OwnProfileCard({ extras }: { extras?: ReactNode }) {
  const session = useHubStore((s) => s.session);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.name) setDisplayName(session.name);
  }, [session?.name]);

  if (!session) return null;

  async function handleSave() {
    if (!session) return;
    const trimmed = displayName.trim();
    if (trimmed.length < 3) {
      toast.error("Informe um nome de exibição (mínimo 3 caracteres)");
      return;
    }
    setSaving(true);
    try {
      const res = await v2<{ user: SessionUser }>("/auth/me", {
        method: "PATCH",
        json: { name: trimmed },
      });
      const prev = useHubStore.getState().session;
      useHubStore.setState({
        session: {
          ...res.user,
          projectIds: prev?.projectIds ?? res.user.projectIds,
          accessAllProjects: prev?.accessAllProjects ?? res.user.accessAllProjects,
        },
        users: useHubStore.getState().users.map((u) =>
          u.id === res.user.id ? { ...u, name: res.user.name, avatarInitials: res.user.avatarInitials } : u
        ),
      });
      toast.success("Perfil atualizado");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hub-surface space-y-5 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent-muted)] text-lg font-semibold text-[var(--accent)]">
          {session.avatarInitials}
        </div>
        <div>
          <p className="font-medium">{session.name}</p>
          <p className="text-sm text-[var(--text-muted)]">{session.email}</p>
        </div>
      </div>

      {extras}

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <Label htmlFor="displayName">Nome de exibição</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          maxLength={120}
        />
        <Button variant="accent" size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>

      <dl className="space-y-2 border-t border-[var(--border)] pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--text-muted)]">Papel</dt>
          <dd>{ROLE_LABEL[session.role]}</dd>
        </div>
      </dl>
    </div>
  );
}
