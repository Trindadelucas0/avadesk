"use client";

import { STATUS_MIX } from "@/lib/admin-overview";
import type { ProjectStatus } from "@/types";
import { statusLabel } from "@/lib/utils";

const SEGMENT_CLASS: Record<ProjectStatus, string> = {
  planning: "bg-[var(--text-muted)]",
  development: "bg-[var(--accent)]",
  testing: "bg-[rgba(107,140,255,0.55)]",
  homologation: "bg-[rgba(61,220,151,0.55)]",
  published: "bg-[var(--success)]",
  maintenance: "bg-[var(--warning)]",
  paused: "bg-[var(--border-strong)]",
};

export function StatusMix({
  byStatus,
  total,
  avgProgressActive,
}: {
  byStatus: Record<ProjectStatus, number>;
  total: number;
  avgProgressActive?: number;
}) {
  const safeTotal = total > 0 ? total : 1;

  return (
    <section className="hub-surface p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--text-muted)]">
          Portfólio
        </h2>
        {typeof avgProgressActive === "number" ? (
          <p className="text-xs text-[var(--text-muted)]">
            Evolução média (ativos) {avgProgressActive}%
          </p>
        ) : null}
      </div>
      <div
        className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-subtle)]"
        role="img"
        aria-label={`Distribuição de ${total} sistemas`}
      >
        {STATUS_MIX.map(({ key }) => {
          const count = byStatus[key] ?? 0;
          if (count <= 0) return null;
          return (
            <span
              key={key}
              className={SEGMENT_CLASS[key]}
              style={{ width: `${(count / safeTotal) * 100}%` }}
              title={`${statusLabel(key)}: ${count}`}
            />
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
        {STATUS_MIX.map(({ key, short }) => (
          <li key={key}>
            <span className="text-[var(--text-muted)]">{short}</span>{" "}
            <span className="tabular-nums">{byStatus[key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
