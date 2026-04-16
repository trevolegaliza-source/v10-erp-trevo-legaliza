
INSERT INTO storage.buckets (id, name, public)
VALUES ('contestacoes', 'contestacoes', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "contestacoes_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'contestacoes');
CREATE POLICY "contestacoes_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contestacoes');
CREATE POLICY "contestacoes_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'contestacoes');
