
-- Revert profiles SELECT — all roles need to see team members
DROP POLICY IF EXISTS "profiles_select_empresa" ON profiles;

CREATE POLICY "profiles_select_empresa"
ON profiles FOR SELECT
TO authenticated
USING (empresa_id = get_empresa_id());
