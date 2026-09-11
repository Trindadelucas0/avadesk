"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Modal } from "@/components/hub/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useHubStore } from "@/stores/hub-store";
import type { UpdateType } from "@/types";
import { updateTypeLabel } from "@/lib/utils";

const TYPES: UpdateType[] = ["FEATURE", "FIX", "UPDATE", "RELEASE", "DOCUMENTATION"];

export function QuickUpdateModal({
  open,
  onOpenChange,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultProjectId?: string;
}) {
  const projects = useHubStore((s) => s.projects);
  const clients = useHubStore((s) => s.clients);
  const session = useHubStore((s) => s.session);
  const createUpdate = useHubStore((s) => s.createUpdate);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<UpdateType>("UPDATE");
  const [status, setStatus] = useState<"planejado" | "em_andamento" | "concluido">("em_andamento");
  const [visible, setVisible] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProjectId((current) => {
      if (current && projects.some((p) => p.id === current)) return current;
      return defaultProjectId ?? projects[0]?.id ?? "";
    });
  }, [open, defaultProjectId, projects]);

  const reset = () => {
    setTitle("");
    setContent("");
    setType("UPDATE");
    setStatus("em_andamento");
    setVisible(true);
  };

    const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const pid = projectId || defaultProjectId || projects[0]?.id || "";
    if (!pid) {
      toast.error("Crie um projeto antes de publicar.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("Preencha título e detalhe.");
      return;
    }
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      toast.error("Faça login como admin para publicar.");
      return;
    }
    if (busy) return;
    setBusy(true);
    const result = await createUpdate({
      projectId: pid,
      title,
      content,
      type,
      status,
      visibleToClient: visible,
    });
    setBusy(false);
    if (result.item) {
      if (result.emailQueued) {
        toast.success("Update publicado", {
          description: "O e-mail ao cliente pode chegar em seguida.",
        });
      } else {
        toast.success("Update publicado");
      }
      reset();
      onOpenChange(false);
    } else {
      toast.error(result.error ?? "Não foi possível publicar. Recarregue e tente de novo.");
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Update"
      description="Publique em menos de 30 segundos. Visível ao cliente por padrão."
      className="max-w-xl"
    >
      <form className="space-y-4" onSubmit={submit}>
        <div>
          <Label htmlFor="qu-project">Projeto</Label>
          <select
            id="qu-project"
            className="mt-1.5 hub-control"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => {
              const c = clients.find((x) => x.id === p.clientId);
              return (
                <option key={p.id} value={p.id}>
                  {p.name} · {c?.name}
                </option>
              );
            })}
          </select>
        </div>
        <div>
          <Label htmlFor="qu-title">Título</Label>
          <Input
            id="qu-title"
            className="mt-1.5"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="O que mudou?"
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="qu-content">Detalhe</Label>
          <Textarea
            id="qu-content"
            className="mt-1.5"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contexto curto para o cliente…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="qu-type">Tipo</Label>
            <select
              id="qu-type"
              className="mt-1.5 hub-control"
              value={type}
              onChange={(e) => setType(e.target.value as UpdateType)}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {updateTypeLabel(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="qu-status">Status</Label>
            <select
              id="qu-status"
              className="mt-1.5 hub-control"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="planejado">Planejado</option>
              <option value="em_andamento">Em andamento</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => setVisible(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)]"
          />
          Visível ao cliente
        </label>
        <div className="sticky bottom-0 z-10 -mx-5 mt-2 flex justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-5 pt-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" variant="accent" disabled={busy || projects.length === 0}>
            {busy ? "Publicando…" : "Publicar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
