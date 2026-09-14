"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DataTable, FilterBar, FilterChip } from "@/components/hub/filter-table";
import { Modal } from "@/components/hub/modal";
import { CenterNotice } from "@/components/hub/center-notice";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState } from "@/components/hub/states";
import { DEMO_PASSWORD } from "@/lib/mock/seed";
import { useHubStore } from "@/stores/hub-store";
import type { Role, User } from "@/types";
import {
  UserMembershipFields,
  emptyMembershipDrafts,
  membershipError,
  selectedMemberships,
  type CompanyMembershipDraft,
} from "@/components/hub/user-membership-fields";

const ROLES: Role[] = ["ADMIN", "MANAGER", "CLIENT"];
const ROLE_FILTERS: Array<{ id: "ALL" | Role; label: string }> = [
  { id: "ALL", label: "Todos" },
  { id: "CLIENT", label: "CLIENT" },
  { id: "MANAGER", label: "MANAGER" },
  { id: "ADMIN", label: "ADMIN" },
];

function copyAccess(email: string, password: string): Promise<boolean> {
  const text = `Login: ${email}\nSenha temporária: ${password}\nURL: ${window.location.origin}/login`;
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}

export default function AdminUsersPage() {
  const users = useHubStore((s) => s.users);
  const clients = useHubStore((s) => s.clients);
  const projects = useHubStore((s) => s.projects);
  const upsertUser = useHubStore((s) => s.upsertUser);
  const toggleUserActive = useHubStore((s) => s.toggleUserActive);
  const deleteUser = useHubStore((s) => s.deleteUser);
  const refreshUsers = useHubStore((s) => s.refreshUsers);
  const session = useHubStore((s) => s.session);

  const clientMap = useMemo(
    () => Object.fromEntries(clients.map((c) => [c.id, c.name])),
    [clients]
  );
  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [enabledClientIds, setEnabledClientIds] = useState<string[]>([]);
  const [membershipDrafts, setMembershipDrafts] = useState<Record<string, CompanyMembershipDraft>>({});
  const [createdAccess, setCreatedAccess] = useState<{
    email: string;
    tempPassword: string;
    isClient: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const clientInviteBlocked = role === "CLIENT" && clients.length === 0;

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, roleFilter, query]);

  const openCreate = () => {
    setRole("CLIENT");
    setMembershipDrafts(emptyMembershipDrafts(clients));
    setEnabledClientIds(clients[0] ? [clients[0].id] : []);
    setOpen(true);
  };

  const submit = async () => {
    if (clientInviteBlocked) {
      toast.error("Crie uma empresa (cliente) antes de criar um usuário CLIENT.");
      return;
    }
    if (role === "CLIENT") {
      const err = membershipError(enabledClientIds, membershipDrafts, projects);
      if (err) {
        toast.error(err);
        return;
      }
    }
    if (role !== "CLIENT" && !name.trim()) {
      toast.error("Informe nome e e-mail.");
      return;
    }
    if (!email.trim()) {
      toast.error("Informe o e-mail.");
      return;
    }

    const memberships =
      role === "CLIENT" ? selectedMemberships(membershipDrafts, enabledClientIds) : [];
    const result = await upsertUser({
      name: name.trim() || "Convidado",
      email: email.trim(),
      role,
      clientId: memberships[0]?.clientId ?? null,
      active: true,
      accessAllProjects: memberships[0]?.accessAllProjects ?? true,
      projectIds: memberships.flatMap((m) => (m.accessAllProjects ? [] : m.projectIds)),
      memberships,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    if (result.tempPassword) {
      setCopied(false);
      setCreatedAccess({
        email: result.user.email,
        tempPassword: result.tempPassword,
        isClient: role === "CLIENT",
      });
    }

    setName("");
    setEmail("");
    setRole("CLIENT");
    setEnabledClientIds([]);
    setMembershipDrafts({});
    setOpen(false);
  };

  const rows = filteredUsers.map((u) => {
    const projectLabel =
      u.role !== "CLIENT"
        ? "—"
        : (u.memberships ?? []).some((m) => m.accessAllProjects) ||
            (!u.memberships?.length && (u.accessAllProjects || !u.projectIds?.length))
          ? u.memberships && u.memberships.length > 1
            ? "Vários projetos"
            : "Todos os projetos"
          : u.projectIds.map((id) => projectMap[id] ?? id).join(", ");
    const companyLabel =
      u.role !== "CLIENT"
        ? "—"
        : (u.memberships?.length ? u.memberships.map((m) => clientMap[m.clientId] ?? m.clientId) : u.clientId ? [clientMap[u.clientId] ?? "—"] : []).join(", ") || "—";
    return {
      name: (
        <Link href={`/admin/users/${u.id}`} className="block hover:text-[var(--accent)] hub-focus rounded-sm">
          <p className="font-medium">{u.name}</p>
          <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
        </Link>
      ),
      role: (
        <div>
          <p>{u.role}</p>
          {u.role === "CLIENT" && u.mustCompleteProfile ? (
            <p className="text-xs text-[var(--warning)]">Aguardando cadastro</p>
          ) : null}
        </div>
      ),
      client: companyLabel,
      projects: <span className="text-xs text-[var(--text-secondary)]">{projectLabel}</span>,
      active: (
        <div className="flex items-center gap-2">
          <Switch
            checked={u.active}
            onCheckedChange={() => {
              void toggleUserActive(u.id).then((result) => {
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                toast.success(u.active ? "Usuário desativado" : "Usuário ativado");
              });
            }}
            aria-label={`Ativo ${u.name}`}
          />
          <span className="text-xs text-[var(--text-muted)]">{u.active ? "Ativo" : "Inativo"}</span>
        </div>
      ),
      actions: (
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/users/${u.id}`}>Editar</Link>
          </Button>
          {session?.id !== u.id && !(session?.role === "MANAGER" && u.role === "ADMIN") ? (
            <Button variant="danger" size="sm" type="button" onClick={() => setPendingDelete(u)}>
              Excluir
            </Button>
          ) : null}
        </div>
      ),
    };
  });

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        icon={Users}
        title="Usuários"
        description="Veja, edite, desative ou exclua cada login. Uma empresa pode ter vários usuários."
        actions={
          <Button variant="accent" size="lg" className="w-full sm:w-auto" onClick={openCreate}>
            <UserPlus className="h-5 w-5" />
            Criar usuário
          </Button>
        }
      />

      <div className="hub-surface mb-6 border-[var(--accent)]/40 p-4 sm:hidden">
        <p className="text-sm font-medium text-[var(--text-primary)]">Novo login de cliente</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Convide quem vai acompanhar os projetos desta empresa.
        </p>
        <Button variant="accent" className="mt-3 w-full" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Criar usuário
        </Button>
      </div>

      {users.length === 0 ? (
        <EmptyState
          title="Nenhum usuário ainda"
          description="Crie um login para a equipe ou para uma empresa."
          action={
            <Button variant="accent" size="lg" onClick={openCreate}>
              <UserPlus className="h-5 w-5" />
              Criar usuário
            </Button>
          }
        />
      ) : (
        <>
          <FilterBar>
            {ROLE_FILTERS.map((f) => (
              <FilterChip key={f.id} active={roleFilter === f.id} onClick={() => setRoleFilter(f.id)}>
                {f.label}
              </FilterChip>
            ))}
            <label className="ml-auto flex min-w-[180px] flex-1 items-center sm:max-w-xs">
              <span className="sr-only">Buscar usuário</span>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar nome ou e-mail"
                className="h-8"
              />
            </label>
          </FilterBar>
          <DataTable
            columns={[
              { key: "name", header: "Usuário" },
              { key: "role", header: "Papel" },
              { key: "client", header: "Empresa" },
              { key: "projects", header: "Projetos" },
              { key: "active", header: "Status" },
              { key: "actions", header: "Ações" },
            ]}
            rows={rows}
            empty={
              <EmptyState
                title="Nenhum usuário neste filtro"
                description="Ajuste o papel ou a busca. O botão Criar usuário continua disponível."
              />
            }
          />
        </>
      )}

      <button
        type="button"
        onClick={openCreate}
        className="fixed bottom-20 right-4 z-50 flex h-14 items-center gap-2 rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-lg md:hidden hub-focus"
      >
        <Plus className="h-5 w-5" />
        Criar usuário
      </button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Criar usuário"
        description={`Senha temporária ${DEMO_PASSWORD}. O cliente troca no primeiro acesso.`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="u-name">Nome {role === "CLIENT" ? "(opcional)" : ""}</Label>
            <Input
              id="u-name"
              className="mt-1.5"
              value={name}
              placeholder={role === "CLIENT" ? "O cliente preenche na 1ª entrada" : ""}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="u-email">E-mail</Label>
            <Input
              id="u-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="u-role">Papel</Label>
            <select
              id="u-role"
              className="mt-1.5 hub-control"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r === "CLIENT" ? "CLIENT — acesso da empresa" : r}
                </option>
              ))}
            </select>
          </div>
          {role === "CLIENT" ? (
            <UserMembershipFields
              clients={clients}
              projects={projects}
              enabledIds={enabledClientIds}
              drafts={membershipDrafts}
              onEnabledIds={setEnabledClientIds}
              onDrafts={setMembershipDrafts}
            />
          ) : null}
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-elevated)] pt-3">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" type="button" onClick={submit} disabled={clientInviteBlocked}>
              Criar usuário
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
        title="Excluir usuário?"
        description={
          pendingDelete
            ? `${pendingDelete.name} (${pendingDelete.email}) será apagado. Chamados e updates antigos ficam, sem o nome desta pessoa. Esta ação não pode ser desfeita.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            disabled={deleting}
            onClick={() => setPendingDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!pendingDelete) return;
              setDeleting(true);
              const result = await deleteUser(pendingDelete.id);
              setDeleting(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setPendingDelete(null);
              toast.success("Usuário excluído");
            }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </Modal>

      <CenterNotice
        open={Boolean(createdAccess)}
        onClose={() => {
          setCreatedAccess(null);
          setCopied(false);
        }}
        title="Usuário criado"
      >
        {createdAccess ? (
          <div className="space-y-3">
            <p>
              <span className="block text-xs uppercase tracking-wide text-[var(--text-muted)]">E-mail</span>
              <span className="font-medium text-[var(--text-primary)]">{createdAccess.email}</span>
            </p>
            <p>
              <span className="block text-xs uppercase tracking-wide text-[var(--text-muted)]">
                Senha temporária
              </span>
              <span className="font-medium text-[var(--text-primary)]">{createdAccess.tempPassword}</span>
            </p>
            {createdAccess.isClient ? (
              <p>Na 1ª entrada o cliente completa o cadastro e troca a senha.</p>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const ok = await copyAccess(createdAccess.email, createdAccess.tempPassword);
                if (ok) setCopied(true);
                else toast.error("Não foi possível copiar");
              }}
            >
              {copied ? "Copiado" : "Copiar acesso"}
            </Button>
          </div>
        ) : null}
      </CenterNotice>
    </div>
  );
}
