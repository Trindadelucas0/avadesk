-- Display name for custom file categories (system rows stay NULL)
ALTER TABLE files ADD COLUMN IF NOT EXISTS category_label TEXT;
