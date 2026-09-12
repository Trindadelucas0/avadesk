"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--text-muted)]">{label}</dt>
      <dd className="text-right">{value || "—"}</dd>
    </div>
  );
}

export function OwnProfileCard({ extras }: { extras?: ReactNode }) {
  const session = useHubStore((s) => s.session);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.name) setDisplayName(session.name);
  }, [session?.name]);

  useEffect(() => {
    if (editing) nameInputRef.current?.focus();
  }, [editing]);

  if (!session) return null;

  function startEdit() {
    if (!session) return;
    setDisplayName(session.name);
    setEditing(true);
  }

  function cancelEdit() {
    if (!session) return;
    setDisplayName(session.name);
    setEditing(false);
  }

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
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="hub-surface space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--accent-muted)] text-lg font-semibold text-[var(--accent)]">
          {session.avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{session.name}</p>
          <p className="text-sm text-[var(--text-muted)]">{session.email}</p>
        </div>
        {editing ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={cancelEdit}
            disabled={saving}
          >
            Cancelar
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={startEdit}>
            Editar
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 border-t border-[var(--border)] pt-4">
          <Label htmlFor="displayName">Nome de exibição</Label>
          <Input
            ref={nameInputRef}
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
            maxLength={120}
            disabled={saving}
          />
          <Button variant="accent" size="sm" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      ) : null}

      <dl className="space-y-2 border-t border-[var(--border)] pt-4 text-sm">
        {editing ? null : <ProfileRow label="Nome de exibição" value={session.name} />}
        <ProfileRow label="E-mail" value={session.email} />
        <ProfileRow label="Papel" value={ROLE_LABEL[session.role]} />
        {extras}
      </dl>
    </div>
  );
}
