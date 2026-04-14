
-- =============================================
-- SECURITY HARDENING MIGRATION
-- =============================================

-- 1. STORAGE: Make bucket "documentos" private
UPDATE storage.buckets SET public = false WHERE id = 'documentos';

-- Drop OLD public-role policies on storage.objects for documentos bucket
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;
DROP POLICY IF EXISTS "documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_upload" ON storage.objects;

-- The authenticated policies (authenticated_select_documentos, authenticated_update_documentos, authenticated_upload_documentos) already exist and are correct.

-- 2. NOTIFICACOES: Replace anon INSERT policy to require empresa_id
DROP POLICY IF EXISTS "notificacoes_insert_anon" ON public.notificacoes;

CREATE POLICY "notificacoes_insert_anon_restricted"
ON public.notificacoes FOR INSERT
TO anon
WITH CHECK (empresa_id IS NOT NULL);

-- 3. ORCAMENTOS: Remove overly permissive anon UPDATE, replace with restricted version
DROP POLICY IF EXISTS "orcamentos_update_anon" ON public.orcamentos;

CREATE POLICY "orcamentos_update_anon_restricted"
ON public.orcamentos FOR UPDATE
TO anon
USING (share_token IS NOT NULL AND status = 'enviado')
WITH CHECK (share_token IS NOT NULL);

-- 4. CONTATOS_ESTADO: Replace true policies with empresa_id-scoped (add column if missing)
-- Note: contatos_estado doesn't have empresa_id, so these are shared reference data.
-- Keep as authenticated-only (no anon), which is already the case. The "true" condition
-- is acceptable for shared reference data accessible to all authenticated users.
-- No change needed here - already restricted to authenticated role.

-- 5. PRECOS_TIERS: Restrict write to master role only
DROP POLICY IF EXISTS "precos_tiers_update" ON public.precos_tiers;
DROP POLICY IF EXISTS "precos_tiers_write" ON public.precos_tiers;

CREATE POLICY "precos_tiers_update_master"
ON public.precos_tiers FOR UPDATE
TO authenticated
USING (get_user_role() = 'master')
WITH CHECK (get_user_role() = 'master');

CREATE POLICY "precos_tiers_insert_master"
ON public.precos_tiers FOR INSERT
TO authenticated
WITH CHECK (get_user_role() = 'master');

-- 6. REVOKE anon access on sensitive tables
REVOKE INSERT, UPDATE, DELETE ON public.orcamentos FROM anon;
-- Re-grant only UPDATE for the restricted anon policy to work
GRANT UPDATE ON public.orcamentos TO anon;
-- Keep SELECT for anon (public proposals)
GRANT SELECT ON public.orcamentos TO anon;

-- Keep INSERT on notificacoes for anon (public proposal notifications)
GRANT INSERT ON public.notificacoes TO anon;
-- Revoke other operations
REVOKE SELECT, UPDATE, DELETE ON public.notificacoes FROM anon;
