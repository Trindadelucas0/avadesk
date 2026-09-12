"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, MoreHorizontal, RefreshCw, Sparkles, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHubStore } from "@/stores/hub-store";
import type { Ticket, TicketImagePayload, TicketOrigin, TicketType } from "@/types";
import {
  TICKET_IMAGE_ACCEPT,
  TICKET_IMAGE_MAX,
  TICKET_IMAGE_MAX_BYTES,
  TICKET_TYPES,
  isTicketImageFile,
  ticketFieldDefs,
  ticketImageMime,
} from "@/lib/tickets";

function fieldsFromTicket(ticket: Ticket): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(ticket.fields ?? {})) {
    next[key] = typeof value === "string" ? value : "";
  }
  return next;
}

type PendingImage = { file: File; preview: string };

const TYPE_ICONS = {
  bug: Bug,
  implementation: Wrench,
  feature: Sparkles,
  routine: RefreshCw,
  other: MoreHorizontal,
} as const;

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function TicketForm({
  projects = [],
  defaultProjectId,
  showOrigin,
  onCreated,
  ticket,
  onCancel,
  onSaved,
  allowedTypes,
}: {
  projects?: { id: string; name: string }[];
  defaultProjectId?: string;
  showOrigin?: boolean;
  onCreated?: () => void;
  ticket?: Ticket;
  onCancel?: () => void;
  onSaved?: () => void;
  allowedTypes?: TicketType[];
}) {
  const createTicket = useHubStore((s) => s.createTicket);
  const updateTicket = useHubStore((s) => s.updateTicket);
  const editing = Boolean(ticket);
  const idPrefix = ticket ? `ticket-edit-${ticket.id}` : "ticket";
  const [type, setType] = useState<TicketType>(ticket?.type ?? "bug");
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || "");
  const [title, setTitle] = useState(ticket?.title ?? "");
  const [fields, setFields] = useState<Record<string, string>>(
    ticket ? fieldsFromTicket(ticket) : {}
  );
  const [origin, setOrigin] = useState<TicketOrigin>(showOrigin ? "admin_report" : "portal");
  const [submitting, setSubmitting] = useState(false);
  const [images, setImages] = useState<PendingImage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const defs = useMemo(() => ticketFieldDefs(type), [type]);
  const typeOptions = useMemo(() => {
    const allowed = new Set(allowedTypes ?? TICKET_TYPES.map((t) => t.value));
    if (ticket) allowed.add(ticket.type);
    return TICKET_TYPES.filter((t) => allowed.has(t.value));
  }, [allowedTypes, ticket]);

  const onTypeChange = (next: TicketType) => {
    setType(next);
    setFields({});
  };

  const clearImages = () => {
    images.forEach((item) => URL.revokeObjectURL(item.preview));
    setImages([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const addImages = (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...images];
    let hitLimit = false;
    for (const file of Array.from(list)) {
      if (next.length >= TICKET_IMAGE_MAX) {
        hitLimit = true;
        break;
      }
      if (!isTicketImageFile(file)) {
        toast.error(`${file.name}: envie PNG, JPG ou WebP.`);
        continue;
      }
      if (file.size > TICKET_IMAGE_MAX_BYTES) {
        toast.error(`${file.name} excede 2 MB.`);
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    setImages(next);
    if (hitLimit) toast.error("No máximo 4 imagens.");
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const item = prev[index];
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !projectId) {
      toast.error("Escolha o projeto.");
      return;
    }
    for (const def of defs) {
      const value = fields[def.key]?.trim() ?? "";
      if (def.required && !value) {
        toast.error(`Preencha: ${def.label}`);
        return;
      }
      if (def.minLength && value.length < def.minLength) {
        toast.error(`${def.label}: mínimo ${def.minLength} caracteres.`);
        return;
      }
    }
    setSubmitting(true);
    const payload: Record<string, string> = {};
    for (const def of defs) {
      payload[def.key] = fields[def.key]?.trim() ?? "";
    }
    let imagePayload: TicketImagePayload[] = [];
    if (!editing && images.length) {
      try {
        imagePayload = await Promise.all(
          images.map(async (item) => ({
            name: item.file.name,
            mime: ticketImageMime(item.file),
            contentBase64: await fileToBase64(item.file),
          }))
        );
      } catch {
        setSubmitting(false);
        toast.error("Não foi possível ler a imagem.");
        return;
      }
    }
    const resolvedTitle = type === "other" ? (payload.customName ?? "").trim() : title.trim();
    const res =
      editing && ticket
        ? await updateTicket(ticket.id, { type, title: resolvedTitle, fields: payload })
        : await createTicket({
            projectId,
            type,
            title: resolvedTitle,
            fields: payload,
            origin: showOrigin ? origin : "portal",
            images: imagePayload,
          });
    setSubmitting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (editing) {
      toast.success("Chamado atualizado.");
      onSaved?.();
      return;
    }
    if ("attachFailed" in res && res.attachFailed) {
      toast.warning("Chamado aberto, mas uma imagem não foi enviada.");
    } else {
      toast.success("Chamado aberto.");
    }
    setTitle("");
    setFields({});
    clearImages();
    onCreated?.();
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      {!editing && (projects.length > 1 || !defaultProjectId) ? (
        <div>
          <Label htmlFor={`${idPrefix}-project`}>Projeto</Label>
          <select
            id={`${idPrefix}-project`}
            className="mt-1.5 hub-control"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Tipo</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {typeOptions.map((t) => {
            const Icon = TYPE_ICONS[t.value];
            return (
              <label
                key={t.value}
                className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border border-[var(--border-strong)] px-3 py-2 text-sm has-[:checked]:border-[var(--accent)] has-[:checked]:bg-[var(--accent-muted)]"
              >
                <input
                  type="radio"
                  className="mt-1"
                  name={`${idPrefix}-type`}
                  value={t.value}
                  checked={type === t.value}
                  onChange={() => onTypeChange(t.value)}
                />
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium">{t.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{t.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {!editing && showOrigin ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Origem</legend>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${idPrefix}-origin`}
                checked={origin === "admin_report"}
                onChange={() => setOrigin("admin_report")}
              />
              Relato do cliente
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={`${idPrefix}-origin`}
                checked={origin === "portal"}
                onChange={() => setOrigin("portal")}
              />
              Portal
            </label>
          </div>
        </fieldset>
      ) : null}

      {type !== "other" ? (
      <div>
        <Label htmlFor={`${idPrefix}-title`}>Título</Label>
        <Input
          id={`${idPrefix}-title`}
          className="mt-1.5"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          required
        />
      </div>
      ) : null}

      {defs.map((def) => (
        <div key={def.key}>
          <Label htmlFor={`${idPrefix}-${def.key}`}>
            {def.label}
            {def.required ? " *" : ""}
          </Label>
          {def.kind === "textarea" ? (
            <Textarea
              id={`${idPrefix}-${def.key}`}
              className="mt-1.5"
              value={fields[def.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [def.key]: e.target.value }))}
              required={def.required}
              maxLength={def.maxLength ?? 4000}
              placeholder={def.placeholder}
            />
          ) : (
            <Input
              id={`${idPrefix}-${def.key}`}
              className="mt-1.5"
              value={fields[def.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [def.key]: e.target.value }))}
              required={def.required}
              minLength={def.minLength}
              maxLength={def.maxLength ?? 200}
              placeholder={def.placeholder}
            />
          )}
        </div>
      ))}

      {!editing ? (
        <div>
          <Label htmlFor={`${idPrefix}-images`}>Imagens (opcional)</Label>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Prints da tela, erro ou exemplo. PNG, JPG ou WebP. Até 4 arquivos, 2 MB cada.
          </p>
          {images.length > 0 ? (
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((item, index) => (
                <li key={item.preview} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.preview}
                    alt={item.file.name}
                    className="h-24 w-full rounded-md border border-[var(--border)] object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-md bg-[var(--bg-elevated)]/90 text-[var(--text-secondary)] hub-focus sm:h-8 sm:w-8"
                    aria-label={`Remover ${item.file.name}`}
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {images.length < TICKET_IMAGE_MAX ? (
            <Input
              ref={fileRef}
              id={`${idPrefix}-images`}
              className="mt-2"
              type="file"
              accept={TICKET_IMAGE_ACCEPT}
              multiple
              onChange={(e) => addImages(e.target.files)}
            />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="submit"
          variant="accent"
          className="w-full sm:w-auto"
          disabled={submitting || (!editing && !projectId)}
        >
          {submitting ? (editing ? "Salvando…" : "Enviando…") : editing ? "Salvar" : "Enviar chamado"}
        </Button>
        {editing && onCancel ? (
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={submitting}
            onClick={onCancel}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
