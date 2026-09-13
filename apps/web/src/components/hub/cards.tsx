"use client";

import { FileText, Download, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fileCategoryLabel, formatDateNumeric, formatRelative } from "@/lib/utils";
import type { DocumentItem, FileItem, NotificationItem } from "@/types";
import Link from "next/link";
import { toast } from "sonner";

export function DocumentCard({
  doc,
  onEdit,
  onDelete,
}: {
  doc: DocumentItem;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="hub-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--bg-subtle)]">
          <FileText className="h-5 w-5 text-[var(--accent)]" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-medium">{doc.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            v{doc.version} · {doc.sizeLabel ? `${doc.sizeLabel} · ` : ""}
            {formatDateNumeric(doc.uploadedAt)}
          </p>
          {doc.history.length > 1 ? (
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Histórico: {doc.history.map((h) => `v${h.version}`).join(" → ")}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const fileId = [...doc.history].reverse().find((h) => "fileId" in h && h.fileId)?.fileId as
              | string
              | undefined;
            if (fileId) {
              window.location.href = `/api/v2/files/${fileId}/download`;
              return;
            }
            toast.message("Esta versão ainda não tem arquivo anexado.");
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Baixar
        </Button>
        {onEdit ? (
          <Button variant="ghost" size="sm" type="button" onClick={onEdit}>
            Editar
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="danger" size="sm" type="button" onClick={onDelete}>
            Excluir
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function FileCard({
  file,
  hideCategory = false,
  onEdit,
  onDelete,
}: {
  file: FileItem;
  hideCategory?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <article className="hub-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Folder className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {hideCategory
              ? `${file.sizeLabel} · ${formatDateNumeric(file.uploadedAt)}`
              : `${fileCategoryLabel(file.category, file.categoryLabel)} · ${file.sizeLabel} · ${formatDateNumeric(file.uploadedAt)}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Baixar ${file.name}`}
          onClick={() => {
            window.location.href = `/api/v2/files/${file.id}/download`;
          }}
        >
          <Download className="h-4 w-4" />
        </Button>
        {onEdit ? (
          <Button variant="ghost" size="sm" type="button" onClick={onEdit}>
            Editar
          </Button>
        ) : null}
        {onDelete ? (
          <Button variant="danger" size="sm" type="button" onClick={onDelete}>
            Excluir
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export function NotificationItemRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (id: string) => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={() => onRead(item.id)}
      className="hub-surface flex gap-3 p-4 transition-colors hover:border-[var(--accent)]/40"
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-[var(--accent)]"}`}
        aria-hidden
      />
      <div>
        <p className={`text-sm ${item.read ? "text-[var(--text-secondary)]" : "font-medium"}`}>
          {item.title}
        </p>
        <p className="mt-0.5 text-sm text-[var(--text-muted)]">{item.body}</p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">{formatRelative(item.createdAt)}</p>
      </div>
    </Link>
  );
}
