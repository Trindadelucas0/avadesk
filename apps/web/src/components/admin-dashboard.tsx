"use client";

import { useEffect, useRef, useState } from "react";
import { api, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatRelative, statusLabel } from "@/lib/utils";
import { CommandSearch } from "@/components/command-search";

type UpdateStatus = "planejado" | "em_andamento" | "concluido";

export function AdminDashboard({ email }: { email: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<UpdateStatus>("em_andamento");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    setLoading(true);
    try {
      const { projects: list } = await api.adminProjects();
      setProjects(list);
      setSelectedId((prev) => prev ?? list[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  async function publish() {
    if (!selectedId || !content.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.createUpdate({
        project_id: selectedId,
        content: content.trim(),
        status,
        visible_to_client: visible,
      });
      setContent("");
      setStatus("em_andamento");
      setVisible(true);
      setMessage("Atualização publicada.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao publicar");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.logout();
    window.location.href = "/login";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Admin</p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Projetos</h1>
          <p className="text-sm text-zinc-500">{email}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-zinc-500 sm:inline">⌘/Ctrl+K busca</span>
          <Button variant="outline" onClick={logout}>
            Sair
          </Button>
        </div>
      </header>

      {loading && <p className="text-sm text-zinc-500">Carregando…</p>}
      {error && <p className="mb-4 text-sm text-amber-300">{error}</p>}
      {message && <p className="mb-4 text-sm text-emerald-300">{message}</p>}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-2">
          {projects.map((p) => {
            const active = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                  active
                    ? "border-zinc-500 bg-zinc-900"
                    : "border-zinc-800 bg-zinc-950/60 hover:border-zinc-700"
                } ${p.is_stale ? "ring-1 ring-amber-500/40" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{p.name}</p>
                    <p className="text-xs text-zinc-500">
                      {p.client_name} · {p.progress_pct}% · {statusLabel(p.status)}
                    </p>
                  </div>
                  {p.is_stale && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-amber-200">
                      Parado
                    </span>
                  )}
                </div>
                {p.is_stale && (
                  <p className="mt-2 text-xs text-amber-200/90">
                    Sem update há {p.days_since_update ?? 7}+ dias
                  </p>
                )}
              </button>
            );
          })}
        </aside>

        <section className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          {selected ? (
            <>
              <div className="mb-4">
                <h2 className="text-lg font-medium text-zinc-50">{selected.name}</h2>
                <p className="text-sm text-zinc-500">
                  Última atividade: {formatRelative(selected.updated_at)}
                  {selected.last_update_content
                    ? ` · ${selected.last_update_content.slice(0, 80)}${
                        selected.last_update_content.length > 80 ? "…" : ""
                      }`
                    : ""}
                </p>
              </div>

              <label className="mb-2 block text-sm text-zinc-400">Quick Update</label>
              <Textarea
                ref={textareaRef}
                placeholder="O que foi feito / estou fazendo…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />

              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    ["planejado", "Planejado"],
                    ["em_andamento", "Em andamento"],
                    ["concluido", "Concluído"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={status === value ? "default" : "outline"}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <Switch checked={visible} onCheckedChange={setVisible} />
                  Visível ao cliente
                </label>
                <Button onClick={publish} disabled={busy || !content.trim()}>
                  {busy ? "Publicando…" : "Publicar"}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Selecione um projeto.</p>
          )}
        </section>
      </div>

      <CommandSearch
        projects={projects}
        onSelect={(id) => {
          setSelectedId(id);
          setMessage("Projeto selecionado — escreva o update e publique.");
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
      />
    </div>
  );
}
