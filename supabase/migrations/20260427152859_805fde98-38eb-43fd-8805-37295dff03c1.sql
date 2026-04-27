CREATE OR REPLACE FUNCTION public._switch_fk_to_restrict(
  p_table TEXT,
  p_column TEXT,
  p_ref_table TEXT,
  p_ref_column TEXT DEFAULT 'id'
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_conname TEXT;
  v_new_conname TEXT;
BEGIN
  SELECT con.conname INTO v_conname
  FROM pg_constraint con
  JOIN pg_class src ON src.oid = con.conrelid
  JOIN pg_namespace ns ON ns.oid = src.relnamespace
  JOIN pg_class tgt ON tgt.oid = con.confrelid
  JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = ANY(con.conkey)
  WHERE ns.nspname = 'public'
    AND src.relname = p_table
    AND tgt.relname = p_ref_table
    AND att.attname = p_column
    AND con.contype = 'f'
  LIMIT 1;

  IF v_conname IS NULL THEN
    RAISE NOTICE 'FK não encontrada: %.% → %.%, pulando',
      p_table, p_column, p_ref_table, p_ref_column;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = v_conname AND confdeltype IN ('r', 'a')
  ) THEN
    RAISE NOTICE 'FK % já está RESTRICT/NO ACTION, pulando', v_conname;
    RETURN;
  END IF;

  v_new_conname := p_table || '_' || p_column || '_fkey';

  EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                 p_table, v_conname);
  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) '
    'REFERENCES public.%I(%I) ON DELETE RESTRICT',
    p_table, v_new_conname, p_column, p_ref_table, p_ref_column
  );

  RAISE NOTICE 'FK %.% → %.% trocada para RESTRICT (% → %)',
    p_table, p_column, p_ref_table, p_ref_column, v_conname, v_new_conname;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'Tabela % ou % não existe, pulando', p_table, p_ref_table;
  WHEN undefined_column THEN
    RAISE NOTICE 'Coluna % em % não existe, pulando', p_column, p_table;
END;
$$;

SELECT public._switch_fk_to_restrict('lancamentos', 'cliente_id', 'clientes');
SELECT public._switch_fk_to_restrict('lancamentos', 'processo_id', 'processos');
SELECT public._switch_fk_to_restrict('cobrancas', 'cliente_id', 'clientes');
SELECT public._switch_fk_to_restrict('processos', 'cliente_id', 'clientes');
SELECT public._switch_fk_to_restrict('documentos', 'processo_id', 'processos');
SELECT public._switch_fk_to_restrict('valores_adicionais', 'processo_id', 'processos');
SELECT public._switch_fk_to_restrict('orcamentos', 'cliente_id', 'clientes');

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cobrancas_active
  ON public.cobrancas (empresa_id, created_at DESC)
  WHERE is_archived = FALSE OR is_archived IS NULL;
CREATE INDEX IF NOT EXISTS idx_orcamentos_active
  ON public.orcamentos (empresa_id, created_at DESC)
  WHERE is_archived = FALSE OR is_archived IS NULL;

CREATE OR REPLACE FUNCTION public.arquivar_cliente(p_cliente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_empresa UUID;
  v_cli_empresa UUID;
BEGIN
  SELECT role, empresa_id INTO v_role, v_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'Permissão negada para arquivar cliente'
      USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_cli_empresa
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_cli_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_cli_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.clientes
  SET is_archived = TRUE, updated_at = NOW()
  WHERE id = p_cliente_id;

  UPDATE public.processos
  SET is_archived = TRUE, updated_at = NOW()
  WHERE cliente_id = p_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.arquivar_cliente(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.desarquivar_cliente(p_cliente_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_empresa UUID;
  v_cli_empresa UUID;
BEGIN
  SELECT role, empresa_id INTO v_role, v_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'Permissão negada' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_cli_empresa
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_cli_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_cli_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.clientes
  SET is_archived = FALSE, updated_at = NOW()
  WHERE id = p_cliente_id;

  UPDATE public.processos
  SET is_archived = FALSE, updated_at = NOW()
  WHERE cliente_id = p_cliente_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.desarquivar_cliente(UUID) TO authenticated;

DROP FUNCTION public._switch_fk_to_restrict(TEXT, TEXT, TEXT, TEXT);