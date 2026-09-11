-- Ficha comercial do cliente (contato obrigatório na API; colunas nullable para registros antigos)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS cnpj TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_cnpj_unique
  ON clients (cnpj)
  WHERE cnpj IS NOT NULL AND btrim(cnpj) <> '';
