import { SYSTEM_FILE_CATEGORIES } from "@/types";
import type { DocumentItem, FileItem } from "@/types";
import { fileCategoryLabel } from "@/lib/utils";

export const DOCUMENTATION_FOLDER_CATEGORY = "contrato_documentacao";

const PROJECT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORY_SLUG_RE = /^[a-z0-9]+(?:_[a-z0-9]+){0,7}$/;
const BLOCKED_CATEGORY_QUERY = new Set(["all", "novo", "new", "__new__"]);

export type FilesBasePath = "/client/files" | "/admin/files";

export type CategoryFolder = {
  category: string;
  label: string;
  count: number;
};

export function folderCategoryLabel(category: string, categoryLabel?: string | null): string {
  if (category === DOCUMENTATION_FOLDER_CATEGORY || category === "contrato") {
    return "Documentação";
  }
  return fileCategoryLabel(category, categoryLabel);
}

export function itemCountLabel(count: number): string {
  if (count <= 0) return "vazio";
  if (count === 1) return "1 arquivo";
  return `${count} arquivos`;
}

export function filesHref(base: FilesBasePath, projectId?: string | null, category?: string | null): string {
  const params = new URLSearchParams();
  if (projectId) params.set("project", projectId);
  if (projectId && category) params.set("category", category);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function parseProjectQuery(raw: string | null, allowedIds: Set<string>): string | null {
  if (!raw || !PROJECT_ID_RE.test(raw)) return null;
  if (!allowedIds.has(raw)) return null;
  return raw;
}

export function parseCategoryQuery(raw: string | null): string | null {
  if (!raw || BLOCKED_CATEGORY_QUERY.has(raw)) return null;
  if (raw.length < 2 || raw.length > 40) return null;
  if (!CATEGORY_SLUG_RE.test(raw)) return null;
  return raw;
}

export function countProjectItems(
  projectId: string,
  files: FileItem[],
  documents: DocumentItem[]
): number {
  let count = 0;
  for (const file of files) {
    if (file.projectId === projectId) count += 1;
  }
  for (const doc of documents) {
    if (doc.projectId === projectId) count += 1;
  }
  return count;
}

export function categoriesForProject(
  projectId: string,
  files: FileItem[],
  documents: DocumentItem[],
  opts: { showEmptySystem: boolean }
): CategoryFolder[] {
  const folders = new Map<string, CategoryFolder>();

  const bump = (category: string, label: string, n = 1) => {
    const current = folders.get(category);
    if (current) {
      current.count += n;
      if (!current.label) current.label = label;
      return;
    }
    folders.set(category, { category, label, count: n });
  };

  for (const file of files) {
    if (file.projectId !== projectId) continue;
    bump(file.category, folderCategoryLabel(file.category, file.categoryLabel));
  }

  let documentCount = 0;
  for (const doc of documents) {
    if (doc.projectId === projectId) documentCount += 1;
  }
  if (documentCount > 0) {
    bump(DOCUMENTATION_FOLDER_CATEGORY, "Documentação", documentCount);
  }

  if (opts.showEmptySystem) {
    for (const slug of SYSTEM_FILE_CATEGORIES) {
      if (!folders.has(slug)) {
        folders.set(slug, {
          category: slug,
          label: folderCategoryLabel(slug),
          count: 0,
        });
      }
    }
  }

  return [...folders.values()].sort((a, b) => {
    const rank = (category: string) => {
      if (category === DOCUMENTATION_FOLDER_CATEGORY) return 0;
      if (category === "outro") return 2;
      return 1;
    };
    const byRank = rank(a.category) - rank(b.category);
    if (byRank !== 0) return byRank;
    return a.label.localeCompare(b.label, "pt-BR");
  });
}

export function filesInFolder(
  projectId: string,
  category: string,
  files: FileItem[]
): FileItem[] {
  return files
    .filter((file) => file.projectId === projectId && file.category === category)
    .sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
}

export function documentsInFolder(
  projectId: string,
  category: string,
  documents: DocumentItem[]
): DocumentItem[] {
  if (category !== DOCUMENTATION_FOLDER_CATEGORY) return [];
  return documents
    .filter((doc) => doc.projectId === projectId)
    .sort(
      (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
}
