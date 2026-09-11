-- Expand 001 without DROP. Relational SoT for Avadesk (hub_state kept until cutover).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_client_role_check;

ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_complete_profile BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_initials TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram_personal TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_all_projects BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'client'));
ALTER TABLE users ADD CONSTRAINT users_client_role_check CHECK (
  (role IN ('admin', 'manager') AND client_id IS NULL)
  OR (role = 'client' AND client_id IS NOT NULL)
);

ALTER TABLE clients ADD COLUMN IF NOT EXISTS segment TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS primary_contact TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS logo_initials TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE projects ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currently_building_title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currently_building_progress_pct INTEGER;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currently_building_owner TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currently_building_eta TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currently_building_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_step_title TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS next_step_due_label TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_client_update_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE projects SET status = CASE
  WHEN status IN ('planning', 'development', 'testing', 'homologation', 'published', 'maintenance', 'paused') THEN status
  WHEN status IN ('em_andamento', 'development') THEN 'development'
  WHEN status IN ('planejado', 'discovery', 'design') THEN 'planning'
  WHEN status IN ('qa', 'testing') THEN 'testing'
  WHEN status IN ('release', 'homologation') THEN 'homologation'
  WHEN status IN ('done', 'published') THEN 'published'
  WHEN status = 'paused' THEN 'paused'
  ELSE 'planning'
END
WHERE status IS NOT NULL;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (
  status IN (
    'planning', 'development', 'testing', 'homologation', 'published', 'maintenance', 'paused',
    'em_andamento', 'planejado', 'discovery', 'design', 'qa', 'release', 'done'
  )
);

ALTER TABLE updates ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
ALTER TABLE updates ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'UPDATE';
ALTER TABLE updates ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS updates_author_idempotency_uidx
  ON updates (author_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_project_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS project_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  system_url TEXT,
  access_user TEXT,
  password_ciphertext TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  organization_name TEXT NOT NULL DEFAULT 'Avadesk',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO app_settings (id, organization_name)
VALUES ('default', 'Avadesk')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  highlights TEXT[] NOT NULL DEFAULT '{}',
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'documentação',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'outro',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  size_label TEXT NOT NULL DEFAULT '',
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_versions_doc_version_uidx
  ON document_versions (document_id, version);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'doing', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_name TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '/client',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL DEFAULT '',
  meta TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'logged')),
  last_error TEXT,
  related_update_id UUID REFERENCES updates(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_last_client_update ON projects(last_client_update_at);
CREATE INDEX IF NOT EXISTS idx_updates_visible ON updates(project_id, visible_to_client, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON email_outbox(status, created_at);
CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_id, released_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- Copy plaintext V1 access_password into encrypted table happens in app migrate-hub-state / seed.
INSERT INTO project_credentials (project_id, system_url, access_user, password_ciphertext)
SELECT p.id, p.system_url, p.access_user, NULL
FROM projects p
WHERE NOT EXISTS (SELECT 1 FROM project_credentials c WHERE c.project_id = p.id);
