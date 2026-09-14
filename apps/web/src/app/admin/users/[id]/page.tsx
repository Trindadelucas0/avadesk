"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CenterNotice } from "@/components/hub/center-notice";
import { Modal } from "@/components/hub/modal";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import type { Role } from "@/types";
import {
  UserMembershipFields,
  emptyMembershipDrafts,
  membershipError,
  selectedMemberships,
  type CompanyMembershipDraft,
} from "@/components/hub/user-membership-fields";

const ROLES: Role[] = ["ADMIN", "MANAGER", "CLIENT"];

function copyAccess(email: string, password: string): Promise<boolean> {
  const text = `Login: ${email}\nSenha: ${password}\nURL: ${window.location.origin}/login`;
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}

function generatePassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%";
  const all = upper + lower + digits + symbols;
  const pick = (src: string) => src[crypto.getRandomValues(new Uint8Array(1))[0] % src.length];
  const chars = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = crypto.getRandomValues(new Uint8Array(8));
  for (const b of rest) chars.push(all[b % all.length]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint8Array(1))[0] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join("");
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);
  const user = useHubStore((s) => s.users.find((u) => u.id === id));
  const session = useHubStore((s) => s.session);
  const clients = useHubStore((s) => s.clients);
  const projects = useHubStore((s) => s.projects);
  const fetchUser = useHubStore((s) => s.fetchUser);
  const updateUser = useHubStore((s) => s.updateUser);
  const setUserPassword = useHubStore((s) => s.setUserPassword);
  const sendUserWelcomeEmail = useHubStore((s) => s.sendUserWelcomeEmail);
  const deleteUser = useHubStore((s) => s.deleteUser);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [sendingWelcome, setSendingWelcome] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [enabledClientIds, setEnabledClientIds] = useState<string[]>([]);
  const [membershipDrafts, setMembershipDrafts] = useState<Record<string, CompanyMembershipDraft>>({});
  const [active, setActive] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    void fetchUser(id)
      .then((u) => {
        if (!u) setNotFound(true);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    void fetchUser(id)
      .then((u) => {
        if (cancelled) return;
        if (!u) setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetchUser]);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setActive(user.active);
    const mems =
      user.memberships && user.memberships.length > 0
        ? user.memberships
        : user.clientId
          ? [
              {
                clientId: user.clientId,
                accessAllProjects: user.accessAllProjects || !user.projectIds?.length,
                projectIds: user.projectIds ?? [],
              },
            ]
          : [];
    setEnabledClientIds(mems.map((m) => m.clientId));
    setMembershipDrafts(emptyMembershipDrafts(clients, mems));
  }, [user, clients]);

  const saveProfile = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    if (!email.trim()) {
      toast.error("Informe o e-mail.");
      return;
    }
    if (role === "CLIENT") {
      const err = membershipError(enabledClientIds, membershipDrafts, projects);
      if (err) {
        toast.error(err);
        return;
      }
    }
    const memberships =
      role === "CLIENT" ? selectedMemberships(membershipDrafts, enabledClientIds) : [];
    setSaving(true);
    const result = await updateUser(id, {
      name: name.trim(),
      email: email.trim(),
      role,
      clientId: memberships[0]?.clientId ?? null,
      active,
      accessAllProjects: memberships[0]?.accessAllProjects ?? true,
      projectIds: memberships.flatMap((m) => (m.accessAllProjects ? [] : m.projectIds)),
      memberships,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Usuário atualizado");
  };

  const savePassword = async () => {
    if (password.length < 8) {
      toast.error("A nova senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("A confirmação da senha não confere.");
      return;
    }
    setSavingPassword(true);
    const result = await setUserPassword(id, password);
    setSavingPassword(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setCopied(false);
    setPasswordNotice(password);
    setPassword("");
    setPasswordConfirm("");
  };

  if (loading && !user) {
    return <PageSkeleton />;
  }

  if (loadError) {
    return (
      <ErrorState
        title="Não foi possível carregar o usuário"
        description="Verifique a conexão e tente de novo."
        onRetry={load}
      />
    );
  }

  if (notFound || !user) {
    return (
      <EmptyState
        title="Usuário não encontrado"
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/users">Voltar</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="pb-24 md:pb-0">
      <Button variant="ghost" size="sm" className="mb-4 -ml-2" asChild>
        <Link href="/admin/users">
          <ArrowLeft className="h-4 w-4" />
          Usuários
        </Link>
      </Button>

      <PageHeader
        icon={Users}
        title={user.name || user.email}
        description={`${user.email} · ${user.role} · ${user.active ? "Ativo" : "Inativo"}`}
      />

      {user.role === "CLIENT" && user.mustCompleteProfile ? (
        <p className="mb-6 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
          Aguardando cadastro: o cliente ainda não completou o perfil no primeiro acesso.
        </p>
      ) : null}

      <section className="hub-surface mb-6 p-4">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Identidade
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ud-name">Nome</Label>
            <Input
              id="ud-name"
              className="mt-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="ud-email">E-mail</Label>
            <Input
              id="ud-email"
              type="email"
              className="mt-1.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>
      </section>

      <section className="hub-surface mb-6 p-4">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Acesso</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ud-role">Papel</Label>
            <select
              id="ud-role"
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
            <p className="self-end text-sm text-[var(--text-secondary)]">
              Marque uma ou mais empresas abaixo.
            </p>
          ) : (
            <p className="self-end text-sm text-[var(--text-secondary)]">
              ADMIN e MANAGER não ficam vinculados a uma empresa.
            </p>
          )}
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
      </section>

      <section className="hub-surface mb-6 p-4">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Conta</h2>
        <div className="flex items-center gap-3">
          <Switch
            id="ud-active"
            checked={active}
            onCheckedChange={setActive}
            aria-label="Usuário ativo"
          />
          <Label htmlFor="ud-active">{active ? "Ativo" : "Inativo"}</Label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="accent" className="w-full sm:w-auto" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
        {session?.id !== user.id && !(session?.role === "MANAGER" && user.role === "ADMIN") ? (
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <p className="text-sm font-medium text-[var(--text-primary)]">Zona de risco</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Apaga o login. Chamados e updates antigos ficam sem o nome desta pessoa.
            </p>
            <Button
              variant="danger"
              type="button"
              className="mt-3 w-full sm:w-auto"
              onClick={() => setConfirmDelete(true)}
            >
              Excluir usuário
            </Button>
          </div>
        ) : null}
      </section>

      <section className="hub-surface mb-6 p-4">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          E-mail de boas-vindas
        </h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Envia o mesmo e-mail (sem senha) para o login desta conta.
        </p>
        {!user.active ? (
          <p className="mb-3 text-sm text-[var(--text-muted)]">Ative a conta para enviar.</p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          disabled={!user.active || sendingWelcome}
          onClick={async () => {
            setSendingWelcome(true);
            try {
              const result = await sendUserWelcomeEmail(user.id);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              toast.success("E-mail enviado");
            } finally {
              setSendingWelcome(false);
            }
          }}
        >
          {sendingWelcome ? "Enviando…" : "Reenviar e-mail"}
        </Button>
      </section>

      <section className="hub-surface mb-6 p-4">
        <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">Senha</h2>
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          8 caracteres ou mais. Não enviamos senha por e-mail — copie e entregue fora do sistema.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ud-password">Nova senha</Label>
            <Input
              id="ud-password"
              type="password"
              className="mt-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="ud-password-confirm">Confirmar</Label>
            <Input
              id="ud-password-confirm"
              type="password"
              className="mt-1.5"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={() => {
              const next = generatePassword();
              setPassword(next);
              setPasswordConfirm(next);
            }}
          >
            Gerar
          </Button>
          <Button
            type="button"
            variant="accent"
            className="w-full sm:w-auto"
            onClick={() => void savePassword()}
            disabled={savingPassword}
          >
            {savingPassword ? "Definindo…" : "Definir senha"}
          </Button>
        </div>
      </section>

      <Modal
        open={confirmDelete}
        onOpenChange={(open) => {
          if (!open && !deleting) setConfirmDelete(false);
        }}
        title="Excluir usuário?"
        description={`${user.name} (${user.email}) será apagado. Esta ação não pode ser desfeita.`}
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              const result = await deleteUser(user.id);
              setDeleting(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setConfirmDelete(false);
              toast.success("Usuário excluído");
              router.push("/admin/users");
            }}
          >
            {deleting ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </Modal>

      <CenterNotice
        open={Boolean(passwordNotice)}
        onClose={() => {
          setPasswordNotice(null);
          setCopied(false);
        }}
        title="Senha atualizada"
      >
        {passwordNotice ? (
          <div className="space-y-3">
            <p>
              <span className="block text-xs uppercase tracking-wide text-[var(--text-muted)]">E-mail</span>
              <span className="font-medium text-[var(--text-primary)]">{user.email}</span>
            </p>
            <p>
              <span className="block text-xs uppercase tracking-wide text-[var(--text-muted)]">Nova senha</span>
              <span className="font-medium text-[var(--text-primary)]">{passwordNotice}</span>
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              Uma sessão já aberta pode continuar até expirar. Desative a conta se precisar bloquear agora.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                const ok = await copyAccess(user.email, passwordNotice);
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
