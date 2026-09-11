"use client";

import { clientAccessibleProjects } from "@/lib/access";
import { useHubStore } from "@/stores/hub-store";
import type {
  Client,
  DocumentItem,
  FileItem,
  NotificationItem,
  Project,
  Release,
  SessionUser,
  Task,
  UpdateItem,
  User,
} from "@/types";

/** Service layer — today reads mock store; swap to API later without rewriting pages */

function tenantFilterProjects(projects: Project[], session: SessionUser | null): Project[] {
  if (!session) return [];
  if (session.role === "CLIENT") {
    return clientAccessibleProjects(session, projects);
  }
  return projects;
}

function tenantFilterUpdates(
  updates: UpdateItem[],
  projects: Project[],
  session: SessionUser | null
): UpdateItem[] {
  if (!session) return [];
  if (session.role === "CLIENT") {
    const ids = new Set(clientAccessibleProjects(session, projects).map((p) => p.id));
    return updates.filter((u) => ids.has(u.projectId) && u.visibleToClient);
  }
  return updates;
}

export const authService = {
  login(email: string, password: string) {
    return useHubStore.getState().login(email, password);
  },
  logout() {
    useHubStore.getState().logout();
  },
  me(): SessionUser | null {
    return useHubStore.getState().session;
  },
};

export const projectService = {
  list(): Project[] {
    const { projects, session } = useHubStore.getState();
    return tenantFilterProjects(projects, session);
  },
  get(id: string): Project | undefined {
    return projectService.list().find((p) => p.id === id);
  },
  listAllAdmin(): Project[] {
    const { projects, session } = useHubStore.getState();
    if (!session || session.role === "CLIENT") return [];
    return projects;
  },
};

export const clientService = {
  list(): Client[] {
    const { clients, session } = useHubStore.getState();
    if (!session) return [];
    if (session.role === "CLIENT") return clients.filter((c) => c.id === session.clientId);
    return clients;
  },
  get(id: string) {
    return clientService.list().find((c) => c.id === id);
  },
};

export const updateService = {
  list(projectId?: string): UpdateItem[] {
    const { updates, projects, session } = useHubStore.getState();
    let list = tenantFilterUpdates(updates, projects, session);
    if (projectId) list = list.filter((u) => u.projectId === projectId);
    return [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
  create(input: Parameters<ReturnType<typeof useHubStore.getState>["createUpdate"]>[0]) {
    return useHubStore.getState().createUpdate(input);
  },
};

export const releaseService = {
  list(projectId?: string): Release[] {
    const { releases, session } = useHubStore.getState();
    const projects = projectService.list();
    const ids = new Set(projects.map((p) => p.id));
    let list = releases.filter((r) => ids.has(r.projectId));
    if (session?.role === "CLIENT") {
      /* already filtered by project ids */
    }
    if (projectId) list = list.filter((r) => r.projectId === projectId);
    return [...list].sort(
      (a, b) => new Date(b.releasedAt).getTime() - new Date(a.releasedAt).getTime()
    );
  },
};

export const taskService = {
  list(projectId?: string): Task[] {
    const { tasks, session } = useHubStore.getState();
    if (!session || session.role === "CLIENT") {
      const projects = projectService.list();
      const ids = new Set(projects.map((p) => p.id));
      let list = tasks.filter((t) => ids.has(t.projectId));
      if (projectId) list = list.filter((t) => t.projectId === projectId);
      return list;
    }
    let list = tasks;
    if (projectId) list = list.filter((t) => t.projectId === projectId);
    return list;
  },
  move(taskId: string, status: Task["status"]) {
    useHubStore.getState().moveTask(taskId, status);
  },
};

export const documentService = {
  list(projectId?: string): DocumentItem[] {
    const { documents } = useHubStore.getState();
    const ids = new Set(projectService.list().map((p) => p.id));
    let list = documents.filter((d) => ids.has(d.projectId));
    if (projectId) list = list.filter((d) => d.projectId === projectId);
    return list;
  },
};

export const fileService = {
  list(projectId?: string): FileItem[] {
    const { files } = useHubStore.getState();
    const ids = new Set(projectService.list().map((p) => p.id));
    let list = files.filter((f) => ids.has(f.projectId));
    if (projectId) list = list.filter((f) => f.projectId === projectId);
    return list;
  },
};

export const notificationService = {
  list(): NotificationItem[] {
    const { notifications, session } = useHubStore.getState();
    if (!session) return [];
    return notifications
      .filter((n) => n.userId === session.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
};

export const userService = {
  list(): User[] {
    const { users, session } = useHubStore.getState();
    if (!session || session.role === "CLIENT") return [];
    return users;
  },
};
