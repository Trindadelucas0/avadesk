"use client";

import { cn, statusLabel } from "@/lib/utils";
import type { Task } from "@/types";

export function TaskCard({
  task,
  projectName,
  dragging,
}: {
  task: Task;
  projectName?: string;
  dragging?: boolean;
}) {
  const priorityColor = {
    low: "text-[var(--text-muted)]",
    medium: "text-[var(--accent)]",
    high: "text-[var(--warning)]",
  }[task.priority];

  return (
    <article
      className={cn(
        "hub-surface p-3",
        dragging && "opacity-80 ring-2 ring-[var(--accent)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium leading-snug">{task.title}</h4>
        <span className={cn("text-[10px] font-medium uppercase", priorityColor)}>
          {task.priority}
        </span>
      </div>
      {task.description ? (
        <p className="mt-1.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{task.description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">
        <span>{task.assigneeName}</span>
        {projectName ? <span>· {projectName}</span> : null}
        <span className="ml-auto">{statusLabel(task.status)}</span>
      </div>
    </article>
  );
}
