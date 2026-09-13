-- Allow deleting users who authored updates: keep the update, drop the author.
ALTER TABLE updates DROP CONSTRAINT IF EXISTS updates_author_id_fkey;
ALTER TABLE updates ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE updates
  ADD CONSTRAINT updates_author_id_fkey
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL;
