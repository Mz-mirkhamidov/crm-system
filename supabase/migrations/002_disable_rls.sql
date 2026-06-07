-- =============================================
-- Supabase Auth ishlatilmaydi — RLS o'chiriladi
-- Anon key orqali to'g'ridan barcha operatsiyalar
-- =============================================

ALTER TABLE leads      DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients    DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders     DISABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups DISABLE ROW LEVEL SECURITY;

-- Anon role ga to'liq huquq berish
GRANT ALL ON leads      TO anon;
GRANT ALL ON clients    TO anon;
GRANT ALL ON orders     TO anon;
GRANT ALL ON follow_ups TO anon;

-- Sequence permissions (INSERT uchun kerak)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
