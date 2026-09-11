-- Encrypted .env vault per project (test + production). Plaintext never stored.
CREATE TABLE IF NOT EXISTS project_env_vault (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  environment TEXT NOT NULL CHECK (environment IN ('test', 'production')),
  ciphertext TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (project_id, environment)
);
