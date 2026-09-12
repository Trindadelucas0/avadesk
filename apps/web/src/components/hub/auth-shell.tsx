"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConnectedParticles } from "@/components/hub/connected-particles";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand";

export const AUTH_CTA =
  "auth-cta inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-semibold";

export const AUTH_CTA_ACCENT =
  "auth-cta-accent border-0 bg-[image:var(--accent-gradient)] text-white shadow-[var(--accent-shadow-lg)] hover:brightness-110";

export function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <ConnectedParticles />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-60"
        style={{ background: "var(--auth-glow)" }}
      />
      <div className={cn("relative z-10 w-full animate-fade-in", wide ? "max-w-[480px]" : "max-w-[420px]")}>
        {children}
      </div>
    </div>
  );
}

export function AuthMark() {
  return (
    <div
      className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-white shadow-[0_10px_24px_rgba(107,140,255,0.4)]"
      style={{ background: "var(--brand-gradient)" }}
      aria-hidden
    >
      ◈
    </div>
  );
}

export function AuthCard({ children }: { children: ReactNode }) {
  return <div className="auth-card">{children}</div>;
}

export function AuthHeader({
  icon: Icon,
  title,
  subtitle,
  alert,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  alert?: boolean;
}) {
  return (
    <div className="mb-7 flex items-start gap-3">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white shadow-[0_8px_18px_rgba(107,140,255,0.35)]"
        style={{ background: "var(--brand-gradient)" }}
        aria-hidden
      >
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 pt-0.5">
        <h1 className="text-[1.35rem] font-semibold tracking-tight text-balance">{title}</h1>
        <p
          className="mt-1 text-sm leading-snug text-[var(--text-secondary)]"
          role={alert ? "alert" : undefined}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  id: string;
  label: string;
  icon: LucideIcon;
  revealable?: boolean;
};

export function AuthField({
  id,
  label,
  icon: Icon,
  revealable = false,
  className,
  type,
  ...props
}: AuthFieldProps) {
  const [show, setShow] = useState(false);
  const resolvedType = revealable ? (show ? "text" : "password") : type;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-1.5">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <Input
          id={id}
          type={resolvedType}
          className={cn("auth-field", revealable && "pr-11", className)}
          {...props}
        />
        {revealable ? (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hub-focus"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function AuthBrand() {
  return <p className="mt-6 text-center text-xs text-[var(--text-muted)]">{PRODUCT_NAME}</p>;
}

export function AuthBackLink() {
  return (
    <Link
      href="/login"
      className="mt-6 inline-block text-sm text-[var(--accent)] hover:underline hub-focus rounded-sm"
    >
      Voltar ao login
    </Link>
  );
}
