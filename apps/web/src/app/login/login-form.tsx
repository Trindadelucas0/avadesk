"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CenterNotice } from "@/components/hub/center-notice";
import {
  AUTH_CTA,
  AUTH_CTA_ACCENT,
  AuthBrand,
  AuthCard,
  AuthField,
  AuthHeader,
  AuthShell,
} from "@/components/hub/auth-shell";
import { useHubStore } from "@/stores/hub-store";
import { roleHome } from "@/components/auth-gate";
import { signIn } from "@/lib/hub-sync";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";

function postLoginPath(user: SessionUser, next: string | null): string {
  if (user.mustCompleteProfile) return "/client/onboarding";
  return next || roleHome(user.role, user.mustCompleteProfile);
}

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    if (hydrated && session && !welcomeName && !pendingPath) {
      router.replace(postLoginPath(session, params.get("next")));
    }
  }, [hydrated, session, router, params, welcomeName, pendingPath]);

  const goAfterWelcome = () => {
    const path = pendingPath;
    setWelcomeName(null);
    setPendingPath(null);
    if (path) router.replace(path);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setWelcomeName(result.user.name.trim().split(" ")[0] || result.user.email.split("@")[0]);
    setPendingPath(postLoginPath(result.user, params.get("next")));
  };

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={Mail}
          title="Acesse sua conta"
          subtitle="Bem-vindo de volta! Faça login para continuar."
        />
        <form onSubmit={onSubmit} className="space-y-4">
          <AuthField
            id="email"
            label="E-mail"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
            id="password"
            label="Senha"
            icon={Lock}
            autoComplete="current-password"
            placeholder="Digite sua senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            revealable
          />
          <div className="flex items-center justify-between gap-3 text-sm">
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
              />
              Lembrar
            </label>
            <Link href="/forgot-password" className="text-[var(--accent)] hover:underline hub-focus rounded-sm">
              Esqueci a senha
            </Link>
          </div>
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            variant="accent"
            className={cn(AUTH_CTA, AUTH_CTA_ACCENT)}
            disabled={busy || !hydrated}
          >
            {busy || !hydrated ? "Entrando…" : "Entrar"}
            {busy || !hydrated ? null : <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>
        <AuthBrand />
      </AuthCard>
      <CenterNotice
        open={Boolean(welcomeName)}
        onClose={goAfterWelcome}
        title={welcomeName ? `Olá, ${welcomeName}` : ""}
        autoCloseMs={3000}
        closeOnOverlay
      />
    </AuthShell>
  );
}
