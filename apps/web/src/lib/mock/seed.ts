import type {
  AuditLog,
  Client,
  DocumentItem,
  FileItem,
  NotificationItem,
  Project,
  Release,
  Task,
  UpdateItem,
  User,
} from "@/types";

/** Senha temporária do seed (não exibida no login). */
export const DEMO_PASSWORD = "Hub2026!";

/** Estado inicial vazio: só o admin dono. Todo o resto nasce pela UI. */
export const SEED_USERS: User[] = [
  {
    id: "u-admin",
    email: "admin@clienthub.dev",
    name: "Admin",
    role: "ADMIN",
    clientId: null,
    avatarInitials: "AD",
    active: true,
    title: "Dono · Avadesk",
    mustCompleteProfile: false,
    profileCompletedAt: null,
    projectIds: [],
    accessAllProjects: true,
  },
];

export const SEED_CLIENTS: Client[] = [];
export const SEED_PROJECTS: Project[] = [];
export const SEED_UPDATES: UpdateItem[] = [];
export const SEED_RELEASES: Release[] = [];
export const SEED_TASKS: Task[] = [];
export const SEED_DOCUMENTS: DocumentItem[] = [];
export const SEED_FILES: FileItem[] = [];
export const SEED_NOTIFICATIONS: NotificationItem[] = [];
export const SEED_AUDIT: AuditLog[] = [];

/** Senhas mock persistidas no hub-store (`userPasswords`). */
export const SEED_PASSWORDS: Record<string, string> = {
  "admin@clienthub.dev": DEMO_PASSWORD,
};
