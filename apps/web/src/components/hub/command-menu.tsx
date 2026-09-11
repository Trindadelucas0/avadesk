"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useHubStore } from "@/stores/hub-store";
import { cn } from "@/lib/utils";

type CommandItem = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  action?: () => void;
};

export function CommandMenu({
  open,
  onOpenChange,
  onQuickUpdate,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onQuickUpdate?: () => void;
  mode: "admin" | "client";
}) {
  const [q, setQ] = useState("");
  const router = useRouter();
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const session = useHubStore((s) => s.session);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const items = useMemo(() => {
    const list: CommandItem[] = [];
    if (mode === "admin") {
      list.push({
        id: "qu",
        label: "Quick Update",
        hint: "Publicar atualização",
        action: () => {
          onOpenChange(false);
          onQuickUpdate?.();
        },
      });
      list.push(
        { id: "a-dash", label: "Dashboard", href: "/admin" },
        { id: "a-clients", label: "Clientes", href: "/admin/clients" },
        { id: "a-projects", label: "Projetos", href: "/admin/projects" },
        { id: "a-access", label: "Acesso ao sistema", href: "/admin/access" }
      );
      if (session?.role === "ADMIN") {
        list.push({ id: "a-env", label: "Ambientes (.env)", href: "/admin/environments" });
      }
      list.push(
        { id: "a-chamados", label: "Chamados", href: "/admin/chamados" },
        { id: "a-updates", label: "Updates", href: "/admin/updates" }
      );
      projects.forEach((p) => {
        const client = clients.find((c) => c.id === p.clientId);
        list.push({
          id: `p-${p.id}`,
          label: p.name,
          hint: client?.name,
          href: `/admin/projects/${p.id}`,
        });
      });
    } else {
      const mine =
        session?.role === "CLIENT"
          ? projects.filter((p) => p.clientId === session.clientId)
          : projects;
      list.push(
        { id: "c-dash", label: "Dashboard", href: "/client" },
        { id: "c-chamados", label: "Chamados", href: "/client/chamados" },
        { id: "c-updates", label: "Updates", href: "/client/updates" },
        { id: "c-access", label: "Acesso", href: "/client/access" }
      );
      mine.forEach((p) =>
        list.push({
          id: `cp-${p.id}`,
          label: p.name,
          href: `/client/projects/${p.id}`,
        })
      );
    }
    const query = q.trim().toLowerCase();
    if (!query) return list.slice(0, 12);
    return list.filter(
      (i) =>
        i.label.toLowerCase().includes(query) ||
        i.hint?.toLowerCase().includes(query)
    );
  }, [mode, projects, clients, q, session, onOpenChange, onQuickUpdate]);

  const go = (item: CommandItem) => {
    if (item.action) item.action();
    else if (item.href) {
      onOpenChange(false);
      router.push(item.href);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Fechar"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="hub-dialog absolute left-1/2 top-[18%] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Search className="h-4 w-4 text-[var(--text-muted)]" aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar projetos, páginas…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-muted)]"
            aria-label="Buscar"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto p-2" role="listbox">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">
              Nenhum resultado
            </li>
          ) : (
            items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm hover:bg-[var(--bg-subtle)] hub-focus"
                  )}
                  onClick={() => go(item)}
                >
                  <span>{item.label}</span>
                  {item.hint ? (
                    <span className="text-xs text-[var(--text-muted)]">{item.hint}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
