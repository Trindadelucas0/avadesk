"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_CTA, AUTH_CTA_ACCENT, AuthCard, AuthMark, AuthShell } from "@/components/hub/auth-shell";
import { cn } from "@/lib/utils";

export default function InvitePage() {
  return (
    <AuthShell>
      <div className="mb-8 text-center">
        <AuthMark />
        <h1 className="text-[1.5rem] font-semibold tracking-tight">Convite à Avadesk</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Entre com o e-mail e a senha temporária que o admin enviou. No primeiro acesso você
          completa nome e senha nova. Instagrams são opcionais.
        </p>
      </div>
      <AuthCard>
        <Button asChild variant="accent" className={cn(AUTH_CTA, AUTH_CTA_ACCENT)}>
          <Link href="/login">
            Ir para o login
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </AuthCard>
    </AuthShell>
  );
}
