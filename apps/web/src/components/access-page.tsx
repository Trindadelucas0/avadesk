"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, type Project } from "@/lib/api";
import { Button } from "@/components/ui/button";

export function AccessPage() {
  const params = useSearchParams();
  const projectParam = params.get("project");
  const [project, setProject] = useState<Project | null>(null);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { projects } = await api.clientProjects();
        const found =
          projects.find((p) => p.id === projectParam) ?? projects[0] ?? null;
        setProject(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar");
      }
    })();
  }, [projectParam]);

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Portal</p>
          <h1 className="text-2xl font-semibold text-zinc-50">Acesso ao sistema</h1>
        </div>
        <Button asChild variant="outline">
          <Link href="/portal">Voltar</Link>
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-amber-300">{error}</p>}

      {project && (
        <div className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950/70 p-5">
          <p className="text-sm text-zinc-400">{project.name}</p>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">URL</p>
            {project.system_url ? (
              <a
                href={project.system_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-zinc-100 underline underline-offset-4"
              >
                {project.system_url}
              </a>
            ) : (
              <p className="text-sm text-zinc-500">Não informado</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Usuário</p>
            <p className="font-mono text-sm text-zinc-100">{project.access_user ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">Senha</p>
            <div className="mt-1 flex items-center gap-3">
              <p className="font-mono text-sm text-zinc-100">
                {reveal
                  ? project.access_password ?? "—"
                  : project.access_password
                    ? "••••••••••••"
                    : "—"}
              </p>
              <Button size="sm" variant="secondary" onClick={() => setReveal((v) => !v)}>
                {reveal ? "Ocultar" : "Revelar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
