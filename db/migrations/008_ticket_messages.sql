-- Pedido de informação no chamado: conversa + pendência "Aguardando resposta [nome]".
-- Overlay em tickets, não é nova etapa do pipeline.

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS awaiting_reply_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_awaiting_reply
  ON tickets (awaiting_reply_from_user_id)
  WHERE awaiting_reply_from_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('request', 'reply')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket
  ON ticket_messages (ticket_id, created_at);
