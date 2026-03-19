-- Garantir bucket de contratos existente para todo o sistema
INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

-- Permissões de leitura para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contratos_authenticated_select'
  ) THEN
    CREATE POLICY "contratos_authenticated_select"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'contratos');
  END IF;
END
$$;

-- Permissões de upload para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contratos_authenticated_insert'
  ) THEN
    CREATE POLICY "contratos_authenticated_insert"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'contratos');
  END IF;
END
$$;

-- Permissões de atualização para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contratos_authenticated_update'
  ) THEN
    CREATE POLICY "contratos_authenticated_update"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'contratos')
    WITH CHECK (bucket_id = 'contratos');
  END IF;
END
$$;

-- Permissões de exclusão para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'contratos_authenticated_delete'
  ) THEN
    CREATE POLICY "contratos_authenticated_delete"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (bucket_id = 'contratos');
  END IF;
END
$$;