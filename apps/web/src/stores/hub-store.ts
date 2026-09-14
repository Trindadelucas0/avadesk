"use client";

import { create } from "zustand";
import {
  DEFAULT_NOTIFICATION_PREFS,
  type CompleteClientProfileInput,
  type DocumentItem,
  type FileItem,
  type MockStoreState,
  type NotificationItem,
  type NotificationPrefs,
  type Project,
  type SessionUser,
  type TaskStatus,
  type Ticket,
  type TicketStage,
  type UpdateItem,
  type User,
  type CreateTicketInput,
  type UpdateTicketInput,
} from "@/types";
import { initialsFromName, isValidEmail, parseOptionalInstagram } from "@/lib/onboarding";
import { DEFAULT_COMPANY_NAME } from "@/lib/brand";
import { ApiError, newIdempotencyKey, v2 } from "@/lib/v2-client";
import { attentionKindClient } from "@/lib/project-attention";
import { normalizeFileCategory } from "@/lib/utils";

export interface CreateUpdateInput {
  projectId: string;
  title: string;
  content: string;
  type: UpdateItem["type"];
  status: UpdateItem["status"];
  visibleToClient: boolean;
}

type CreateUpdateResult = {
  item: UpdateItem | null;
  error?: string;
  emailQueued?: boolean;
  idempotent?: boolean;
};

export type ProjectEnvEnvironment = "test" | "production";

export type ProjectEnvMeta = {
  environment: ProjectEnvEnvironment;
  hasContent: boolean;
  updatedAt: string | null;
};

