DROP POLICY IF EXISTS "notificacoes_select" ON notificacoes;
CREATE POLICY "notificacoes_select" ON notificacoes 
  FOR SELECT TO authenticated 
  USING (empresa_id = get_empresa_id() OR empresa_id IS NULL);