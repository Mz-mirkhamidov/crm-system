-- 013: "Forgot password" -> admin-approved reset.
ALTER TABLE public.operators
  ADD COLUMN IF NOT EXISTS reset_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reset_requested_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.app_request_password_reset(p_phone TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.operators SET reset_requested = true, reset_requested_at = now()
  WHERE public.app_phone_email(phone) = public.app_phone_email(p_phone);
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.app_request_password_reset(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_reset_password(p_id UUID, p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'reason', 'forbidden'); END IF;
  IF p_password IS NULL OR length(p_password) < 6 THEN RETURN json_build_object('success', false, 'reason', 'weak'); END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_id) THEN RETURN json_build_object('success', false, 'reason', 'not_found'); END IF;
  UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() WHERE id = p_id;
  UPDATE public.operators SET must_change_password = true, reset_requested = false, reset_requested_at = NULL WHERE id = p_id;
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.app_admin_reset_password(UUID, TEXT) TO authenticated;
