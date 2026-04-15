
-- Fix 2: lancamentos INSERT - restrict to master/financeiro only
DROP POLICY IF EXISTS "lancamentos_insert_role" ON public.lancamentos;
CREATE POLICY "lancamentos_insert_role" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  );
