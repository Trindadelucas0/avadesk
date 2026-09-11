"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CenterNotice } from "@/components/hub/center-notice";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/hub/states";
import { useHubStore } from "@/stores/hub-store";
import type { Role } from "@/types";

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
  const id = String(params.id);
  const user = useHubStore((s) => s.users.find((u) => u.id === id));
  const clients = useHubStore((s) => s.clients);
  const projects = useHubStore((s) => s.projects);
  const fetchUser = useHubStore((s) => s.fetchUser);
  const updateUser = useHubStore((s) => s.updateUser);
  const setUserPassword = useHubStore((s) => s.setUserPassword);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("CLIENT");
  const [clientId, setClientId] = useState("");
  const [active, setActive] = useState(true);
  const [accessAll, setAccessAll] = useState(true);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedClientId = clientId || clients[0]?.id || "";
  const companyProjects = projects.filter((p) => p.clientId === selectedClientId);

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
    setClientId(user.clientId ?? "");
    setActive(user.active);
    setAccessAll(user.role !== "CLIENT" || user.accessAllProjects || !user.projectIds?.length);
    setSelectedProjects(user.projectIds ?? []);
  }, [user]);

  const toggleProject = (projectId: string) => {
    setSelectedProjects((cur) =>
      cur.includes(projectId) ? cur.filter((x) => x !== projectId) : [...cur, projectId]
    );
  };

  const saveProfile = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    if (!email.trim()) {
      toast.error("Informe o e-mail.");
      return;
    }
    if (role === "CLIENT" && !selectedClientId) {
      toast.error("Selecione a empresa.");
      return;
    }
    if (role === "CLIENT" && companyProjects.length > 0 && !accessAll && selectedProjects.length === 0) {
      toast.error("Selecione ao menos um projeto, ou marque todos os projetos da empresa.");
      return;
    }
    setSaving(true);
    const result = await updateUser(id, {
      name: name.trim(),
      email: email.trim(),
      role,
      clientId: role === "CLIENT" ? selectedClientId : null,
      active,
      accessAllProjects: role !== "CLIENT" || accessAll || companyProjects.length === 0,
      projectIds: role === "CLIENT" && !accessAll ? selectedProjects : [],
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
            <div>
              <Label htmlFor="ud-client">Empresa</Label>
              {clients.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Não há empresas.{" "}
                  <Link href="/admin/clients" className="text-[var(--accent)] hover:underline">
                    Criar empresa
                  </Link>
                  .
                </p>
              ) : (
                <select
                  id="ud-client"
                  className="mt-1.5 hub-control"
                  value={selectedClientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setSelectedProjects([]);
                    setAccessAll(true);
                  }}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <p className="self-end text-sm text-[var(--text-secondary)]">
              ADMIN e MANAGER não ficam vinculados a uma empresa.
            </p>
          )}
        </div>
        {role === "CLIENT" ? (
          companyProjects.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Esta empresa ainda não tem projetos. Quando existirem, você marca o acesso aqui.
            </p>
          ) : (
            <div className="mt-4">
              <Label>Projetos que este usuário pode ver</Label>
              <label className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={accessAll}
                  onChange={(e) => {
                    setAccessAll(e.target.checked);
                    if (e.target.checked) setSelectedProjects(companyProjects.map((p) => p.id));
                  }}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                Todos os projetos desta empresa
              </label>
              <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-md border border-[var(--border)] p-3">
                {companyProjects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={accessAll || selectedProjects.includes(p.id)}
                      disabled={accessAll}
                      onChange={() => toggleProject(p.id)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )
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
