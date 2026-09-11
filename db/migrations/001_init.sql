-- NEXUS Client Portal — initial schema (4 tables only)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT NOT NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'client')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT users_client_role_check CHECK (
    (role = 'admin' AND client_id IS NULL) OR
    (role = 'client' AND client_id IS NOT NULL)
  )
);

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct >= 0 AND progress_pct <= 100),
  system_url TEXT,
  access_user TEXT,
  access_password TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('planejado', 'em_andamento', 'concluido')),
  visible_to_client BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_client_id ON users(client_id);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_updated_at ON projects(updated_at);
CREATE INDEX idx_updates_project_id ON updates(project_id);
CREATE INDEX idx_updates_created_at ON updates(created_at DESC);
