"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function FolderGrid({ children }: { children: React.ReactNode }) {
  return <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</ul>;
}

export function FolderCard({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="hub-surface hub-focus flex min-h-[5.5rem] flex-col justify-center px-4 py-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]"
      >
        <span className="truncate text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <span className="mt-1 text-xs text-[var(--text-muted)]">{subtitle}</span>
      </Link>
    </li>
  );
}

export function FilesBreadcrumb({
  backHref,
  backLabel,
  current,
}: {
  backHref: string;
  backLabel: string;
  current: string;
}) {
  return (
    <nav aria-label="Navegação da pasta" className="mb-2 flex flex-wrap items-center gap-2 text-sm">
      <Link
        href={backHref}
        className={cn(
          "hub-focus inline-flex min-h-11 items-center gap-1 rounded-sm text-[var(--accent)] hover:underline"
        )}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
        {backLabel}
      </Link>
      <span className="text-[var(--text-muted)]" aria-hidden>
        /
      </span>
      <span className="min-w-0 truncate font-medium text-[var(--text-primary)]">{current}</span>
    </nav>
  );
}
