"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Project, type UpdateItem } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { formatRelative, statusLabel } from "@/lib/utils";

export function PortalHome({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { projects: list } = await api.clientProjects();
        setProjects(list);
        setSelectedId(list[0]?.id ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const { updates: list } = await api.updates(selectedId);
        setUpdates(list);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar timeline");
      }
    })();
  }, [selectedId]);

  const project = projects.find((p) => p.id === selectedId) ?? null;

  async function logout() {
    await api.logout();
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Portal</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Acompanhamento
          </h1>
          <p className="text-sm text-zinc-500">{email}</p>
        </div>
        <div className="flex gap-2">
          {project && (
            <Button asChild variant="outline">
              <Link href={`/portal/access?project=${project.id}`}>Acesso</Link>
            </Button>
          )}
          <Button variant="outline" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>

      {loading && <p className="text-sm text-zinc-500">Carregando…</p>}
      {error && <p className="mb-4 text-sm text-amber-300">{error}</p>}

      {projects.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {projects.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={p.id === selectedId ? "default" : "outline"}
              onClick={() => setSelectedId(p.id)}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}

      {project && (
        <>
          <section className="mb-8 rounded-lg border border-zinc-800 bg-zinc-950/70 p-5">
            <h2 className="text-xl font-medium text-zinc-50">{project.name}</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Status: {statusLabel(project.status)} · Última:{" "}
              {formatRelative(project.last_update_at ?? project.updated_at)}
            </p>
            <div className="mt-6 flex items-end gap-4">
              <p className="text-5xl font-semibold tracking-tight text-zinc-50">
                {project.progress_pct}
                <span className="text-2xl text-zinc-500">%</span>
              </p>
              <div className="mb-2 h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                <div
                  className="h-full rounded-full bg-zinc-100 transition-all"
                  style={{ width: `${project.progress_pct}%` }}
                />
              </div>
            </div>
            {project.last_update_content && (
              <p className="mt-4 text-sm text-zinc-400">{project.last_update_content}</p>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">
              Timeline
            </h3>
            <ol className="space-y-3">
              {updates.length === 0 && (
                <li className="text-sm text-zinc-500">Nenhuma atualização visível ainda.</li>
              )}
              {updates.map((u) => (
                <li
                  key={u.id}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-4 py-3"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{statusLabel(u.status)}</span>
                    <span>·</span>
                    <span>{formatRelative(u.created_at)}</span>
                  </div>
                  <p className="text-sm text-zinc-200 whitespace-pre-wrap">{u.content}</p>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}
