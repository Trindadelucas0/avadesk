"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  projects: Project[];
  onSelect: (projectId: string) => void;
}

export function CommandSearch({ projects, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return projects.slice(0, 8);
    return projects
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          (p.client_name ?? "").toLowerCase().includes(term) ||
          (p.company ?? "").toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [projects, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]">
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <div className="border-b border-zinc-800 p-3">
          <Input
            autoFocus
            placeholder="Buscar projeto para novo update…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <ul className="max-h-72 overflow-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">Nenhum projeto encontrado</li>
          )}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-zinc-900"
                onClick={() => {
                  onSelect(p.id);
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="text-sm text-zinc-100">{p.name}</span>
                <span className="text-xs text-zinc-500">
                  {p.client_name ?? p.company} · {p.progress_pct}%
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end border-t border-zinc-800 p-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
