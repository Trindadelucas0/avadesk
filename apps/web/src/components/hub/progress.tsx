"use client";

import { cn } from "@/lib/utils";

export function ProgressBar({
  value,
  className,
  size = "md",
}: {
  value: number;
  className?: string;
  size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-full bg-[var(--progress-track)]",
        size === "sm" ? "h-1.5" : "h-2",
        className
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-[var(--progress)] transition-[width] duration-slow"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ProjectProgress({
  value,
  label,
  className,
}: {
  value: number;
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative h-[104px] w-[104px] shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--progress-track)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--progress)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-slow"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--progress)]">
            {pct}%
          </span>
        </div>
      </div>
      {label ? (
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Progresso</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{label}</p>
        </div>
      ) : null}
    </div>
  );
}
