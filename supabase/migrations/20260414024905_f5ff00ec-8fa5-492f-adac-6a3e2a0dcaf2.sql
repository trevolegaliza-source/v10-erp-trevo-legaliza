
-- Fix contatos_estado: shared reference data, restrict writes to authenticated (keep true for SELECT is fine per linter)
DROP POLICY IF EXISTS "contatos_estado_delete" ON public.contatos_estado;
DROP POLICY IF EXISTS "contatos_estado_insert" ON public.contatos_estado;
DROP POLICY IF EXISTS "contatos_estado_update" ON public.contatos_estado;

CREATE POLICY "contatos_estado_insert_auth"
ON public.contatos_estado FOR INSERT
TO authenticated
WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "contatos_estado_update_auth"
ON public.contatos_estado FOR UPDATE
TO authenticated
USING (get_user_role() IN ('master', 'financeiro'))
WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "contatos_estado_delete_auth"
ON public.contatos_estado FOR DELETE
TO authenticated
USING (get_user_role() = 'master');

-- Fix notas_estado: shared reference data, restrict writes
DROP POLICY IF EXISTS "notas_estado_insert" ON public.notas_estado;
DROP POLICY IF EXISTS "notas_estado_update" ON public.notas_estado;

CREATE POLICY "notas_estado_insert_auth"
ON public.notas_estado FOR INSERT
TO authenticated
WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "notas_estado_update_auth"
ON public.notas_estado FOR UPDATE
TO authenticated
USING (get_user_role() IN ('master', 'financeiro'))
WITH CHECK (get_user_role() IN ('master', 'financeiro'));

-- Fix proposta_eventos: restrict anon insert to require orcamento_id
DROP POLICY IF EXISTS "proposta_eventos_insert_anon" ON public.proposta_eventos;

CREATE POLICY "proposta_eventos_insert_anon_restricted"
ON public.proposta_eventos FOR INSERT
TO anon
WITH CHECK (orcamento_id IS NOT NULL);
