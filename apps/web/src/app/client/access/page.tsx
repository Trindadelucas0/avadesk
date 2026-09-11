"use client";

import { useState } from "react";
import Link from "next/link";
import { Copy, ExternalLink, Eye, EyeOff, KeyRound } from "lucide-react";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/hub";
import { Button } from "@/components/ui/button";
import { useClientTenant } from "@/hooks/use-client-tenant";
import { useHubStore } from "@/stores/hub-store";
import { copyToClipboard, safeHttpUrl } from "@/lib/utils";
import { toast } from "sonner";

function AccessProjectCard({
  projectId,
  projectName,
  systemUrl,
  accessUser,
}: {
  projectId: string;
  projectName: string;
  systemUrl: string;
  accessUser: string;
}) {
  const revealCredentials = useHubStore((s) => s.revealCredentials);
  const [revealed, setRevealed] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCopy(label: string, value: string) {
    const ok = await copyToClipboard(value);
    if (ok) toast.success(`${label} copiado`);
    else toast.error("Não foi possível copiar");
  }

  const href = safeHttpUrl(systemUrl);

  async function toggleReveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    if (password) {
      setRevealed(true);
      return;
    }
    setBusy(true);
    try {
      const cred = await revealCredentials(projectId);
      setPassword(cred.accessPassword);
      setRevealed(true);
    } catch {
      toast.error("Não foi possível revelar a senha.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="hub-surface space-y-4 p-5">
      <h2 className="text-base font-medium">{projectName}</h2>
      <div className="space-y-3 text-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[var(--text-muted)]">URL do sistema</span>
          <div className="flex items-center gap-2">
            {href ? (
              <>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-[var(--accent)] hover:underline hub-focus rounded-sm"
                >
                  {systemUrl}
                </a>
                <Button variant="ghost" size="icon" aria-label="Abrir URL" asChild>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" aria-label="Copiar URL" onClick={() => handleCopy("URL", systemUrl)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <span className="text-[var(--text-secondary)]">Não configurada</span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[var(--text-muted)]">Usuário</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs">{accessUser || "—"}</code>
            {accessUser ? (
              <Button variant="ghost" size="icon" aria-label="Copiar usuário" onClick={() => handleCopy("Usuário", accessUser)}>
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[var(--text-muted)]">Senha</span>
          <div className="flex items-center gap-2">
            <code className="rounded bg-[var(--bg-subtle)] px-2 py-1 text-xs">
              {revealed ? password || "—" : "••••••••••"}
            </code>
            <Button
              variant="ghost"
              size="icon"
              aria-label={revealed ? "Ocultar senha" : "Revelar senha"}
              disabled={busy}
              onClick={() => void toggleReveal()}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            {revealed && password ? (
              <Button variant="ghost" size="icon" aria-label="Copiar senha" onClick={() => handleCopy("Senha", password)}>
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function ClientAccessPage() {
  const { hydrated, clientProjects } = useClientTenant();

  if (!hydrated) return <PageSkeleton />;

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={KeyRound}
        title="Acesso ao sistema"
        description="Credenciais reveladas só neste momento, com registro de auditoria. Use em ambiente seguro."
      />
      {clientProjects.length > 0 ? (
        <ul className="space-y-4">
          {clientProjects.map((p) => (
            <li key={p.id}>
              <AccessProjectCard
                projectId={p.id}
                projectName={p.name}
                systemUrl={p.systemUrl}
                accessUser={p.accessUser}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="Sem credenciais"
          description="Nenhum projeto com dados de acesso disponível."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link href="/client/projects">Ver projetos</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
