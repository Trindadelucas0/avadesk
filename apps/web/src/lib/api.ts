/**
 * Browser calls go through same-origin `/backend` (Next rewrite → API)
 * so the session cookie is set/read on :3000 (middleware + fetch).
 * Server-side / tooling can still use the absolute API URL.
 */
function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    return "/backend";
  }
  return (
    process.env.API_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

export type Role = "admin" | "client";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  client_id: string | null;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  status: string;
  progress_pct: number;
  system_url: string | null;
  access_user: string | null;
  access_password?: string | null;
  updated_at: string;
  client_name?: string;
  company?: string;
  last_update_content?: string | null;
  last_update_at?: string | null;
  is_stale?: boolean;
  days_since_update?: number;
}

export interface UpdateItem {
  id: string;
  project_id: string;
  author_id: string;
  content: string;
  status: "planejado" | "em_andamento" | "concluido";
  visible_to_client: boolean;
  created_at: string;
  author_email?: string;
}

type ApiError = { error?: { message?: string; code?: string } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & ApiError;
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Erro ${res.status}`);
  }
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  adminProjects: () => request<{ projects: Project[] }>("/projects"),
  clientProjects: () => request<{ projects: Project[] }>("/projects/mine"),
  project: (id: string) => request<{ project: Project }>(`/projects/${id}`),
  updates: (projectId: string) =>
    request<{ updates: UpdateItem[] }>(`/updates/project/${projectId}`),
  createUpdate: (payload: {
    project_id: string;
    content: string;
    status: "planejado" | "em_andamento" | "concluido";
    visible_to_client: boolean;
  }) =>
    request<{ update: UpdateItem }>("/updates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { resolveApiBase as API_URL };
