-- 010: Server-side auth RPCs (no service-role key needed).
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.app_phone_email(p_phone TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE d TEXT;
BEGIN
  d := regexp_replace(COALESCE(p_phone,''), '[^0-9]', '', 'g');
  IF length(d) = 9 THEN d := '998' || d; END IF;
  RETURN 'u' || d || '@sellora.app';
END; $$;

CREATE OR REPLACE FUNCTION public._app_create_auth_user(p_phone TEXT, p_name TEXT, p_password TEXT, p_role TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE d TEXT; v_email TEXT; v_id UUID;
BEGIN
  IF p_password IS NULL OR length(p_password) < 6 THEN RETURN json_build_object('success', false, 'reason', 'invalid'); END IF;
  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN RETURN json_build_object('success', false, 'reason', 'invalid'); END IF;
  d := regexp_replace(COALESCE(p_phone,''), '[^0-9]', '', 'g');
  IF length(d) = 9 THEN d := '998' || d; END IF;
  IF length(d) <> 12 THEN RETURN json_build_object('success', false, 'reason', 'invalid_phone'); END IF;
  v_email := 'u' || d || '@sellora.app';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN RETURN json_build_object('success', false, 'reason', 'exists'); END IF;
  v_id := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), now(), now(), now(),
    jsonb_build_object('provider','email','providers',jsonb_build_array('email'),'role', p_role),
    jsonb_build_object('name', btrim(p_name), 'phone', '+'||d),
    false, false, '', '', '', '', '', '', '', ''
  );
  INSERT INTO auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now());
  UPDATE public.operators SET role = p_role, name = btrim(p_name), phone = '+'||d WHERE id = v_id;
  RETURN json_build_object('success', true, 'id', v_id);
END; $$;
-- Internal only: never callable directly.
REVOKE EXECUTE ON FUNCTION public._app_create_auth_user(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_register_operator(p_phone TEXT, p_name TEXT, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN RETURN public._app_create_auth_user(p_phone, p_name, p_password, 'operator'); END; $$;
GRANT EXECUTE ON FUNCTION public.app_register_operator(TEXT,TEXT,TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_create_operator(p_phone TEXT, p_name TEXT, p_password TEXT, p_role TEXT DEFAULT 'operator')
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
DECLARE v_role TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'reason', 'forbidden'); END IF;
  v_role := CASE WHEN p_role = 'admin' THEN 'admin' ELSE 'operator' END;
  RETURN public._app_create_auth_user(p_phone, p_name, p_password, v_role);
END; $$;
GRANT EXECUTE ON FUNCTION public.app_admin_create_operator(TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- Drop unused legacy auth RPCs (replaced by Supabase Auth + app_* RPCs).
DROP FUNCTION IF EXISTS public.check_login(text, text);
DROP FUNCTION IF EXISTS public.register_operator(text, text, text);
DROP FUNCTION IF EXISTS public.admin_create_operator(text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_reset_password(uuid, text);
