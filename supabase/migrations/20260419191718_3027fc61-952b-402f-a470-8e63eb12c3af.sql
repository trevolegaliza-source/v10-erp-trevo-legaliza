CREATE POLICY "Authenticated users can read documentos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documentos');