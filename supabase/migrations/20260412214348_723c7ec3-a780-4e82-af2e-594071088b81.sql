-- Allow master to delete profiles from same empresa
CREATE POLICY "profiles_delete_master" ON public.profiles
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');
