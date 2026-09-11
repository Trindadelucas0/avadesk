export type Role = "admin" | "manager" | "client";

export type UpdateStatus = "planejado" | "em_andamento" | "concluido";

export type ProjectStatus =
  | "planning"
  | "development"
  | "testing"
  | "homologation"
  | "published"
  | "maintenance"
  | "paused";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  client_id: string | null;
  name: string;
  must_complete_profile: boolean;
  access_all_projects: boolean;
  active: boolean;
  avatar_initials: string | null;
  instagram_company: string | null;
  instagram_personal: string | null;
}

export interface ClientRow {
  id: string;
  name: string;
  company: string;
}

export interface ProjectRow {
  id: string;
  client_id: string;
  name: string;
  status: string;
  progress_pct: number;
  system_url: string | null;
  access_user: string | null;
  access_password: string | null;
  updated_at: Date;
  client_name?: string;
  company?: string;
  last_update_at?: Date | null;
  last_update_content?: string | null;
}

export interface UpdateRow {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  status: UpdateStatus;
  visible_to_client: boolean;
  created_at: Date;
  author_email?: string;
  title?: string;
}
