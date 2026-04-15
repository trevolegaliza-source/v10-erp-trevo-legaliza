
-- ═══ RESTRICT COLABORADORES SELECT TO MASTER/FINANCEIRO ═══
DROP POLICY IF EXISTS "colaboradores_select" ON colaboradores;

CREATE POLICY "colaboradores_select"
ON colaboradores FOR SELECT
TO authenticated
USING (
  empresa_id = get_empresa_id()
  AND get_user_role() IN ('master', 'financeiro')
);

-- ═══ RESTRICT PROFILES SELECT — own record OR master sees all ═══
DROP POLICY IF EXISTS "profiles_select_empresa" ON profiles;

CREATE POLICY "profiles_select_empresa"
ON profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR (empresa_id = get_empresa_id() AND get_user_role() = 'master')
);
