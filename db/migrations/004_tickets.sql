-- Client-facing tickets (separate from internal Kanban tasks).

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('bug', 'implementation', 'feature', 'routine')),
  title TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '{}',
  stage TEXT NOT NULL DEFAULT 'fix' CHECK (stage IN ('fix', 'production', 'resolved', 'closed')),
  origin TEXT NOT NULL DEFAULT 'portal' CHECK (origin IN ('portal', 'admin_report')),
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  client_confirmed_at TIMESTAMPTZ,
  client_confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  from_stage TEXT CHECK (
    from_stage IS NULL OR from_stage IN ('fix', 'production', 'resolved', 'closed')
  ),
  to_stage TEXT NOT NULL CHECK (to_stage IN ('fix', 'production', 'resolved', 'closed')),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_project_created
  ON tickets (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tickets_stage
  ON tickets (stage);

CREATE INDEX IF NOT EXISTS idx_ticket_events_ticket
  ON ticket_events (ticket_id, created_at);
