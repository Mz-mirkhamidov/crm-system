-- 009: Supabase Auth bridge. Keep `operators` as the profile table; auth.users.id === operators.id.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.operators (id, phone, name, role, status, is_active, password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name',''), 'Foydalanuvchi'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'operator'),
    'active', true, 'supabase_auth'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- NOTE: existing 8 operators were backfilled into auth.users + auth.identities (id-preserved)
-- as a one-time data migration (already applied in production).
