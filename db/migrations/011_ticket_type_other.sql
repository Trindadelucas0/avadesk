-- Allow portal type "other" (Outra coisa) alongside existing ticket types.

ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_type_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_type_check
  CHECK (type IN ('bug', 'implementation', 'feature', 'routine', 'other'));
