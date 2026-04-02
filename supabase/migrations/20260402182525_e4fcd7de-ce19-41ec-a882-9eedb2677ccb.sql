
-- 1. Create get_user_role() helper function
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- 2. Fix profiles policies: allow seeing all profiles in same empresa
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;

CREATE POLICY "profiles_select_empresa" ON public.profiles
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "profiles_insert_trigger" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_role" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'master' AND empresa_id = get_empresa_id()
    OR id = auth.uid()
  )
  WITH CHECK (
    get_user_role() = 'master' AND empresa_id = get_empresa_id()
    OR id = auth.uid()
  );

-- 3. Restrict lancamentos by role
DROP POLICY IF EXISTS "lancamentos_insert" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_update" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_delete" ON public.lancamentos;

CREATE POLICY "lancamentos_insert_role" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND (
      get_user_role() IN ('master', 'financeiro')
      OR tipo = 'receber'
    )
  );

CREATE POLICY "lancamentos_update_role" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  );

CREATE POLICY "lancamentos_delete_role" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id()
    AND get_user_role() = 'master'
  );

-- 4. Restrict user_permissions modifications to master only
DROP POLICY IF EXISTS "permissions_insert_by_empresa" ON public.user_permissions;
DROP POLICY IF EXISTS "permissions_update_by_empresa" ON public.user_permissions;
DROP POLICY IF EXISTS "permissions_delete_by_empresa" ON public.user_permissions;

CREATE POLICY "permissions_insert_master" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND get_user_role() = 'master'
  );

CREATE POLICY "permissions_update_master" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (
    empresa_id = get_user_empresa_id()
    AND get_user_role() = 'master'
  )
  WITH CHECK (
    empresa_id = get_user_empresa_id()
    AND get_user_role() = 'master'
  );

CREATE POLICY "permissions_delete_master" ON public.user_permissions
  FOR DELETE TO authenticated
  USING (
    empresa_id = get_user_empresa_id()
    AND get_user_role() = 'master'
  );
