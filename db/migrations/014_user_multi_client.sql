-- CLIENT may belong to many companies. users.client_id remains the active/fallback company.

CREATE TABLE IF NOT EXISTS user_client_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  access_all_projects BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_user_client_access_client ON user_client_access (client_id);

INSERT INTO user_client_access (user_id, client_id, access_all_projects)
SELECT id, client_id, COALESCE(access_all_projects, TRUE)
FROM users
WHERE role = 'client' AND client_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION avadesk_users_seed_membership()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.client_id IS NOT NULL THEN
    INSERT INTO user_client_access (user_id, client_id, access_all_projects)
    VALUES (NEW.id, NEW.client_id, COALESCE(NEW.access_all_projects, TRUE))
    ON CONFLICT (user_id, client_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_seed_membership ON users;
CREATE TRIGGER trg_users_seed_membership
AFTER INSERT ON users
FOR EACH ROW
EXECUTE PROCEDURE avadesk_users_seed_membership();
