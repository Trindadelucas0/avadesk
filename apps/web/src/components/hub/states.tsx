import { cn } from "@/lib/utils";
import { Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[rgba(12,18,28,0.6)] px-6 py-14 text-center shadow-[0_0_28px_rgba(107,140,255,0.06)]",
        className
      )}
    >
      <Inbox className="mb-3 h-8 w-8 text-[var(--text-muted)]" aria-hidden />
      <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Algo deu errado",
  description = "Não foi possível carregar estes dados.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-[rgba(240,113,120,0.25)] bg-[rgba(240,113,120,0.06)] px-6 py-12 text-center",
        className
      )}
      role="alert"
    >
      <AlertCircle className="mb-3 h-8 w-8 text-[var(--danger)]" aria-hidden />
      <h3 className="text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{description}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-[var(--bg-subtle)]",
        className
      )}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-fade-in" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
