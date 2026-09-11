"use client";

import { useState } from "react";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal } from "@/components/hub/modal";
import { PageHeader } from "@/components/hub/page-header";
import { EmptyState } from "@/components/hub/states";
import { ReleaseCard } from "@/components/hub/release-card";
import { useHubStore } from "@/stores/hub-store";

export default function AdminReleasesPage() {
  const releases = useHubStore((s) => s.releases);
  const projects = useHubStore((s) => s.projects);
  const upsertRelease = useHubStore((s) => s.upsertRelease);
  const deleteRelease = useHubStore((s) => s.deleteRelease);

  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [version, setVersion] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [highlights, setHighlights] = useState("");
  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const submit = async () => {
    if (!projectId || !version.trim() || !title.trim()) {
      toast.error("Preencha projeto, versão e título.");
      return;
    }
    await upsertRelease({
      projectId,
      version: version.trim(),
      title: title.trim(),
      notes: notes.trim(),
      highlights: highlights
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean),
    });
    toast.success("Release publicada");
    setOpen(false);
    setVersion("");
    setTitle("");
    setNotes("");
    setHighlights("");
  };

  return (
    <div>
      <PageHeader
        icon={Tag}
        title="Releases"
        description="Versões entregues por projeto. O cliente só vê as do próprio tenant."
        actions={
          <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova release
          </Button>
        }
      />

      {releases.length === 0 ? (
        <EmptyState
          title="Nenhuma release"
          description="Publique quando houver uma versão real para o cliente."
          action={
            <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
              Nova release
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {releases.map((r) => (
            <li key={r.id} className="space-y-2">
              <ReleaseCard release={r} projectName={projectNames[r.projectId]} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void deleteRelease(r.id).then(() => toast.success("Release removida"));
                }}
              >
                Excluir
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onOpenChange={setOpen} title="Nova release" description="Visível no portal do cliente do projeto.">
        <div className="space-y-4">
          <div>
            <Label htmlFor="rel-project">Projeto</Label>
            <select
              id="rel-project"
              className="mt-1.5 hub-control"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="rel-version">Versão</Label>
            <Input id="rel-version" className="mt-1.5" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.2.0" />
          </div>
          <div>
            <Label htmlFor="rel-title">Título</Label>
            <Input id="rel-title" className="mt-1.5" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rel-notes">Notas</Label>
            <Textarea id="rel-notes" className="mt-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rel-hi">Destaques (um por linha)</Label>
            <Textarea id="rel-hi" className="mt-1.5" value={highlights} onChange={(e) => setHighlights(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="accent" onClick={() => void submit()}>
              Publicar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
