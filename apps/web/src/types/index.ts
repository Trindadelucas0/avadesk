export type Role = "ADMIN" | "MANAGER" | "CLIENT";

export type ProjectStatus =
  | "planning"
  | "development"
  | "testing"
  | "homologation"
  | "published"
  | "maintenance"
  | "paused";

export type UpdateType =
  | "FEATURE"
  | "FIX"
  | "UPDATE"
  | "RELEASE"
  | "DOCUMENTATION";

export type TaskStatus = "backlog" | "todo" | "doing" | "review" | "done";

export type SystemFileCategory = "contrato_documentacao" | "outro";
export type FileCategory = string;

export const SYSTEM_FILE_CATEGORIES: SystemFileCategory[] = ["contrato_documentacao", "outro"];
export const FILE_CATEGORY_VALUES = SYSTEM_FILE_CATEGORIES;
export const NEW_FILE_CATEGORY = "__new__";

export function isSystemFileCategory(category: string): category is SystemFileCategory {
  return (SYSTEM_FILE_CATEGORIES as readonly string[]).includes(category);
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  avatarInitials: string;
  active: boolean;
  title?: string;
  mustCompleteProfile: boolean;
  instagramCompany?: string;
  instagramPersonal?: string;
  profileCompletedAt?: string | null;
  /** Projetos que este usuário CLIENT pode ver. Vazio + accessAllProjects = todos da empresa. */
  projectIds: string[];
  accessAllProjects: boolean;
}

export interface Client {
  id: string;
  name: string;
  company: string;
  segment: string;
  logoInitials: string;
  primaryContact: string;
  cnpj: string;
  contactEmail: string;
  phone: string;
  whatsapp: string;
  notes: string;
  createdAt: string;
}

export interface ProjectModule {
  id: string;
  name: string;
  progressPct: number;
  status: ProjectStatus;
  ownerName: string;
}

export interface NextStep {
  id: string;
  order: number;
  title: string;
  dueLabel?: string;
}

export interface CurrentlyBuilding {
  title: string;
  progressPct: number;
  ownerName: string;
  etaLabel: string;
  description: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  progressPct: number;
  summary: string;
  systemUrl: string;
  accessUser: string;
  accessPassword: string;
  currentlyBuilding: CurrentlyBuilding | null;
  nextSteps: NextStep[];
  modules: ProjectModule[];
  updatedAt: string;
  createdAt: string;
  lastClientUpdateAt?: string | null;
  attention?: "stale" | "sem_novidade" | null;
  hasPassword?: boolean;
}

export interface UpdateItem {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  type: UpdateType;
  title: string;
  content: string;
  status: "planejado" | "em_andamento" | "concluido";
  visibleToClient: boolean;
  createdAt: string;
}

export interface Release {
  id: string;
  projectId: string;
  version: string;
  title: string;
  notes: string;
  highlights: string[];
  releasedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  assigneeName: string;
  updatedAt: string;
}

export type TicketType = "bug" | "implementation" | "feature" | "routine";
export type TicketStage = "fix" | "production" | "resolved" | "closed";
export type TicketOrigin = "portal" | "admin_report";

export interface TicketEvent {
  id: string;
  actorId: string | null;
  actorName: string;
  fromStage: TicketStage | null;
  toStage: TicketStage;
  note: string;
  createdAt: string;
}

export interface TicketAttachment {
  id: string;
  originalName: string;
  mime: string;
  sizeBytes: number;
}

export interface TicketMessage {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  kind: "request" | "reply" | string;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  projectId: string;
  projectName: string;
  type: TicketType;
  title: string;
  fields: Record<string, string>;
  stage: TicketStage;
  origin: TicketOrigin;
  createdByUserId: string | null;
  createdByName: string;
  awaitingReplyFromUserId: string | null;
  awaitingReplyFromName: string;
  clientConfirmedAt: string | null;
  clientConfirmedBy: string | null;
  createdAt: string;
  updatedAt: string;
  events: TicketEvent[];
  attachments: TicketAttachment[];
  messages: TicketMessage[];
}

export interface TicketImagePayload {
  name: string;
  mime: string;
  contentBase64: string;
}

export interface CreateTicketInput {
  projectId: string;
  type: TicketType;
  title: string;
  fields: Record<string, string>;
  origin?: TicketOrigin;
  images?: TicketImagePayload[];
}

export interface UpdateTicketInput {
  type: TicketType;
  title: string;
  fields: Record<string, string>;
}

export interface DocumentItem {
  id: string;
  projectId: string;
  title: string;
  version: string;
  category: string;
  uploadedBy: string;
  uploadedAt: string;
  sizeLabel: string;
  history: { version: string; uploadedAt: string; note: string; fileId?: string | null }[];
}

export interface FileItem {
  id: string;
  projectId: string;
  name: string;
  category: FileCategory;
  categoryLabel?: string;
  sizeLabel: string;
  uploadedBy: string;
  uploadedAt: string;
  mime: string;
}

export interface NotificationItem {
  id: string;
  userId: string | null;
  clientId: string | null;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  meta?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientId: string | null;
  avatarInitials: string;
  mustCompleteProfile: boolean;
  projectIds: string[];
  accessAllProjects: boolean;
}

export type NotificationPrefs = {
  emailUpdates: boolean;
  emailReleases: boolean;
  inAppOnly: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  emailUpdates: true,
  emailReleases: true,
  inAppOnly: false,
};

export interface MockStoreState {
  users: User[];
  clients: Client[];
  projects: Project[];
  updates: UpdateItem[];
  releases: Release[];
  tasks: Task[];
  tickets: Ticket[];
  documents: DocumentItem[];
  files: FileItem[];
  notifications: NotificationItem[];
  auditLogs: AuditLog[];
  userPasswords: Record<string, string>;
  notificationPrefs: NotificationPrefs;
  organizationName: string;
  session: SessionUser | null;
  hydrated: boolean;
}

export interface CompleteClientProfileInput {
  userId: string;
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  instagramCompany: string;
  instagramPersonal: string;
}
