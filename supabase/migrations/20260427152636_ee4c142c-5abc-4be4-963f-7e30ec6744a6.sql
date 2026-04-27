CREATE OR REPLACE FUNCTION public._safe_create_index(
  p_index_name TEXT,
  p_table TEXT,
  p_columns TEXT,
  p_where TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_sql TEXT;
BEGIN
  v_sql := format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)%s',
    p_index_name,
    p_table,
    p_columns,
    CASE WHEN p_where IS NOT NULL THEN ' WHERE ' || p_where ELSE '' END
  );
  EXECUTE v_sql;
EXCEPTION
  WHEN undefined_column THEN
    RAISE NOTICE 'Índice % pulado: coluna inexistente em %', p_index_name, p_table;
  WHEN undefined_table THEN
    RAISE NOTICE 'Índice % pulado: tabela % inexistente', p_index_name, p_table;
END;
$$;

SELECT public._safe_create_index('idx_processos_cliente_id', 'processos', 'cliente_id');
SELECT public._safe_create_index('idx_processos_empresa_id', 'processos', 'empresa_id');

SELECT public._safe_create_index('idx_lancamentos_cliente_id', 'lancamentos', 'cliente_id');
SELECT public._safe_create_index('idx_lancamentos_processo_id', 'lancamentos', 'processo_id');
SELECT public._safe_create_index('idx_lancamentos_colaborador_id', 'lancamentos', 'colaborador_id');
SELECT public._safe_create_index('idx_lancamentos_extrato_id', 'lancamentos', 'extrato_id');
SELECT public._safe_create_index('idx_lancamentos_conta_id', 'lancamentos', 'conta_id');
SELECT public._safe_create_index('idx_lancamentos_empresa_id', 'lancamentos', 'empresa_id');
SELECT public._safe_create_index('idx_lancamentos_data_pagamento', 'lancamentos', 'data_pagamento DESC', 'data_pagamento IS NOT NULL');
SELECT public._safe_create_index('idx_lancamentos_status_etapa', 'lancamentos', 'status, etapa_financeiro');

SELECT public._safe_create_index('idx_documentos_processo_id', 'documentos', 'processo_id');

SELECT public._safe_create_index('idx_valores_adicionais_processo_id', 'valores_adicionais', 'processo_id');

SELECT public._safe_create_index('idx_cobrancas_cliente_id', 'cobrancas', 'cliente_id');
SELECT public._safe_create_index('idx_cobrancas_empresa_id', 'cobrancas', 'empresa_id');
SELECT public._safe_create_index('idx_cobrancas_share_token', 'cobrancas', 'share_token', 'share_token IS NOT NULL');
SELECT public._safe_create_index('idx_cobrancas_asaas_payment_id', 'cobrancas', 'asaas_payment_id', 'asaas_payment_id IS NOT NULL');
SELECT public._safe_create_index('idx_cobrancas_status_data', 'cobrancas', 'status, data_vencimento');

SELECT public._safe_create_index('idx_orcamentos_cliente_id', 'orcamentos', 'cliente_id');
SELECT public._safe_create_index('idx_orcamentos_empresa_id', 'orcamentos', 'empresa_id');
SELECT public._safe_create_index('idx_orcamentos_share_token', 'orcamentos', 'share_token', 'share_token IS NOT NULL');
SELECT public._safe_create_index('idx_orcamentos_status', 'orcamentos', 'status');

SELECT public._safe_create_index('idx_clientes_empresa_id', 'clientes', 'empresa_id');
SELECT public._safe_create_index('idx_clientes_asaas_customer_id', 'clientes', 'asaas_customer_id', 'asaas_customer_id IS NOT NULL');

SELECT public._safe_create_index('idx_profiles_empresa_id', 'profiles', 'empresa_id');
SELECT public._safe_create_index('idx_profiles_role', 'profiles', 'role');

SELECT public._safe_create_index('idx_colaboradores_empresa_id', 'colaboradores', 'empresa_id');

SELECT public._safe_create_index('idx_notificacoes_empresa_lido', 'notificacoes', 'empresa_id, lido, created_at DESC');

SELECT public._safe_create_index('idx_user_permissions_user_id', 'user_permissions', 'user_id');

DROP FUNCTION public._safe_create_index(TEXT, TEXT, TEXT, TEXT);