-- 011: First-login forced password setup + admin operator management RPCs.
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
-- (existing temp-password accounts were flagged true as a one-time migration)

CREATE OR REPLACE FUNCTION public.app_admin_delete_operator(p_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'reason', 'forbidden'); END IF;
  IF p_id = auth.uid() THEN RETURN json_build_object('success', false, 'reason', 'self'); END IF;
  DELETE FROM auth.identities WHERE user_id = p_id;
  DELETE FROM public.operators WHERE id = p_id;
  DELETE FROM auth.users WHERE id = p_id;
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.app_admin_delete_operator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.app_admin_set_block(p_id UUID, p_blocked BOOLEAN)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', false, 'reason', 'forbidden'); END IF;
  IF p_id = auth.uid() THEN RETURN json_build_object('success', false, 'reason', 'self'); END IF;
  UPDATE public.operators SET is_active = NOT p_blocked,
    status = CASE WHEN p_blocked THEN 'blocked' ELSE 'active' END WHERE id = p_id;
  RETURN json_build_object('success', true);
END; $$;
GRANT EXECUTE ON FUNCTION public.app_admin_set_block(UUID, BOOLEAN) TO authenticated;
