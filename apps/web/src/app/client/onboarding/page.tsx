"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Instagram, Lock, Mail, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AUTH_CTA,
  AUTH_CTA_ACCENT,
  AuthCard,
  AuthField,
  AuthMark,
  AuthShell,
} from "@/components/hub/auth-shell";
import { useHubStore } from "@/stores/hub-store";
import { cn } from "@/lib/utils";

export default function ClientOnboardingPage() {
  const router = useRouter();
  const session = useHubStore((s) => s.session);
  const users = useHubStore((s) => s.users);
  const completeClientProfile = useHubStore((s) => s.completeClientProfile);

  const user = users.find((u) => u.id === session?.id);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [instagramCompany, setInstagramCompany] = useState("");
  const [instagramPersonal, setInstagramPersonal] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name === "Convidado" ? "" : user.name);
      setEmail(user.email);
      setInstagramCompany(user.instagramCompany ?? "");
      setInstagramPersonal(user.instagramPersonal ?? "");
    }
  }, [user]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setBusy(true);
    const result = await completeClientProfile({
      userId: session.id,
      name,
      email,
      password,
      passwordConfirm,
      instagramCompany,
      instagramPersonal,
    });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Cadastro concluído. Bem-vindo à Avadesk.");
    router.replace("/client");
  };

  return (
    <AuthShell wide>
      <div className="mb-8 text-center">
        <AuthMark />
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-balance">
          Complete seu <span className="text-[var(--accent)]">cadastro</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Confirme seus dados e defina uma senha nova. Instagrams são opcionais.
        </p>
      </div>
      <AuthCard>
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField
            id="full-name"
            label="Nome completo"
            icon={UserRound}
            autoComplete="name"
            placeholder="Ex: Lucas Rodrigues"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={3}
          />
          <AuthField
            id="ob-email"
            label="E-mail"
            icon={Mail}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
            id="ob-password"
            label="Nova senha"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Digite sua nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            revealable
          />
          <p className="-mt-2 text-xs text-[var(--text-muted)]">
            Mínimo 8 caracteres. Substitui a senha temporária.
          </p>
          <AuthField
            id="ob-password-confirm"
            label="Confirmar senha"
            icon={Lock}
            autoComplete="new-password"
            placeholder="Digite novamente sua senha"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            required
            minLength={8}
            revealable
          />
          <AuthField
            id="ig-company"
            label="Instagram da empresa (opcional)"
            icon={Instagram}
            placeholder="@empresa"
            value={instagramCompany}
            onChange={(e) => setInstagramCompany(e.target.value)}
            autoComplete="off"
          />
          <AuthField
            id="ig-personal"
            label="Instagram pessoal (opcional)"
            icon={Instagram}
            placeholder="@você"
            value={instagramPersonal}
            onChange={(e) => setInstagramPersonal(e.target.value)}
            autoComplete="off"
          />
          <Button
            type="submit"
            variant="accent"
            className={cn(AUTH_CTA, AUTH_CTA_ACCENT)}
            disabled={busy}
          >
            {busy ? "Salvando…" : "Concluir e entrar"}
            {busy ? null : <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
