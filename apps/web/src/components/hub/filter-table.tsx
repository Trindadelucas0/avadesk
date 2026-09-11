"use client";

import { cn } from "@/lib/utils";

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "hub-surface mb-6 flex flex-wrap items-center gap-2 p-2",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors hub-focus",
        active
          ? "bg-[var(--accent-muted)] text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
      )}
    >
      {children}
    </button>
  );
}

export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; header: string; className?: string }[];
  rows: Record<string, React.ReactNode>[];
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) return <>{empty}</>;
  return (
    <div className="hub-surface overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--bg-subtle)]/80">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  "px-4 py-3 text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]",
                  c.className
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-subtle)]/40"
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
