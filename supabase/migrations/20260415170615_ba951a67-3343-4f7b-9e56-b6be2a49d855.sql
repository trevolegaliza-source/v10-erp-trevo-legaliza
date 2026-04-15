
-- Drop all existing storage policies for contratos and documentos
DROP POLICY IF EXISTS "authenticated_select_contratos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_documentos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_contratos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_documentos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_contratos" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_upload_documentos" ON storage.objects;
DROP POLICY IF EXISTS "contratos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "contratos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "contratos_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "contratos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_upload" ON storage.objects;
DROP POLICY IF EXISTS "documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;

-- Contratos bucket: empresa-scoped policies
CREATE POLICY "contratos_select_empresa" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contratos_insert_empresa" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'contratos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contratos_update_empresa" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "contratos_delete_empresa" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'contratos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

-- Documentos bucket: empresa-scoped policies
CREATE POLICY "documentos_select_empresa" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "documentos_insert_empresa" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documentos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "documentos_update_empresa" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = get_empresa_id()::text);

CREATE POLICY "documentos_delete_empresa" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documentos' AND (storage.foldername(name))[1] = get_empresa_id()::text);
