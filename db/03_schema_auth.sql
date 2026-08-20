-- RBAC schema extension: adds auth columns to the existing users table and
-- seeds four demo accounts. All statements are idempotent.

-- ---------------------------------------------------------------------------
-- 1. Add authentication columns to the existing users table.
-- ---------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- ---------------------------------------------------------------------------
-- 2. Seed demo users.  Passwords are all "demo123", bcrypt-hashed.
--    The hash below is: $2b$12$LJ3m4ys2Xt0Mi8/.gg3RKuFqGJCjyHx0IVGt0C4F8TJz1RKQK0Fvy
--    If you regenerate, use: python -c "from passlib.hash import bcrypt; print(bcrypt.hash('demo123'))"
-- ---------------------------------------------------------------------------
INSERT INTO users (email, role, password_hash)
VALUES
  ('admin@stockpilot.io',   'admin',   '$2b$12$LJ3m4ys2Xt0Mi8/.gg3RKuFqGJCjyHx0IVGt0C4F8TJz1RKQK0Fvy'),
  ('planner@stockpilot.io', 'planner', '$2b$12$LJ3m4ys2Xt0Mi8/.gg3RKuFqGJCjyHx0IVGt0C4F8TJz1RKQK0Fvy'),
  ('analyst@stockpilot.io', 'analyst', '$2b$12$LJ3m4ys2Xt0Mi8/.gg3RKuFqGJCjyHx0IVGt0C4F8TJz1RKQK0Fvy'),
  ('viewer@stockpilot.io',  'viewer',  '$2b$12$LJ3m4ys2Xt0Mi8/.gg3RKuFqGJCjyHx0IVGt0C4F8TJz1RKQK0Fvy')
ON CONFLICT (email) DO NOTHING;
