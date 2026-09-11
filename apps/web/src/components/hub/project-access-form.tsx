"use client";

import { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHubStore } from "@/stores/hub-store";
import type { Project } from "@/types";
import { copyToClipboard, safeHttpUrl } from "@/lib/utils";

export function ProjectAccessForm({
  project,
  clientName,
}: {
  project: Project;
  clientName?: string;
}) {
  const upsertProject = useHubStore((s) => s.upsertProject);
  const revealCredentials = useHubStore((s) => s.revealCredentials);
  const [systemUrl, setSystemUrl] = useState(project.systemUrl ?? "");
  const [accessUser, setAccessUser] = useState(project.accessUser ?? "");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [knownPassword, setKnownPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasPassword = Boolean(project.hasPassword) || Boolean(knownPassword);

  async function handleCopy(label: string, value: string) {
    const ok = await copyToClipboard(value);
    if (ok) toast.success(`${label} copiado`);
    else toast.error("Não foi possível copiar");
  }

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (knownPassword) {
      setPassword(knownPassword);
      setRevealed(true);
      return;
    }
    if (!project.hasPassword) {
      setRevealed(true);
      return;
    }
    setBusy(true);
    try {
      const cred = await revealCredentials(project.id);
      setKnownPassword(cred.accessPassword);
      setPassword(cred.accessPassword);
      setRevealed(true);
    } catch {
      toast.error("Não foi possível revelar a senha.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const trimmedUrl = systemUrl.trim();
    if (trimmedUrl && !safeHttpUrl(trimmedUrl)) {
      toast.error("Use uma URL http ou https.");
      return;
    }
    setSaving(true);
    try {
      await upsertProject({
        id: project.id,
        clientId: project.clientId,
        name: project.name,
        systemUrl: trimmedUrl,
        accessUser: accessUser.trim(),
        accessPassword: password.trim() ? password.trim() : undefined,
      });
      if (password.trim()) setKnownPassword(password.trim());
      toast.success("Acesso salvo");
    } catch {
      toast.error("Não foi possível salvar o acesso.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="hub-surface space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-medium">{project.name}</h2>
          {clientName ? <p className="text-xs text-[var(--text-muted)]">{clientName}</p> : null}
        </div>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
          {hasPassword ? "Senha cadastrada" : "Sem senha"}
        </span>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor={`acc-url-${project.id}`}>URL do sistema</Label>
          <Input
            id={`acc-url-${project.id}`}
            className="mt-1.5"
            inputMode="url"
            autoComplete="url"
            placeholder="https://sistema.cliente.com"
            value={systemUrl}
            onChange={(e) => setSystemUrl(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`acc-user-${project.id}`}>Usuário</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id={`acc-user-${project.id}`}
              className="flex-1"
              autoComplete="username"
              value={accessUser}
              onChange={(e) => setAccessUser(e.target.value)}
            />
            {accessUser.trim() ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Copiar usuário"
                onClick={() => void handleCopy("Usuário", accessUser.trim())}
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <Label htmlFor={`acc-pass-${project.id}`}>Senha</Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              id={`acc-pass-${project.id}`}
              className="flex-1"
              type={revealed ? "text" : "password"}
              autoComplete="new-password"
              placeholder={hasPassword ? "Deixe em branco para manter" : "Nova senha"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={revealed ? "Ocultar senha" : "Revelar senha"}
              disabled={busy}
              onClick={() => void toggleReveal()}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {revealed && (password || knownPassword) ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Copiar senha"
                onClick={() => void handleCopy("Senha", password || knownPassword)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Campo vazio mantém a senha atual. O cliente vê estes dados em Acesso.
          </p>
        </div>
      </div>

      <Button variant="accent" size="sm" className="w-full sm:w-auto" disabled={saving} onClick={() => void save()}>
        {saving ? "Salvando…" : "Salvar acesso"}
      </Button>
    </article>
  );
}
