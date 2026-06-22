-- =============================================
-- 008: Client enrichment (tags, last-contacted) + lead conversion link
-- All changes are additive and backward-compatible. This migration does NOT
-- depend on 007_notes.sql being applied first.
-- =============================================

-- 1. Client tags (mirrors leads.tag)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tag TEXT;
CREATE INDEX IF NOT EXISTS idx_clients_tag ON clients(tag);

-- 2. Client last-contacted timestamp (nullable; null => fall back to created_at in UI)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_clients_last_contacted ON clients(last_contacted_at);

-- 3. Lead -> client conversion link
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_client_id UUID;

-- 4. Extend the lead status CHECK to include the converted state.
--    Existing allowed values preserved from 001_initial.sql.
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('Yangi', 'Ko''rib chiqilmoqda', 'Kelishildi',
                    'Rad etildi', 'Buyurtma berilgan', 'Mijozga aylandi'));
