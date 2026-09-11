"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AUTH_CTA,
  AUTH_CTA_ACCENT,
  AuthBackLink,
  AuthCard,
  AuthField,
  AuthHeader,
  AuthShell,
} from "@/components/hub/auth-shell";
import { cn } from "@/lib/utils";
import { v2, ApiError } from "@/lib/v2-client";

export default function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(!token);

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={Lock}
          title="Nova senha"
          subtitle={
            invalid
              ? "Link inválido ou expirado."
              : "Defina uma senha com pelo menos 8 caracteres."
          }
          alert={invalid}
        />
        {invalid ? (
          <Button asChild className={cn(AUTH_CTA, AUTH_CTA_ACCENT)} variant="accent">
            <Link href="/forgot-password">
              Pedir novo link
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (password.length < 8 || password !== confirm) {
                toast.error("Senhas devem coincidir e ter 8+ caracteres");
                return;
              }
              setBusy(true);
              try {
                await v2("/auth/reset", { method: "POST", json: { token, password } });
                toast.success("Senha atualizada");
                router.push("/login");
              } catch (err) {
                if (err instanceof ApiError && err.status === 400) {
                  setInvalid(true);
                  return;
                }
                toast.error(err instanceof ApiError ? err.message : "Não foi possível redefinir a senha.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <AuthField
              id="password"
              label="Nova senha"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Digite a nova senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              revealable
            />
            <AuthField
              id="confirm"
              label="Confirmar"
              icon={Lock}
              autoComplete="new-password"
              placeholder="Confirme a nova senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              revealable
            />
            <Button type="submit" variant="accent" className={cn(AUTH_CTA, AUTH_CTA_ACCENT)} disabled={busy}>
              {busy ? "Salvando…" : "Salvar senha"}
              {busy ? null : <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}
        <AuthBackLink />
      </AuthCard>
    </AuthShell>
  );
}
