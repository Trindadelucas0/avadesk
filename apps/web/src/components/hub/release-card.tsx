import { formatDate } from "@/lib/utils";
import type { Release } from "@/types";
import { Tag } from "lucide-react";

export function ReleaseCard({ release, projectName }: { release: Release; projectName?: string }) {
  return (
    <article className="hub-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-muted)] px-2 py-0.5 text-xs font-medium text-[var(--accent)]">
          <Tag className="h-3 w-3" aria-hidden />
          v{release.version}
        </span>
        <span className="text-xs text-[var(--text-muted)]">{formatDate(release.releasedAt)}</span>
        {projectName ? (
          <span className="text-xs text-[var(--text-muted)]">· {projectName}</span>
        ) : null}
      </div>
      <h3 className="mt-3 text-base font-medium">{release.title}</h3>
      <p className="mt-1.5 text-sm text-[var(--text-secondary)]">{release.notes}</p>
      {release.highlights.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {release.highlights.map((h) => (
            <li key={h} className="flex gap-2 text-sm text-[var(--text-secondary)]">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" />
              {h}
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
