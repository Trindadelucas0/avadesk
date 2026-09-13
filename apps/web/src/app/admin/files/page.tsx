"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FolderOpen, Upload } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DocumentCard,
  EmptyState,
  FileCard,
  FilesBreadcrumb,
  FolderCard,
  FolderGrid,
  Modal,
  PageHeader,
  PageSkeleton,
} from "@/components/hub";
import { useHubStore } from "@/stores/hub-store";
import {
  NEW_FILE_CATEGORY,
  SYSTEM_FILE_CATEGORIES,
  isSystemFileCategory,
  type FileCategory,
  type DocumentItem,
  type FileItem,
} from "@/types";
import { ApiError } from "@/lib/v2-client";
import { cn, fileCategoryLabel } from "@/lib/utils";
import {
  DOCUMENTATION_FOLDER_CATEGORY,
  categoriesForProject,
  countProjectItems,
  documentsInFolder,
  filesHref,
  filesInFolder,
  folderCategoryLabel,
  itemCountLabel,
  parseCategoryQuery,
  parseProjectQuery,
} from "@/lib/file-folders";

const BASE = "/admin/files" as const;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isValidNewCategoryLabel(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  return !/[\u0000-\u001F\u007F]/.test(trimmed);
}

function AdminFilesInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const files = useHubStore((s) => s.files);
  const documents = useHubStore((s) => s.documents);
  const projects = useHubStore((s) => s.projects);
  const session = useHubStore((s) => s.session);
  const hydrated = useHubStore((s) => s.hydrated);
  const addFile = useHubStore((s) => s.addFile);
  const updateFile = useHubStore((s) => s.updateFile);
  const deleteFile = useHubStore((s) => s.deleteFile);
  const updateDocument = useHubStore((s) => s.updateDocument);
  const deleteDocument = useHubStore((s) => s.deleteDocument);

  const allowedIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects]);
  const projectId = parseProjectQuery(searchParams.get("project"), allowedIds);
  const categoryFromUrl = projectId ? parseCategoryQuery(searchParams.get("category")) : null;
  const project = projects.find((item) => item.id === projectId);
  const folderLocked = Boolean(projectId && categoryFromUrl);

  const [category, setCategory] = useState<FileCategory>(SYSTEM_FILE_CATEGORIES[0]);
  const [newLabel, setNewLabel] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [editingFile, setEditingFile] = useState<FileItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<FileCategory>(SYSTEM_FILE_CATEGORIES[0]);
  const [editNewLabel, setEditNewLabel] = useState("");
  const [pendingFileDelete, setPendingFileDelete] = useState<FileItem | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentItem | null>(null);
  const [editDocTitle, setEditDocTitle] = useState("");
  const [pendingDocDelete, setPendingDocDelete] = useState<DocumentItem | null>(null);
  const [fileBusy, setFileBusy] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    if (categoryFromUrl) {
      setCategory(categoryFromUrl);
      setNewLabel("");
      return;
    }
    setCategory(SYSTEM_FILE_CATEGORIES[0]);
  }, [projectId, categoryFromUrl]);

  const customOptions = useMemo(() => {
    if (!projectId) return [];
    const map = new Map<string, string>();
    for (const file of files) {
      if (file.projectId !== projectId) continue;
      if (isSystemFileCategory(file.category)) continue;
      if (!map.has(file.category)) {
        map.set(file.category, fileCategoryLabel(file.category, file.categoryLabel));
      }
    }
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [files, projectId]);

  const folders = useMemo(() => {
    if (!projectId) return [];
    return categoriesForProject(projectId, files, documents, { showEmptySystem: true });
  }, [projectId, files, documents]);

  const folderFiles = useMemo(() => {
    if (!projectId || !categoryFromUrl) return [];
    return filesInFolder(projectId, categoryFromUrl, files);
  }, [projectId, categoryFromUrl, files]);

  const folderDocuments = useMemo(() => {
    if (!projectId || !categoryFromUrl) return [];
    return documentsInFolder(projectId, categoryFromUrl, documents);
  }, [projectId, categoryFromUrl, documents]);

  const newLabelValid = isValidNewCategoryLabel(newLabel);
  const uploadBlocked = !projectId || (category === NEW_FILE_CATEGORY && !newLabelValid);
  const showUpload = Boolean(projectId && project);

  const ingestFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const list = Array.from(fileList);
      if (!projectId) {
        toast.error("Selecione um projeto.");
        return;
      }
      if (category === NEW_FILE_CATEGORY && !isValidNewCategoryLabel(newLabel)) {
        toast.error("Nome de categoria inválido.");
        return;
      }
      if (list.length === 0) return;
      const categoryLabel =
        category === NEW_FILE_CATEGORY
          ? newLabel.trim()
          : isSystemFileCategory(category)
            ? undefined
            : fileCategoryLabel(
                category,
                files.find((file) => file.projectId === projectId && file.category === category)
                  ?.categoryLabel
              );
      try {
        for (const file of list) {
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          bytes.forEach((b) => {
            binary += String.fromCharCode(b);
          });
          const contentBase64 = btoa(binary);
          await addFile({
            projectId,
            name: file.name,
            category: category === NEW_FILE_CATEGORY ? DOCUMENTATION_FOLDER_CATEGORY : category,
            categoryLabel,
            sizeLabel: formatSize(file.size),
            uploadedBy: session?.name ?? "Admin",
            mime: file.type || "application/octet-stream",
            contentBase64,
          });
        }
        toast.success(`${list.length} arquivo(s) enviado(s)`);
        if (category === NEW_FILE_CATEGORY) {
          const created = useHubStore.getState().files[0];
          if (created?.category) {
            router.push(filesHref(BASE, projectId, created.category));
          }
          setNewLabel("");
        }
      } catch (err) {
        toast.error(
          err instanceof ApiError ? err.message : "Falha no envio. Verifique o tipo e o tamanho (máx. 10 MB)."
        );
      }
    },
    [addFile, category, files, newLabel, projectId, router, session?.name]
  );

  if (!hydrated) return <PageSkeleton />;

  const editNewLabelValid = isValidNewCategoryLabel(editNewLabel);

  const fileModals = (
    <>
      <Modal
        open={Boolean(editingFile)}
        onOpenChange={(open) => {
          if (!open && !fileBusy) setEditingFile(null);
        }}
        title="Editar arquivo"
        description="Altere o nome ou a pasta. O conteúdo do arquivo permanece o mesmo."
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-file-name">Nome</Label>
            <Input
              id="edit-file-name"
              className="mt-1.5"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="edit-file-category">Pasta</Label>
            <select
              id="edit-file-category"
              className="mt-1.5 w-full hub-control"
              value={editCategory}
              onChange={(e) => setEditCategory(e.target.value)}
            >
              {SYSTEM_FILE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {folderCategoryLabel(value)}
                </option>
              ))}
              {customOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {editingFile &&
              !isSystemFileCategory(editingFile.category) &&
              !customOptions.some((opt) => opt.value === editingFile.category) ? (
                <option value={editingFile.category}>
                  {fileCategoryLabel(editingFile.category, editingFile.categoryLabel)}
                </option>
              ) : null}
              <option value={NEW_FILE_CATEGORY}>Nova categoria…</option>
            </select>
          </div>
          {editCategory === NEW_FILE_CATEGORY ? (
            <div>
              <Label htmlFor="edit-file-category-name">Nome da categoria</Label>
              <Input
                id="edit-file-category-name"
                className="mt-1.5"
                value={editNewLabel}
                maxLength={60}
                autoComplete="off"
                onChange={(e) => setEditNewLabel(e.target.value)}
                aria-invalid={editNewLabel.length > 0 && !editNewLabelValid}
              />
            </div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" disabled={fileBusy} onClick={() => setEditingFile(null)}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              type="button"
              disabled={fileBusy}
              onClick={async () => {
                if (!editingFile) return;
                if (!editName.trim()) {
                  toast.error("Informe o nome.");
                  return;
                }
                if (editCategory === NEW_FILE_CATEGORY && !editNewLabelValid) {
                  toast.error("Nome de categoria inválido.");
                  return;
                }
                const payload: { name: string; category?: string; categoryLabel?: string } = {
                  name: editName.trim(),
                };
                if (editCategory === NEW_FILE_CATEGORY) {
                  payload.categoryLabel = editNewLabel.trim();
                } else if (isSystemFileCategory(editCategory)) {
                  payload.category = editCategory;
                } else {
                  payload.category = editCategory;
                  payload.categoryLabel = fileCategoryLabel(
                    editCategory,
                    files.find((file) => file.projectId === projectId && file.category === editCategory)
                      ?.categoryLabel ?? editingFile.categoryLabel
                  );
                }
                setFileBusy(true);
                const result = await updateFile(editingFile.id, payload);
                setFileBusy(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setEditingFile(null);
                toast.success("Arquivo atualizado");
              }}
            >
              {fileBusy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingFileDelete)}
        onOpenChange={(open) => {
          if (!open && !fileBusy) setPendingFileDelete(null);
        }}
        title="Excluir arquivo?"
        description={
          pendingFileDelete
            ? `${pendingFileDelete.name} some da pasta e do disco. O cliente deixa de baixar. Esta ação não pode ser desfeita.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            disabled={fileBusy}
            onClick={() => setPendingFileDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={fileBusy}
            onClick={async () => {
              if (!pendingFileDelete) return;
              setFileBusy(true);
              const result = await deleteFile(pendingFileDelete.id);
              setFileBusy(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setPendingFileDelete(null);
              toast.success("Arquivo excluído");
            }}
          >
            {fileBusy ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(editingDoc)}
        onOpenChange={(open) => {
          if (!open && !fileBusy) setEditingDoc(null);
        }}
        title="Editar documento"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="edit-doc-title">Título</Label>
            <Input
              id="edit-doc-title"
              className="mt-1.5"
              value={editDocTitle}
              onChange={(e) => setEditDocTitle(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" disabled={fileBusy} onClick={() => setEditingDoc(null)}>
              Cancelar
            </Button>
            <Button
              variant="accent"
              type="button"
              disabled={fileBusy}
              onClick={async () => {
                if (!editingDoc) return;
                if (!editDocTitle.trim()) {
                  toast.error("Informe o título.");
                  return;
                }
                setFileBusy(true);
                const result = await updateDocument(editingDoc.id, { title: editDocTitle.trim() });
                setFileBusy(false);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                setEditingDoc(null);
                toast.success("Documento atualizado");
              }}
            >
              {fileBusy ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(pendingDocDelete)}
        onOpenChange={(open) => {
          if (!open && !fileBusy) setPendingDocDelete(null);
        }}
        title="Excluir documento?"
        description={
          pendingDocDelete
            ? `${pendingDocDelete.title} sai da pasta Documentação. Esta ação não pode ser desfeita.`
            : undefined
        }
      >
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            type="button"
            disabled={fileBusy}
            onClick={() => setPendingDocDelete(null)}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            type="button"
            disabled={fileBusy}
            onClick={async () => {
              if (!pendingDocDelete) return;
              setFileBusy(true);
              const result = await deleteDocument(pendingDocDelete.id);
              setFileBusy(false);
              if (!result.ok) {
                toast.error(result.error);
                return;
              }
              setPendingDocDelete(null);
              toast.success("Documento excluído");
            }}
          >
            {fileBusy ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </Modal>
    </>
  );

  const uploadPanel = showUpload ? (
    <div className="space-y-4">
      {!folderLocked ? (
        <div className="grid max-w-md gap-4">
          <div>
            <Label htmlFor="file-category">Categoria</Label>
            <select
              id="file-category"
              className="mt-1.5 hub-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {SYSTEM_FILE_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {folderCategoryLabel(value)}
                </option>
              ))}
              {customOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              <option value={NEW_FILE_CATEGORY}>Nova categoria…</option>
            </select>
          </div>
          {category === NEW_FILE_CATEGORY ? (
            <div>
              <Label htmlFor="file-category-name">Nome da categoria</Label>
              <Input
                id="file-category-name"
                className="mt-1.5"
                value={newLabel}
                maxLength={60}
                autoComplete="off"
                placeholder="Ex.: Nota fiscal"
                onChange={(e) => setNewLabel(e.target.value)}
                aria-describedby="file-category-hint"
                aria-invalid={newLabel.length > 0 && !newLabelValid}
              />
              <p id="file-category-hint" className="mt-1 text-xs text-[var(--text-muted)]">
                2–60 caracteres. Só neste projeto.
              </p>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">
          Envio para a pasta {folderCategoryLabel(categoryFromUrl ?? category)}.
        </p>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (uploadBlocked) return;
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (uploadBlocked) {
            toast.error("Nome de categoria inválido.");
            return;
          }
          void ingestFiles(e.dataTransfer.files);
        }}
        aria-disabled={uploadBlocked}
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors shadow-[0_0_24px_rgba(107,140,255,0.06)]",
          uploadBlocked
            ? "border-[var(--border)] bg-[var(--bg-elevated)]/40 opacity-60"
            : dragOver
              ? "border-[var(--accent)] bg-[var(--accent-muted)]/30"
              : "border-[var(--border)] bg-[var(--bg-elevated)]/50"
        )}
      >
        <Upload className="mb-3 h-8 w-8 text-[var(--text-muted)]" aria-hidden />
        <p className="text-sm font-medium">Arraste arquivos aqui</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {uploadBlocked ? "Informe o nome da categoria para enviar." : "Ou use o seletor abaixo"}
        </p>
        <label className={cn("mt-4", uploadBlocked ? "cursor-not-allowed" : "cursor-pointer")}>
          <span className="rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--bg-hover)]">
            Escolher arquivos
          </span>
          <input
            type="file"
            multiple
            disabled={uploadBlocked}
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) void ingestFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  ) : null;

  if (projectId && project && categoryFromUrl) {
    const folderLabel = folderCategoryLabel(
      categoryFromUrl,
      folderFiles[0]?.categoryLabel ??
        folders.find((folder) => folder.category === categoryFromUrl)?.label
    );
    const empty = folderFiles.length === 0 && folderDocuments.length === 0;

    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
        <PageHeader
          title={folderLabel}
          description={`Arquivos de ${project.name}.`}
          className="mb-0"
        />
        <FilesBreadcrumb
          backHref={filesHref(BASE, project.id)}
          backLabel={project.name}
          current={folderLabel}
        />
        {uploadPanel}
        {empty ? (
          <EmptyState title="Nenhum arquivo" description="Envie arquivos acima. Eles ficam só no disco da API." />
        ) : (
          <ul className="space-y-2">
            {[
              ...folderDocuments.map((doc) => ({
                kind: "doc" as const,
                id: doc.id,
                uploadedAt: doc.uploadedAt,
                doc,
              })),
              ...folderFiles.map((file) => ({
                kind: "file" as const,
                id: file.id,
                uploadedAt: file.uploadedAt,
                file,
              })),
            ]
              .sort(
                (a, b) =>
                  new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
              )
              .map((entry) => (
                <li key={`${entry.kind}-${entry.id}`}>
                  {entry.kind === "doc" ? (
                    <DocumentCard
                      doc={entry.doc}
                      onEdit={() => {
                        setEditingDoc(entry.doc);
                        setEditDocTitle(entry.doc.title);
                      }}
                      onDelete={() => setPendingDocDelete(entry.doc)}
                    />
                  ) : (
                    <FileCard
                      file={entry.file}
                      hideCategory
                      onEdit={() => {
                        setEditingFile(entry.file);
                        setEditName(entry.file.name);
                        setEditCategory(entry.file.category);
                        setEditNewLabel("");
                      }}
                      onDelete={() => setPendingFileDelete(entry.file)}
                    />
                  )}
                </li>
              ))}
            </ul>
        )}
        {fileModals}
      </div>
    );
  }

  if (projectId && project) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
        <PageHeader title={project.name} description="Pastas deste projeto." className="mb-0" />
        <FilesBreadcrumb backHref={BASE} backLabel="Projetos" current={project.name} />
        <FolderGrid>
          {folders.map((folder) => (
            <FolderCard
              key={folder.category}
              href={filesHref(BASE, project.id, folder.category)}
              title={folder.label}
              subtitle={itemCountLabel(folder.count)}
            />
          ))}
        </FolderGrid>
        {uploadPanel}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={FolderOpen}
        title="Arquivos"
        description="Abra um projeto para enviar e organizar os arquivos em pastas."
      />
      {projects.length > 0 ? (
        <FolderGrid>
          {projects.map((item) => (
            <FolderCard
              key={item.id}
              href={filesHref(BASE, item.id)}
              title={item.name}
              subtitle={itemCountLabel(countProjectItems(item.id, files, documents))}
            />
          ))}
        </FolderGrid>
      ) : (
        <EmptyState
          title="Nenhum projeto"
          description="Crie um projeto antes de enviar arquivos."
        />
      )}
    </div>
  );
}

export default function AdminFilesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminFilesInner />
    </Suspense>
  );
}
