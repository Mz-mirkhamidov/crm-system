-- =============================================
-- 007: Notes / activity timeline (generic, lead + client)
-- Mirrors the access posture of 002/003: RLS disabled, anon GRANT,
-- updated_at trigger. RLS hardening tracked separately (out of scope).
-- =============================================

CREATE TABLE IF NOT EXISTS notes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,                 -- operator scope (SCOPE_COLUMN), matches existing tables
  operator_id  UUID,                          -- mirror of user_id (003 convention)
  source_type  TEXT NOT NULL CHECK (source_type IN ('lead', 'client')),
  source_id    UUID NOT NULL,
  body         TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Access posture identical to existing data tables (see 002_disable_rls.sql).
-- NOTE: user_id intentionally has NO auth.users FK — the running app stores the
-- operator id (operators.id) in user_id under the current operator-scoping model.
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
GRANT ALL ON notes TO anon;

-- Indexes mirror orders' source/scope indexes.
CREATE INDEX IF NOT EXISTS idx_notes_user_id  ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_source   ON notes(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_notes_created  ON notes(created_at);

-- Reuse the shared trigger function from 001_initial.sql.
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
