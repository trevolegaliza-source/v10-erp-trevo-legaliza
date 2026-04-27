-- =============================================
-- ONDA 7 #1 — Storage tenant isolation: limpar resíduos
-- =============================================
-- Contexto:
-- A migration 20260415170615 já criou as policies *_empresa pra contratos e documentos.
-- Mas o estado real do banco (consultado em 2026-04-27) ainda tinha:
--   1. Policy legada "Authenticated users can read documentos" sem tenant check
--      (anula proteção do documentos_select_empresa, permitindo SELECT cross-empresa)
--   2. Bucket contestacoes com policies que só checam bucket_id (sem tenant)
--   3. Bucket contestacoes sem policy DELETE
--
-- Esta migration encerra o capítulo do #1.

-- 1) Remover policy legada que vaza documentos cross-empresa
DROP POLICY IF EXISTS "Authenticated users can read documentos" ON storage.objects;

-- 2) Remover policies frouxas do contestacoes
DROP POLICY IF EXISTS "contestacoes_insert" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_select" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_update" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_delete" ON storage.objects;

-- 3) Recriar contestacoes com tenant isolation (igual padrão contratos/documentos)
CREATE POLICY "contestacoes_select_empresa" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_insert_empresa" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_update_empresa" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_delete_empresa" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);
