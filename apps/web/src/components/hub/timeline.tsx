"use client";

import { useState } from "react";
import Link from "next/link";
import { cn, formatDate, formatDateTime, formatRelative } from "@/lib/utils";
import { StatusBadge, TypeBadge } from "@/components/hub/status-badge";
import { Modal } from "@/components/hub/modal";
import { Button } from "@/components/ui/button";
import type { UpdateItem } from "@/types";

export type UpdateDetailBase = "/admin/projects" | "/client/projects";
export type UpdatesListHref = "/admin/updates" | "/client/updates";

function VisibilityChip({ visible }: { visible: boolean }) {
  return (
    <span
      className={cn(
        "text-xs",
        visible ? "text-[var(--text-muted)]" : "text-[var(--warning)]"
      )}
    >
      {visible ? "Cliente vê" : "Só a equipe"}
    </span>
  );
}

function UpdateCardBody({
  update,
  projectName,
  clientName,
  showVisibility,
}: {
  update: UpdateItem;
  projectName?: string;
  clientName?: string;
  showVisibility?: boolean;
}) {
  const place = [clientName, projectName].filter(Boolean).join(" · ");
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={update.type} />
        <StatusBadge status={update.status} />
        {showVisibility ? <VisibilityChip visible={update.visibleToClient} /> : null}
      </div>
      <h3 className="mt-2 text-sm font-medium text-[var(--text-primary)] group-hover:text-white">
        {update.title}
      </h3>
      {place ? <p className="mt-1 text-xs text-[var(--text-muted)]">{place}</p> : null}
      <p className="mt-1 line-clamp-3 text-sm text-[var(--text-secondary)]">{update.content}</p>
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        {update.authorName} · {formatRelative(update.createdAt)} · {formatDate(update.createdAt)}
      </p>
    </>
  );
}

export function UpdateCard({
  update,
  projectName,
  clientName,
  href,
  onOpen,
  showVisibility,
}: {
  update: UpdateItem;
  projectName?: string;
  clientName?: string;
  href?: string;
  onOpen?: () => void;
  showVisibility?: boolean;
}) {
  const className =
    "hub-surface group w-full p-4 text-left transition-colors duration-fast hover:border-[var(--accent)]/40 hub-focus";
  const body = (
    <UpdateCardBody
      update={update}
      projectName={projectName}
      clientName={clientName}
      showVisibility={showVisibility}
    />
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className={className}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-label={`Ver detalhes: ${update.title}`}
      >
        {body}
      </button>
    );
  }
  if (href) {
    return (
      <Link href={href} className={`${className} block`}>
        {body}
      </Link>
    );
  }
  return <article className={className}>{body}</article>;
}

export function UpdateDetailModal({
  update,
  open,
  onOpenChange,
  projectName,
  clientName,
  showVisibility,
  detailBase,
  updatesHref,
}: {
  update: UpdateItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName?: string;
  clientName?: string;
  showVisibility?: boolean;
  detailBase: UpdateDetailBase;
  updatesHref: UpdatesListHref;
}) {
  const projectHref = update ? `${detailBase}/${update.projectId}` : detailBase;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={update?.title || "Atualização"}>
      {update ? (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <TypeBadge type={update.type} />
            <StatusBadge status={update.status} />
            {showVisibility ? <VisibilityChip visible={update.visibleToClient} /> : null}
          </div>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
            {update.content}
          </p>
          <dl className="mt-5 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--text-muted)]">Sistema</dt>
            <dd className="text-[var(--text-primary)]">{projectName || "—"}</dd>
            {clientName ? (
              <>
                <dt className="text-[var(--text-muted)]">Empresa</dt>
                <dd className="text-[var(--text-primary)]">{clientName}</dd>
              </>
            ) : null}
            <dt className="text-[var(--text-muted)]">Autor</dt>
            <dd className="text-[var(--text-primary)]">{update.authorName}</dd>
            <dt className="text-[var(--text-muted)]">Quando</dt>
            <dd className="text-[var(--text-primary)]">
              {formatDateTime(update.createdAt)} ({formatRelative(update.createdAt)})
            </dd>
          </dl>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="accent" size="sm" asChild>
              <Link href={projectHref}>Abrir sistema</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={updatesHref}>Todos os updates</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export function Timeline({
  items,
  projectNames,
  clientNames,
  scrollable = false,
  showVisibility = false,
  detailBase = "/admin/projects",
  updatesHref = "/admin/updates",
}: {
  items: UpdateItem[];
  projectNames?: Record<string, string>;
  clientNames?: Record<string, string>;
  scrollable?: boolean;
  showVisibility?: boolean;
  detailBase?: UpdateDetailBase;
  updatesHref?: UpdatesListHref;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (items.length === 0) return null;

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const list = (
    <ol className="relative space-y-0 border-l border-[var(--border)] pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative pb-8 last:pb-0">
          <span className="absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-base)]" />
          <UpdateCard
            update={item}
            projectName={projectNames?.[item.projectId]}
            clientName={clientNames?.[item.projectId]}
            showVisibility={showVisibility}
            onOpen={() => setSelectedId(item.id)}
          />
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {scrollable ? (
        <div
          className="hub-surface max-h-[26rem] overflow-y-auto overscroll-contain px-4 py-4"
          tabIndex={0}
          aria-label="Atividade recente"
        >
          {list}
        </div>
      ) : (
        list
      )}
      <UpdateDetailModal
        update={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        projectName={selected ? projectNames?.[selected.projectId] : undefined}
        clientName={selected ? clientNames?.[selected.projectId] : undefined}
        showVisibility={showVisibility}
        detailBase={detailBase}
        updatesHref={updatesHref}
      />
    </>
  );
}
