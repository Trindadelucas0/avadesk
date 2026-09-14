-- Soft-delete chamados: staff oculta o registro; histórico e anexos permanecem.

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tickets_alive_idx ON tickets (id) WHERE deleted_at IS NULL;
