import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div
            className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] text-white shadow-[0_8px_18px_rgba(107,140,255,0.35)]"
            style={{ background: "var(--brand-gradient)" }}
            aria-hidden
          >
            <Icon className="h-5 w-5" strokeWidth={2.2} />
          </div>
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-secondary)]">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function ProjectHeader({
  name,
  status,
  progress,
  meta,
  actions,
}: {
  name: string;
  status: ReactNode;
  progress: number;
  meta?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[var(--border-strong)] pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          {status}
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          {progress}% concluído
          {meta ? ` · ${meta}` : ""}
        </p>
      </div>
      {actions}
    </div>
  );
}
