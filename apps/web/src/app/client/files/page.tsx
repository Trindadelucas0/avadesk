"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { FolderOpen } from "lucide-react";
import {
  DocumentCard,
  EmptyState,
  FileCard,
  FilesBreadcrumb,
  FolderCard,
  FolderGrid,
  PageHeader,
  PageSkeleton,
} from "@/components/hub";
import { useClientTenant } from "@/hooks/use-client-tenant";
import {
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

function ClientFilesInner() {
  const searchParams = useSearchParams();
  const { hydrated, clientProjects, tenantFiles, tenantDocuments } = useClientTenant();

  const allowedIds = useMemo(
    () => new Set(clientProjects.map((project) => project.id)),
    [clientProjects]
  );
  const projectId = parseProjectQuery(searchParams.get("project"), allowedIds);
  const category = projectId ? parseCategoryQuery(searchParams.get("category")) : null;
  const project = clientProjects.find((item) => item.id === projectId);

  const folders = useMemo(() => {
    if (!projectId) return [];
    return categoriesForProject(projectId, tenantFiles, tenantDocuments, {
      showEmptySystem: false,
    });
  }, [projectId, tenantFiles, tenantDocuments]);

  const folderFiles = useMemo(() => {
    if (!projectId || !category) return [];
    return filesInFolder(projectId, category, tenantFiles);
  }, [projectId, category, tenantFiles]);

  const folderDocuments = useMemo(() => {
    if (!projectId || !category) return [];
    return documentsInFolder(projectId, category, tenantDocuments);
  }, [projectId, category, tenantDocuments]);

  if (!hydrated) return <PageSkeleton />;

  const base = "/client/files" as const;

  if (projectId && project && category) {
    const folderLabel = folderCategoryLabel(
      category,
      folderFiles[0]?.categoryLabel ?? folders.find((folder) => folder.category === category)?.label
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
          backHref={filesHref(base, project.id)}
          backLabel={project.name}
          current={folderLabel}
        />
        {empty ? (
          <EmptyState
            title="Nenhum arquivo"
            description="Nenhum arquivo nesta pasta ainda."
          />
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
                    <DocumentCard doc={entry.doc} />
                  ) : (
                    <FileCard file={entry.file} hideCategory />
                  )}
                </li>
              ))}
          </ul>
        )}
      </div>
    );
  }

  if (projectId && project) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
        <PageHeader
          title={project.name}
          description="Pastas deste projeto."
          className="mb-0"
        />
        <FilesBreadcrumb backHref={base} backLabel="Projetos" current={project.name} />
        {folders.length > 0 ? (
          <FolderGrid>
            {folders.map((folder) => (
              <FolderCard
                key={folder.category}
                href={filesHref(base, project.id, folder.category)}
                title={folder.label}
                subtitle={itemCountLabel(folder.count)}
              />
            ))}
          </FolderGrid>
        ) : (
          <EmptyState
            title="Nenhuma pasta ainda"
            description="Arquivos compartilhados deste projeto aparecerão aqui."
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <PageHeader
        icon={FolderOpen}
        title="Arquivos"
        description="Contrato, documentação e anexos por projeto."
      />
      {clientProjects.length > 0 ? (
        <FolderGrid>
          {clientProjects.map((item) => (
            <FolderCard
              key={item.id}
              href={filesHref(base, item.id)}
              title={item.name}
              subtitle={itemCountLabel(countProjectItems(item.id, tenantFiles, tenantDocuments))}
            />
          ))}
        </FolderGrid>
      ) : (
        <EmptyState
          title="Nenhum projeto"
          description="Quando houver um projeto vinculado à sua conta, os arquivos aparecerão aqui."
        />
      )}
    </div>
  );
}

export default function ClientFilesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClientFilesInner />
    </Suspense>
  );
}