interface HubStore extends MockStoreState {
  hydrate: () => Promise<void>;
  setActiveClient: (clientId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  login: (
    email: string,
    password: string,
    remember?: boolean
  ) => Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refresh: () => Promise<void>;
  setNotificationPrefs: (prefs: NotificationPrefs) => void;
  setOrganizationName: (name: string) => Promise<void>;
  createUpdate: (input: CreateUpdateInput) => Promise<CreateUpdateResult>;
  moveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  createNotification: (n: Omit<NotificationItem, "id" | "createdAt" | "read">) => Promise<void>;
  upsertProject: (project: Partial<Project> & { id?: string; clientId: string; name: string }) => Promise<Project>;
  upsertClient: (data: {
    id?: string;
    name: string;
    contactEmail: string;
    phone: string;
    whatsapp: string;
    company?: string;
    segment?: string;
    cnpj?: string;
    notes?: string;
  }) => Promise<void>;
  upsertUser: (data: Partial<User> & {
    email: string;
    name: string;
    role: User["role"];
    memberships?: Array<{ clientId: string; accessAllProjects: boolean; projectIds: string[] }>;
  }) => Promise<
    { ok: true; user: User; tempPassword?: string } | { ok: false; error: string }
  >;
  completeClientProfile: (
    input: CompleteClientProfileInput
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  toggleUserActive: (
    userId: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  deleteUser: (userId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  refreshUsers: () => Promise<void>;
  fetchUser: (userId: string) => Promise<User | null>;
  updateUser: (
    userId: string,
    data: {
      email: string;
      name: string;
      role: User["role"];
      clientId: string | null;
      active: boolean;
      accessAllProjects: boolean;
      projectIds: string[];
      memberships?: Array<{ clientId: string; accessAllProjects: boolean; projectIds: string[] }>;
    }
  ) => Promise<{ ok: true; user: User } | { ok: false; error: string }>;
  setUserPassword: (
    userId: string,
    password: string
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  sendUserWelcomeEmail: (
    userId: string
  ) => Promise<{ ok: true; welcomeEmail: string } | { ok: false; error: string }>;
  addDocument: (
    doc: Omit<DocumentItem, "id" | "history" | "uploadedAt"> & { note?: string }
  ) => Promise<void>;
  addDocumentVersion: (documentId: string, version: string, note: string) => Promise<void>;
  addFile: (file: Omit<FileItem, "id" | "uploadedAt"> & { contentBase64?: string }) => Promise<void>;
  updateFile: (
    id: string,
    data: { name?: string; category?: string; categoryLabel?: string }
  ) => Promise<{ ok: true; file: FileItem } | { ok: false; error: string }>;
  deleteFile: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateDocument: (
    id: string,
    data: { title: string }
  ) => Promise<{ ok: true; document: DocumentItem } | { ok: false; error: string }>;
  deleteDocument: (id: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  upsertRelease: (data: {
    id?: string;
    projectId: string;
    version: string;
    title: string;
    notes: string;
    highlights: string[];
  }) => Promise<void>;
  deleteRelease: (id: string) => Promise<void>;
  revealCredentials: (projectId: string) => Promise<{
    systemUrl: string;
    accessUser: string;
    accessPassword: string;
  }>;
  listProjectEnv: (projectId: string) => Promise<{ environments: ProjectEnvMeta[] }>;
  saveProjectEnv: (
    projectId: string,
    environment: ProjectEnvEnvironment,
    content: string
  ) => Promise<ProjectEnvMeta>;
  revealProjectEnv: (
    projectId: string,
    environment: ProjectEnvEnvironment
  ) => Promise<{ content: string }>;
  clearProjectEnv: (projectId: string, environment: ProjectEnvEnvironment) => Promise<void>;
  createTicket: (
    input: CreateTicketInput
  ) => Promise<{ ok: true; ticket: Ticket; attachFailed?: boolean } | { ok: false; error: string }>;
  updateTicket: (
    id: string,
    input: UpdateTicketInput
  ) => Promise<{ ok: true; ticket: Ticket } | { ok: false; error: string }>;
  setTicketStage: (id: string, stage: TicketStage, note?: string) => Promise<void>;
  confirmTicket: (id: string) => Promise<void>;
  deleteTicket: (id: string) => Promise<void>;
  reopenTicket: (id: string, note: string) => Promise<void>;
  listClosedTickets: (opts: {
    from: string;
    to: string;
    projectId?: string;
  }) => Promise<{ ok: true; tickets: Ticket[] } | { ok: false; error: string }>;
  postTicketMessage: (id: string, body: string, waitForUserId?: string) => Promise<void>;
  appendAudit: (action: string, entity: string, entityId: string, meta?: string) => void;
  isStale: (projectId: string) => boolean;
  projectAttention: (projectId: string) => "stale" | "sem_novidade" | null;
  applyRemoteSnapshot: (payload: Partial<MockStoreState> & { session?: SessionUser | null }) => void;
  getUnreadCount: (userId: string) => number;
}

function applyUser(
  set: (partial: Partial<HubStore> | ((state: HubStore) => Partial<HubStore>)) => void,
  user: User
) {
  set((s) => ({
    users: s.users.some((u) => u.id === user.id)
      ? s.users.map((u) => (u.id === user.id ? user : u))
      : [...s.users, user],
    session:
      s.session?.id === user.id
        ? {
            ...s.session,
            email: user.email,
            name: user.name,
            role: user.role,
            clientId: user.clientId,
            clientIds: user.clientIds,
            memberships: user.memberships,
            activeClientId: user.activeClientId,
            avatarInitials: user.avatarInitials,
            mustCompleteProfile: user.mustCompleteProfile,
            projectIds: user.projectIds,
            accessAllProjects: user.accessAllProjects,
          }
        : s.session,
  }));
}

const emptyState: MockStoreState = {
  users: [],
  clients: [],
  projects: [],
  updates: [],
  releases: [],
  tasks: [],
  tickets: [],
  documents: [],
  files: [],
  notifications: [],
  auditLogs: [],
  userPasswords: {},
  notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
  organizationName: DEFAULT_COMPANY_NAME,
  session: null,
  hydrated: false,
};

export const useHubStore = create<HubStore>()((set, get) => ({
  ...emptyState,

  hydrate: async () => {
    await get().restoreSession();
    set({ hydrated: true });
  },

  setActiveClient: async (clientId) => {
    try {
      await v2<{ user: SessionUser }>("/me/active-client", {
        method: "POST",
        json: { clientId },
      });
      await get().restoreSession();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível trocar a empresa." };
    }
  },

  restoreSession: async () => {
    try {
      const data = await v2<{
        session: SessionUser;
        organizationName: string;
        clients: MockStoreState["clients"];
        projects: MockStoreState["projects"];
        updates: MockStoreState["updates"];
        releases: MockStoreState["releases"];
        tasks: MockStoreState["tasks"];
        tickets: MockStoreState["tickets"];
        documents: MockStoreState["documents"];
        files: MockStoreState["files"];
        notifications: MockStoreState["notifications"];
        users: MockStoreState["users"];
      }>("/bootstrap");
      get().applyRemoteSnapshot({ ...data, session: data.session });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ session: null, hydrated: true });
        return;
      }
      set({ session: get().session });
    }
  },

  refresh: async () => {
    await get().restoreSession();
  },

  login: async (email, password) => {
    try {
      const data = await v2<{ user: SessionUser }>("/auth/login", {
        method: "POST",
        json: { email: email.trim().toLowerCase(), password: password.trim() },
      });
      set({ session: data.user });
      await get().restoreSession();
      return { ok: true as const, user: get().session ?? data.user };
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente de novo.";
      return { ok: false as const, error: message };
    }
  },

  setNotificationPrefs: (prefs) => {
    set({ notificationPrefs: prefs });
  },

  setOrganizationName: async (name) => {
    await v2("/settings", { method: "PATCH", json: { organizationName: name } });
    set({ organizationName: name });
  },

  logout: async () => {
    try {
      await v2("/auth/logout", { method: "POST", json: {} });
    } catch {
      /* still clear local */
    }
    set({ ...emptyState, hydrated: true, session: null });
  },

  createUpdate: async (input) => {
    const session = get().session;
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) {
      return { item: null, error: "Sem permissão." };
    }
    try {
      const data = await v2<{ update: UpdateItem; emailQueued?: boolean; idempotent?: boolean }>(
        "/updates",
        {
          method: "POST",
          headers: { "Idempotency-Key": newIdempotencyKey() },
          json: input,
        }
      );
      set((s) => ({
        updates: s.updates.some((u) => u.id === data.update.id)
          ? s.updates
          : [data.update, ...s.updates],
        projects: s.projects.map((p) =>
          p.id === input.projectId ? { ...p, updatedAt: data.update.createdAt } : p
        ),
      }));
      return {
        item: data.update,
        emailQueued: data.emailQueued,
        idempotent: data.idempotent,
      };
    } catch (err) {
      return {
        item: null,
        error: err instanceof ApiError ? err.message : "Não foi possível publicar.",
      };
    }
  },

  moveTask: async (taskId, status) => {
    const data = await v2<{ task: MockStoreState["tasks"][number] }>(`/tasks/${taskId}`, {
      method: "PATCH",
      json: { status },
    });
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, ...data.task } : t)),
    }));
  },

  markNotificationRead: async (id) => {
    await v2(`/notifications/${id}/read`, { method: "PATCH", json: {} });
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllNotificationsRead: async (userId) => {
    await v2("/notifications/read-all", { method: "POST", json: {} });
    set((s) => ({
      notifications: s.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    }));
  },

  createNotification: async (n) => {
    const res = await v2<{ notification: NotificationItem }>("/notifications", {
      method: "POST",
      json: {
        userId: n.userId,
        title: n.title,
        body: n.body,
        href: n.href,
      },
    });
    set((s) => ({ notifications: [res.notification, ...s.notifications] }));
  },

  upsertProject: async (data) => {
    if (data.id) {
      const res = await v2<{ project: Project }>(`/projects/${data.id}`, {
        method: "PATCH",
        json: {
          clientId: data.clientId,
          name: data.name,
          status: data.status,
          progressPct: data.progressPct,
          summary: data.summary,
          systemUrl: data.systemUrl,
          accessUser: data.accessUser,
          accessPassword: data.accessPassword,
          currentlyBuildingTitle: data.currentlyBuilding?.title,
          currentlyBuildingProgressPct: data.currentlyBuilding?.progressPct,
          currentlyBuildingOwner: data.currentlyBuilding?.ownerName,
          currentlyBuildingEta: data.currentlyBuilding?.etaLabel,
          currentlyBuildingDescription: data.currentlyBuilding?.description,
          nextStepTitle: data.nextSteps?.[0]?.title,
          nextStepDueLabel: data.nextSteps?.[0]?.dueLabel,
        },
      });
      set((s) => ({
        projects: s.projects.map((p) => (p.id === res.project.id ? res.project : p)),
      }));
      return res.project;
    }
    const res = await v2<{ project: Project }>("/projects", {
      method: "POST",
      json: {
        clientId: data.clientId,
        name: data.name,
        status: data.status ?? "planning",
        progressPct: data.progressPct ?? 0,
        summary: data.summary ?? "",
        systemUrl: data.systemUrl,
        accessUser: data.accessUser,
        accessPassword: data.accessPassword,
      },
    });
    set((s) => ({ projects: [res.project, ...s.projects] }));
    return res.project;
  },

  upsertClient: async (data) => {
    if (data.id) {
      const res = await v2<{ client: MockStoreState["clients"][number] }>(`/clients/${data.id}`, {
        method: "PATCH",
        json: data,
      });
      set((s) => ({
        clients: s.clients.map((c) => (c.id === res.client.id ? res.client : c)),
      }));
      return;
    }
    const res = await v2<{ client: MockStoreState["clients"][number] }>("/clients", {
      method: "POST",
      json: data,
    });
    set((s) => ({ clients: [res.client, ...s.clients] }));
  },

  upsertUser: async (data) => {
    const email = data.email.trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
    const existing = get().users.find((u) => u.email === email);
    try {
      if (existing) {
        const self = get().session?.id === existing.id;
        if (self) {
          const res = await v2<{ user: SessionUser }>("/auth/me", {
            method: "PATCH",
            json: { name: data.name },
          });
          set((s) => ({
            session: { ...res.user, projectIds: s.session?.projectIds ?? [] },
            users: s.users.map((u) =>
              u.id === res.user.id ? { ...u, name: res.user.name, avatarInitials: res.user.avatarInitials } : u
            ),
          }));
          return { ok: true, user: get().users.find((u) => u.id === existing.id)! };
        }
        const res = await v2<{ user: User }>(`/users/${existing.id}`, {
          method: "PATCH",
          json: {
            name: data.name,
            email,
            role: data.role,
            clientId: data.clientId,
            active: data.active,
            projectIds: data.projectIds,
            accessAllProjects: data.accessAllProjects,
            memberships: data.memberships,
          },
        });
        set((s) => ({ users: s.users.map((u) => (u.id === res.user.id ? res.user : u)) }));
        return { ok: true, user: res.user };
      }
      if (data.role === "CLIENT" && !(data.memberships?.length || data.clientId)) {
        return { ok: false, error: "Vincule o usuário a uma empresa." };
      }
      const name = data.name.trim() || (data.role === "CLIENT" ? "Convidado" : "");
      if (!name) return { ok: false, error: "Informe o nome." };
      const res = await v2<{ user: User; tempPassword?: string }>("/users", {
        method: "POST",
        json: {
          name,
          email,
          role: data.role,
          clientId: data.clientId ?? null,
          accessAllProjects: data.accessAllProjects,
          projectIds: data.projectIds ?? [],
          memberships: data.memberships,
        },
      });
      set((s) => ({ users: [...s.users, res.user] }));
      return { ok: true, user: res.user, tempPassword: res.tempPassword };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível salvar." };
    }
  },

  completeClientProfile: async (input) => {
    const name = input.name.trim();
    if (name.length < 3) return { ok: false, error: "Informe o nome completo (mínimo 3 caracteres)." };
    const email = input.email.trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
    if (input.password.length < 8) {
      return { ok: false, error: "A nova senha precisa ter pelo menos 8 caracteres." };
    }
    if (input.password !== input.passwordConfirm) {
      return { ok: false, error: "A confirmação da senha não confere." };
    }
    const companyIg = parseOptionalInstagram(input.instagramCompany, "Instagram da empresa");
    if (!companyIg.ok) return { ok: false, error: companyIg.error };
    const personalIg = parseOptionalInstagram(input.instagramPersonal, "Instagram pessoal");
    if (!personalIg.ok) return { ok: false, error: personalIg.error };
    try {
      const res = await v2<{ user: SessionUser }>("/auth/profile", {
        method: "PATCH",
        json: {
          name,
          email,
          password: input.password,
          instagramCompany: companyIg.value,
          instagramPersonal: personalIg.value,
        },
      });
      set((s) => ({
        session: res.user,
        users: s.users.map((u) =>
          u.id === res.user.id
            ? {
                ...u,
                name,
                email,
                avatarInitials: initialsFromName(name) || u.avatarInitials,
                mustCompleteProfile: false,
                instagramCompany: companyIg.value,
                instagramPersonal: personalIg.value,
                profileCompletedAt: new Date().toISOString(),
              }
            : u
        ),
      }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível salvar." };
    }
  },

  toggleUserActive: async (userId) => {
    const current = get().users.find((u) => u.id === userId);
    if (!current) return { ok: false, error: "Usuário não encontrado." };
    try {
      const res = await v2<{ user: User }>(`/users/${userId}`, {
        method: "PATCH",
        json: {
          email: current.email,
          name: current.name,
          role: current.role,
          clientId: current.clientId,
          active: !current.active,
        },
      });
      applyUser(set, res.user);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível atualizar." };
    }
  },

  deleteUser: async (userId) => {
    try {
      await v2(`/users/${userId}`, { method: "DELETE" });
      set((s) => ({ users: s.users.filter((u) => u.id !== userId) }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível excluir." };
    }
  },

  refreshUsers: async () => {
    const session = get().session;
    if (!session || (session.role !== "ADMIN" && session.role !== "MANAGER")) return;
    try {
      const res = await v2<{ users: User[] }>("/users");
      set({ users: res.users });
    } catch {
      /* keep bootstrap cache */
    }
  },

  fetchUser: async (userId) => {
    try {
      const res = await v2<{ user: User }>(`/users/${userId}`);
      applyUser(set, res.user);
      return res.user;
    } catch (err) {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return null;
      throw err;
    }
  },

  updateUser: async (userId, data) => {
    const email = data.email.trim().toLowerCase();
    if (!isValidEmail(email)) return { ok: false, error: "E-mail inválido." };
    const name = data.name.trim();
    if (!name) return { ok: false, error: "Informe o nome." };
    if (data.role === "CLIENT" && !(data.memberships?.length || data.clientId)) {
      return { ok: false, error: "Vincule o usuário a uma empresa." };
    }
    try {
      const res = await v2<{ user: User }>(`/users/${userId}`, {
        method: "PATCH",
        json: {
          name,
          email,
          role: data.role,
          clientId: data.clientId,
          active: data.active,
          projectIds: data.projectIds,
          accessAllProjects: data.accessAllProjects,
          memberships: data.memberships,
        },
      });
      applyUser(set, res.user);
      return { ok: true, user: res.user };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível salvar." };
    }
  },

  setUserPassword: async (userId, password) => {
    if (password.length < 8) {
      return { ok: false, error: "A nova senha precisa ter pelo menos 8 caracteres." };
    }
    try {
      await v2<{ user: User }>(`/users/${userId}/password`, {
        method: "POST",
        json: { password },
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível alterar a senha." };
    }
  },

  sendUserWelcomeEmail: async (userId) => {
    try {
      const res = await v2<{ welcomeEmail: string }>(`/users/${userId}/welcome`, {
        method: "POST",
      });
      if (res.welcomeEmail === "failed") {
        return { ok: false, error: "Não foi possível enviar o e-mail. Tente de novo." };
      }
      if (res.welcomeEmail === "logged") {
        return { ok: false, error: "E-mail só registrado no servidor (sem envio)." };
      }
      return { ok: true, welcomeEmail: res.welcomeEmail };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível enviar o e-mail." };
    }
  },

  addDocument: async (doc) => {
    const res = await v2<{ document: DocumentItem }>("/documents", {
      method: "POST",
      json: {
        projectId: doc.projectId,
        title: doc.title,
        version: doc.version,
        category: doc.category,
        note: doc.note,
      },
    });
    if (res.document) {
      set((s) => ({ documents: [res.document, ...s.documents] }));
    }
  },

  addDocumentVersion: async (documentId, version, note) => {
    const res = await v2<{ document: DocumentItem }>(`/documents/${documentId}/versions`, {
      method: "POST",
      json: { version, note },
    });
    if (res.document) {
      set((s) => ({
        documents: s.documents.map((d) => (d.id === documentId ? res.document : d)),
      }));
    }
  },

  addFile: async (file) => {
    const customLabel = file.categoryLabel?.trim();
    const res = await v2<{ file: FileItem }>("/files", {
      method: "POST",
      json: {
        projectId: file.projectId,
        name: file.name,
        mime: file.mime,
        ...(customLabel
          ? { categoryLabel: customLabel }
          : { category: file.category }),
        contentBase64: file.contentBase64 || (typeof btoa === "function" ? btoa(" ") : ""),
      },
    });
    set((s) => ({ files: [res.file, ...s.files] }));
  },

  updateFile: async (id, data) => {
    try {
      const res = await v2<{ file: FileItem }>(`/files/${id}`, {
        method: "PATCH",
        json: data,
      });
      set((s) => ({ files: s.files.map((f) => (f.id === res.file.id ? res.file : f)) }));
      return { ok: true, file: res.file };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível salvar." };
    }
  },

  deleteFile: async (id) => {
    try {
      await v2(`/files/${id}`, { method: "DELETE" });
      set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível excluir." };
    }
  },

  updateDocument: async (id, data) => {
    try {
      const res = await v2<{ document: DocumentItem }>(`/documents/${id}`, {
        method: "PATCH",
        json: data,
      });
      if (res.document) {
        set((s) => ({
          documents: s.documents.map((d) => (d.id === res.document.id ? res.document : d)),
        }));
      }
      return { ok: true, document: res.document };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível salvar." };
    }
  },

  deleteDocument: async (id) => {
    try {
      await v2(`/documents/${id}`, { method: "DELETE" });
      set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : "Não foi possível excluir." };
    }
  },

  upsertRelease: async (data) => {
    if (data.id) {
      const res = await v2<{ release: MockStoreState["releases"][number] }>(`/releases/${data.id}`, {
        method: "PATCH",
        json: data,
      });
      set((s) => ({
        releases: s.releases.map((r) => (r.id === res.release.id ? res.release : r)),
      }));
      return;
    }
    const res = await v2<{ release: MockStoreState["releases"][number] }>("/releases", {
      method: "POST",
      json: data,
    });
    set((s) => ({ releases: [res.release, ...s.releases] }));
  },

  deleteRelease: async (id) => {
    await v2(`/releases/${id}`, { method: "DELETE" });
    set((s) => ({ releases: s.releases.filter((r) => r.id !== id) }));
  },

  revealCredentials: async (projectId) => {
    return v2(`/projects/${projectId}/credentials/reveal`, { method: "POST", json: {} });
  },

  listProjectEnv: async (projectId) => {
    return v2<{ environments: ProjectEnvMeta[] }>(`/projects/${projectId}/env`);
  },

  saveProjectEnv: async (projectId, environment, content) => {
    return v2<ProjectEnvMeta>(`/projects/${projectId}/env/${environment}`, {
      method: "PUT",
      json: { content },
    });
  },

  revealProjectEnv: async (projectId, environment) => {
    return v2<{ content: string }>(`/projects/${projectId}/env/${environment}/reveal`, {
      method: "POST",
      json: {},
    });
  },

  clearProjectEnv: async (projectId, environment) => {
    await v2(`/projects/${projectId}/env/${environment}`, { method: "DELETE" });
  },

  createTicket: async (input) => {
    const { images = [], ...payload } = input;
    try {
      const data = await v2<{ ticket: Ticket }>("/tickets", {
        method: "POST",
        json: payload,
      });
      let ticket: Ticket = {
        ...data.ticket,
        attachments: data.ticket.attachments ?? [],
      };
      let attachFailed = false;
      for (const img of images) {
        try {
          const updated = await v2<{ ticket: Ticket }>(`/tickets/${ticket.id}/attachments`, {
            method: "POST",
            json: img,
          });
          ticket = { ...updated.ticket, attachments: updated.ticket.attachments ?? [] };
        } catch {
          attachFailed = true;
        }
      }
      set((s) => ({
        tickets: s.tickets.some((t) => t.id === ticket.id)
          ? s.tickets.map((t) => (t.id === ticket.id ? ticket : t))
          : [ticket, ...s.tickets],
      }));
      return { ok: true as const, ticket, attachFailed };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof ApiError ? err.message : "Não foi possível abrir o chamado.",
      };
    }
  },

  updateTicket: async (id, input) => {
    try {
      const data = await v2<{ ticket: Ticket }>(`/tickets/${id}/content`, {
        method: "PATCH",
        json: input,
      });
      set((s) => ({
        tickets: s.tickets.map((t) =>
          t.id === id ? { ...data.ticket, attachments: data.ticket.attachments ?? [] } : t
        ),
      }));
      return { ok: true as const, ticket: data.ticket };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof ApiError ? err.message : "Não foi possível atualizar o chamado.",
      };
    }
  },

  setTicketStage: async (id, stage, note) => {
    const data = await v2<{ ticket: Ticket }>(`/tickets/${id}`, {
      method: "PATCH",
      json: { stage, note: note ?? "" },
    });
    set((s) => ({
      tickets: s.tickets.map((t) => (t.id === id ? data.ticket : t)),
    }));
  },

  confirmTicket: async (id) => {
    await v2<{ ticket: Ticket }>(`/tickets/${id}/confirm`, {
      method: "POST",
      json: {},
    });
    set((s) => ({
      tickets: s.tickets.filter((t) => t.id !== id),
    }));
  },

  deleteTicket: async (id) => {
    await v2(`/tickets/${id}`, { method: "DELETE" });
    set((s) => ({
      tickets: s.tickets.filter((t) => t.id !== id),
    }));
  },

  listClosedTickets: async ({ from, to, projectId }) => {
    try {
      const params = new URLSearchParams({ stage: "closed", from, to });
      if (projectId) params.set("projectId", projectId);
      const data = await v2<{ tickets: Ticket[] }>(`/tickets?${params.toString()}`);
      return {
        ok: true as const,
        tickets: (data.tickets ?? []).map((ticket) => ({
          ...ticket,
          attachments: ticket.attachments ?? [],
        })),
      };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof ApiError ? err.message : "Não foi possível consultar os concluídos.",
      };
    }
  },

  reopenTicket: async (id, note) => {
    const data = await v2<{ ticket: Ticket }>(`/tickets/${id}/reopen`, {
      method: "POST",
      json: { note },
    });
    set((s) => ({
      tickets: s.tickets.map((t) => (t.id === id ? data.ticket : t)),
    }));
  },

  postTicketMessage: async (id, body, waitForUserId) => {
    const data = await v2<{ ticket: Ticket }>(`/tickets/${id}/messages`, {
      method: "POST",
      json: waitForUserId ? { body, waitForUserId } : { body },
    });
    set((s) => ({
      tickets: s.tickets.map((t) => (t.id === id ? data.ticket : t)),
    }));
  },

  appendAudit: () => {
    /* server-side */
  },

  isStale: (projectId) => get().projectAttention(projectId) === "stale",

  projectAttention: (projectId) => {
    const p = get().projects.find((x) => x.id === projectId);
    if (!p) return null;
    return attentionKindClient(p.status, p.lastClientUpdateAt ?? p.updatedAt);
  },

  getUnreadCount: (userId) =>
    get().notifications.filter((n) => n.userId === userId && !n.read).length,

  applyRemoteSnapshot: (payload) => {
    set({
      users: payload.users ?? get().users,
      clients: payload.clients ?? get().clients,
      projects: payload.projects ?? get().projects,
      updates: payload.updates ?? get().updates,
      releases: payload.releases ?? get().releases,
      tasks: payload.tasks ?? get().tasks,
      tickets: (payload.tickets ?? get().tickets).filter((t) => t.stage !== "closed"),
      documents: payload.documents ?? get().documents,
      files: (payload.files ?? get().files).map((f) => ({
        ...f,
        category: normalizeFileCategory(f.category),
        categoryLabel: f.categoryLabel,
      })),
      notifications: payload.notifications ?? get().notifications,
      auditLogs: payload.auditLogs ?? get().auditLogs,
      userPasswords: {},
      notificationPrefs: payload.notificationPrefs ?? get().notificationPrefs,
      organizationName: payload.organizationName ?? get().organizationName,
      session: payload.session !== undefined ? payload.session : get().session,
    });
  },
}));

export const SESSION_COOKIE = "avadesk_session";
