-- 012: Enable Row Level Security. Each user sees own rows (user_id = auth.uid()); admins see all.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.operators WHERE id = auth.uid() AND role = 'admin' AND is_active);
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['leads','clients','orders','follow_ups','notes'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());', t, t);
    EXECUTE format('CREATE POLICY %I_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR public.is_admin());', t, t);
    EXECUTE format('CREATE POLICY %I_update ON public.%I FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin()) WITH CHECK (user_id = auth.uid() OR public.is_admin());', t, t);
    EXECUTE format('CREATE POLICY %I_delete ON public.%I FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());', t, t);
  END LOOP;
END $$;

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS operators_select ON public.operators;
DROP POLICY IF EXISTS operators_update_self ON public.operators;
CREATE POLICY operators_select ON public.operators FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY operators_update_self ON public.operators FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
