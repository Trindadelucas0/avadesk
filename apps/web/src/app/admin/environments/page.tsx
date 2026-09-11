"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, Eye, EyeOff, FileKey } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/hub/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHubStore } from "@/stores/hub-store";
import type { ProjectEnvEnvironment, ProjectEnvMeta } from "@/stores/hub-store";
import { copyToClipboard, formatRelative } from "@/lib/utils";

const ENV_TABS: { id: ProjectEnvEnvironment; label: string }[] = [
  { id: "test", label: "Teste" },
  { id: "production", label: "Produção" },
];

const HIDE_MS = 2 * 60 * 1000;

function emptyMeta(environment: ProjectEnvEnvironment): ProjectEnvMeta {
  return { environment, hasContent: false, updatedAt: null };
}

function EnvProjectCard({
  projectId,
  projectName,
  clientName,
}: {
  projectId: string;
  projectName: string;
  clientName?: string;
}) {
  const listProjectEnv = useHubStore((s) => s.listProjectEnv);
  const saveProjectEnv = useHubStore((s) => s.saveProjectEnv);
  const revealProjectEnv = useHubStore((s) => s.revealProjectEnv);
  const clearProjectEnv = useHubStore((s) => s.clearProjectEnv);

  const [tab, setTab] = useState<ProjectEnvEnvironment>("test");
  const [meta, setMeta] = useState<Record<ProjectEnvEnvironment, ProjectEnvMeta>>({
    test: emptyMeta("test"),
    production: emptyMeta("production"),
  });
  const [draft, setDraft] = useState<Record<ProjectEnvEnvironment, string>>({
    test: "",
    production: "",
  });
  const [unlocked, setUnlocked] = useState<Record<ProjectEnvEnvironment, boolean>>({
    test: false,
    production: false,
  });
  const [compose, setCompose] = useState<Record<ProjectEnvEnvironment, boolean>>({
    test: false,
    production: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const current = meta[tab];
  const revealed = unlocked[tab];
  const composing = compose[tab];
  const textareaEnabled = revealed || composing || !current.hasContent;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await listProjectEnv(projectId);
      const next = {
        test: data.environments.find((e) => e.environment === "test") ?? emptyMeta("test"),
        production:
          data.environments.find((e) => e.environment === "production") ?? emptyMeta("production"),
      };
      setMeta(next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [listProjectEnv, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!revealed) return;
    const t = window.setTimeout(() => {
      setUnlocked((s) => ({ ...s, [tab]: false }));
      setDraft((s) => ({ ...s, [tab]: "" }));
      setCompose((s) => ({ ...s, [tab]: false }));
    }, HIDE_MS);
    return () => window.clearTimeout(t);
  }, [revealed, tab]);

  async function reveal() {
    setBusy(true);
    try {
      const res = await revealProjectEnv(projectId, tab);
      setDraft((s) => ({ ...s, [tab]: res.content }));
      setUnlocked((s) => ({ ...s, [tab]: true }));
      setCompose((s) => ({ ...s, [tab]: false }));
    } catch {
      toast.error("Não foi possível revelar o .env.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const content = draft[tab];
    if (!content.trim()) {
      toast.error("Cole o conteúdo do .env antes de salvar.");
      return;
    }
    setBusy(true);
    try {
      const saved = await saveProjectEnv(projectId, tab, content);
      setMeta((s) => ({ ...s, [tab]: saved }));
      setUnlocked((s) => ({ ...s, [tab]: true }));
      setCompose((s) => ({ ...s, [tab]: false }));
      toast.success("Ambiente salvo");
    } catch {
      toast.error("Não foi possível salvar o .env.");
    } finally {
      setBusy(false);
    }
  }

  async function copyAll() {
    const text = draft[tab];
    if (!text) return;
    const ok = await copyToClipboard(text);
    if (ok) toast.success("Copiado. Cole no servidor.");
    else toast.error("Não foi possível copiar");
  }

  async function clear() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setBusy(true);
    try {
      await clearProjectEnv(projectId, tab);
      setMeta((s) => ({ ...s, [tab]: emptyMeta(tab) }));
      setDraft((s) => ({ ...s, [tab]: "" }));
      setUnlocked((s) => ({ ...s, [tab]: false }));
      setCompose((s) => ({ ...s, [tab]: false }));
      setConfirmClear(false);
      toast.success("Ambiente limpo");
    } catch {
      toast.error("Não foi possível limpar.");
    } finally {
      setBusy(false);
    }
  }

  function startCompose() {
    setCompose((s) => ({ ...s, [tab]: true }));
    setDraft((s) => ({ ...s, [tab]: "" }));
    setUnlocked((s) => ({ ...s, [tab]: false }));
    setConfirmClear(false);
  }

  function hide() {
    setUnlocked((s) => ({ ...s, [tab]: false }));
    setDraft((s) => ({ ...s, [tab]: "" }));
    setCompose((s) => ({ ...s, [tab]: false }));
  }

  return (
    <article className="hub-surface space-y-4 p-5">
      <div>
        <h2 className="text-base font-medium">{projectName}</h2>
        {clientName ? <p className="text-xs text-[var(--text-muted)]">{clientName}</p> : null}
      </div>

      <div className="flex gap-1 rounded-md border border-[var(--border)] p-1" role="tablist" aria-label="Ambiente">
        {ENV_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`flex-1 rounded px-3 py-1.5 text-sm hub-focus ${
              tab === t.id
                ? "bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            }`}
            onClick={() => {
              setTab(t.id);
              setConfirmClear(false);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Carregando metadados…</p>
      ) : error ? (
        <ErrorState title="Não foi possível ler este cofre" onRetry={() => void load()} />
      ) : (
        <>
          <p className="text-xs text-[var(--text-muted)]">
            {current.hasContent
              ? `Cadastrado · ${formatRelative(current.updatedAt)}`
              : "Ainda não cadastrado"}
          </p>
          <div>
            <Label htmlFor={`env-${projectId}-${tab}`} className="sr-only">
              Conteúdo {tab === "test" ? "teste" : "produção"}
            </Label>
            <Textarea
              id={`env-${projectId}-${tab}`}
              className="min-h-[12rem] font-mono text-xs"
              spellCheck={false}
              disabled={!textareaEnabled || busy}
              placeholder={
                current.hasContent && !textareaEnabled
                  ? "••••••••••••••••\nRevele para ver ou use Editar novo para colar por cima."
                  : "Cole o .env aqui"
              }
              value={textareaEnabled ? draft[tab] : ""}
              onChange={(e) => setDraft((s) => ({ ...s, [tab]: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {current.hasContent && !revealed ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => void reveal()}>
                <Eye className="h-3.5 w-3.5" />
                Revelar
              </Button>
            ) : null}
            {revealed ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={hide}>
                <EyeOff className="h-3.5 w-3.5" />
                Ocultar
              </Button>
            ) : null}
            {current.hasContent && !revealed && !composing ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={startCompose}>
                Editar novo
              </Button>
            ) : null}
            {revealed && draft[tab] ? (
              <Button variant="outline" size="sm" onClick={() => void copyAll()}>
                <Copy className="h-3.5 w-3.5" />
                Copiar tudo
              </Button>
            ) : null}
            <Button variant="accent" size="sm" disabled={busy} onClick={() => void save()}>
              Salvar
            </Button>
            {current.hasContent ? (
              <Button variant="danger" size="sm" disabled={busy} onClick={() => void clear()}>
                {confirmClear ? "Confirmar limpeza" : "Limpar"}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </article>
  );
}

function EnvironmentsBody() {
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const searchParams = useSearchParams();
  const focusId = searchParams.get("project");
  const [filter, setFilter] = useState(focusId ?? "all");

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients]
  );

  const visible = useMemo(() => {
    const list = filter === "all" ? projects : projects.filter((p) => p.id === filter);
    if (!focusId) return list;
    return [...list].sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId));
  }, [projects, filter, focusId]);

  if (!hydrated) return <PageSkeleton />;

  if (session?.role !== "ADMIN") {
    return (
      <EmptyState
        title="Sem permissão"
        description="O cofre de .env aparece só para o administrador."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        icon={FileKey}
        title="Ambientes (.env)"
        description="Só você (admin) vê esta tela. Cole o arquivo para copiar depois no servidor. O cliente e o gerente não acessam."
      />
      {projects.length === 0 ? (
        <EmptyState
          title="Nenhum projeto"
          description="Crie um projeto para guardar o .env de teste e produção."
          action={
            <Button variant="accent" size="sm" asChild>
              <Link href="/admin/projects">Criar projeto</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4">
            <Label htmlFor="env-filter">Projeto</Label>
            <select
              id="env-filter"
              className="mt-1.5 flex h-10 w-full max-w-sm rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 text-sm hub-focus"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">Todos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="space-y-4">
            {visible.map((p) => (
              <li key={p.id} id={`env-${p.id}`}>
                <EnvProjectCard
                  projectId={p.id}
                  projectName={p.name}
                  clientName={clientMap[p.clientId]}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export default function AdminEnvironmentsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EnvironmentsBody />
    </Suspense>
  );
}
