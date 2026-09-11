"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/hub/states";

const toneClass = {
  default: "",
  warning: "border-[rgba(245,185,66,0.45)] shadow-[0_0_24px_rgba(245,185,66,0.12)]",
  danger: "border-[rgba(240,113,120,0.45)] shadow-[0_0_24px_rgba(240,113,120,0.12)]",
  success: "border-[rgba(61,220,151,0.4)] shadow-[0_0_24px_rgba(61,220,151,0.12)]",
} as const;

export function KpiStat({
  label,
  value,
  hint,
  tone = "default",
  href,
  loading,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: keyof typeof toneClass;
  href?: string;
  loading?: boolean;
}) {
  const inner = (
    <>
      {loading ? (
        <Skeleton className="h-8 w-12" />
      ) : (
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">
          {value}
        </p>
      )}
      <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{hint}</p> : null}
    </>
  );

  const className = cn(
    "hub-surface block min-w-[9.5rem] shrink-0 p-4 text-left hub-focus",
    toneClass[tone],
    href ? "transition-colors hover:border-[var(--border-strong)]" : ""
  );

  if (href) {
    if (href.startsWith("#")) {
      return (
        <a href={href} className={className}>
          {inner}
        </a>
      );
    }
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
