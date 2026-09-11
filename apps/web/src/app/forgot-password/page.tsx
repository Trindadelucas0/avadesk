"use client";

import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { v2 } from "@/lib/v2-client";
import { Button } from "@/components/ui/button";
import {
  AUTH_CTA,
  AuthBackLink,
  AuthCard,
  AuthField,
  AuthHeader,
  AuthShell,
} from "@/components/hub/auth-shell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <AuthShell>
      <AuthCard>
        <AuthHeader
          icon={Mail}
          title="Recuperar senha"
          subtitle="Se o e-mail existir, enviaremos um link que expira em 1 hora."
        />
        {sent ? (
          <p className="text-sm text-[var(--success)]" role="status">
            Se o e-mail existir, o link foi enviado. Verifique sua caixa de entrada.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                await v2("/auth/forgot", { method: "POST", json: { email } });
              } catch {
                /* always generic */
              }
              setBusy(false);
              setSent(true);
            }}
          >
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
            <Button type="submit" className={AUTH_CTA} disabled={busy}>
              {busy ? "Enviando…" : "Enviar link"}
              {busy ? null : <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}
        <AuthBackLink />
      </AuthCard>
    </AuthShell>
  );
}
