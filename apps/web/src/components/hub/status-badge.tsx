"use client";

import { cn, projectStatusTone, statusLabel, updateTypeLabel } from "@/lib/utils";
import type { ProjectStatus, UpdateType } from "@/types";

const toneClass = {
  neutral: "bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border)]",
  accent: "bg-[var(--accent-muted)] text-[var(--accent)] border-[rgba(107,140,255,0.25)]",
  success: "bg-[rgba(61,220,151,0.12)] text-[var(--success)] border-[rgba(61,220,151,0.25)]",
  warn: "bg-[rgba(245,185,66,0.12)] text-[var(--warning)] border-[rgba(245,185,66,0.3)]",
  danger: "bg-[rgba(240,113,120,0.12)] text-[var(--danger)] border-[rgba(240,113,120,0.25)]",
};

export function StatusBadge({
  status,
  label,
  stale,
  className,
}: {
  status?: ProjectStatus | string;
  label?: string;
  stale?: boolean;
  className?: string;
}) {
  if (stale) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium",
          toneClass.warn,
          className
        )}
      >
        {label ?? "Atenção >7d"}
      </span>
    );
  }
  const tone =
    status &&
    ["planning", "development", "testing", "homologation", "published", "maintenance", "paused"].includes(
      status
    )
      ? projectStatusTone(status as ProjectStatus)
      : "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium",
        toneClass[tone],
        className
      )}
    >
      {label ?? (status ? statusLabel(status) : "—")}
    </span>
  );
}

export function TypeBadge({ type }: { type: UpdateType }) {
  return (
    <span className="inline-flex rounded-lg border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
      {updateTypeLabel(type)}
    </span>
  );
}
