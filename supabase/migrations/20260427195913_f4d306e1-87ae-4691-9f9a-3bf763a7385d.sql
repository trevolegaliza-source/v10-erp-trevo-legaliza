-- ONDA 7 #1 — Storage tenant isolation: limpar resíduos
DROP POLICY IF EXISTS "Authenticated users can read documentos" ON storage.objects;

DROP POLICY IF EXISTS "contestacoes_insert" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_select" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_update" ON storage.objects;
DROP POLICY IF EXISTS "contestacoes_delete" ON storage.objects;

CREATE POLICY "contestacoes_select_empresa" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_insert_empresa" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_update_empresa" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contestacoes_delete_empresa" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contestacoes' AND (storage.foldername(name))[1] = get_empresa_id()::text);