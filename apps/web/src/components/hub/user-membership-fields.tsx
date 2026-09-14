"use client";

import Link from "next/link";
import { Label } from "@/components/ui/label";
import type { Client, Project } from "@/types";

export type CompanyMembershipDraft = {
  clientId: string;
  accessAllProjects: boolean;
  projectIds: string[];
};

export function emptyMembershipDrafts(
  clients: Client[],
  existing?: CompanyMembershipDraft[]
): Record<string, CompanyMembershipDraft> {
  const byId = new Map((existing ?? []).map((m) => [m.clientId, m]));
  const out: Record<string, CompanyMembershipDraft> = {};
  for (const c of clients) {
    out[c.id] = byId.get(c.id) ?? {
      clientId: c.id,
      accessAllProjects: true,
      projectIds: [],
    };
  }
  return out;
}

export function selectedMemberships(
  drafts: Record<string, CompanyMembershipDraft>,
  enabledIds: string[]
): CompanyMembershipDraft[] {
  return enabledIds.map((id) => drafts[id]).filter(Boolean);
}

export function membershipError(
  enabledIds: string[],
  drafts: Record<string, CompanyMembershipDraft>,
  projects: Project[]
): string | null {
  if (enabledIds.length === 0) return "Selecione ao menos uma empresa.";
  for (const id of enabledIds) {
    const d = drafts[id];
    if (!d) continue;
    const companyProjects = projects.filter((p) => p.clientId === id);
    if (companyProjects.length > 0 && !d.accessAllProjects && d.projectIds.length === 0) {
      return "Selecione ao menos um projeto, ou marque todos os projetos da empresa.";
    }
  }
  return null;
}

export function UserMembershipFields({
  clients,
  projects,
  enabledIds,
  drafts,
  onEnabledIds,
  onDrafts,
}: {
  clients: Client[];
  projects: Project[];
  enabledIds: string[];
  drafts: Record<string, CompanyMembershipDraft>;
  onEnabledIds: (ids: string[]) => void;
  onDrafts: (next: Record<string, CompanyMembershipDraft>) => void;
}) {
  if (clients.length === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Não há empresas.{" "}
        <Link href="/admin/clients" className="text-[var(--accent)] hover:underline">
          Criar empresa
        </Link>
        .
      </p>
    );
  }

  const toggleCompany = (id: string, on: boolean) => {
    onEnabledIds(on ? [...enabledIds, id] : enabledIds.filter((x) => x !== id));
  };

  const patchDraft = (id: string, patch: Partial<CompanyMembershipDraft>) => {
    const cur = drafts[id] ?? { clientId: id, accessAllProjects: true, projectIds: [] };
    onDrafts({ ...drafts, [id]: { ...cur, ...patch, clientId: id } });
  };

  return (
    <div className="mt-4 space-y-3">
      <Label>Empresas e projetos</Label>
      {clients.map((c) => {
        const on = enabledIds.includes(c.id);
        const d = drafts[c.id] ?? { clientId: c.id, accessAllProjects: true, projectIds: [] };
        const companyProjects = projects.filter((p) => p.clientId === c.id);
        return (
          <div key={c.id} className="rounded-md border border-[var(--border)] p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[var(--border)]"
                checked={on}
                onChange={(e) => toggleCompany(c.id, e.target.checked)}
              />
              {c.name}
            </label>
            {on ? (
              companyProjects.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Esta empresa ainda não tem projetos. Quando existirem, você marca o acesso aqui.
                </p>
              ) : (
                <div className="mt-2 pl-6">
                  <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--border)]"
                      checked={d.accessAllProjects}
                      onChange={(e) => {
                        const all = e.target.checked;
                        patchDraft(c.id, {
                          accessAllProjects: all,
                          projectIds: all ? companyProjects.map((p) => p.id) : d.projectIds,
                        });
                      }}
                    />
                    Todos os projetos desta empresa
                  </label>
                  <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
                    {companyProjects.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border)]"
                          checked={d.accessAllProjects || d.projectIds.includes(p.id)}
                          disabled={d.accessAllProjects}
                          onChange={() => {
                            const next = d.projectIds.includes(p.id)
                              ? d.projectIds.filter((x) => x !== p.id)
                              : [...d.projectIds, p.id];
                            patchDraft(c.id, { projectIds: next, accessAllProjects: false });
                          }}
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
