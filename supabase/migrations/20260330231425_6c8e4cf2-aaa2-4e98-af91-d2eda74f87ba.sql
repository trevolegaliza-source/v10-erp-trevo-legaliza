-- Add storage policies for the contratos bucket to allow authenticated uploads
CREATE POLICY "authenticated_upload_contratos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contratos');

CREATE POLICY "authenticated_update_contratos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'contratos');

CREATE POLICY "authenticated_select_contratos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'contratos');

-- Also add policies for the documentos bucket
CREATE POLICY "authenticated_upload_documentos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "authenticated_update_documentos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos');

CREATE POLICY "authenticated_select_documentos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'documentos');