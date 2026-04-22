-- =============================================
-- Hotfixes pós-auditoria 22/04/2026 noite
-- =============================================
-- Auditoria thorough dos commits do dia revelou bugs reais que
-- precisam fix antes de virar dor de cabeça.
--
-- FIX 1 (CRÍTICO): get_cobranca_por_token mapeia categoria errada
--   Lovable colou `'categoria', va.descricao` em vez de
--   `'categoria', va.categoria`. Frontend recebe a descrição da
--   taxa onde devia receber a categoria (taxa_balcao,
--   honorario_metodo_trevo, etc). Quebra toda lógica de filtro
--   por categoria + bloqueio anti-prejuízo no front.
--
-- FIX 2 (ALTO): _auditoria_gravar grava log com empresa_id NULL
--   Se cobranca/lancamento órfão tiver empresa_id NULL, o audit
--   trail vira inacessível porque RLS exige
--   empresa_id = get_empresa_id(). Master nunca vê.
--   Solução: skip silencioso se empresa_id NULL (log fica
--   inalcançável, mas não polui nem quebra fluxo).
--
-- FIX 3 (MÉDIO): _empresas_config_touch_updated_at sem search_path
--   Defesa em profundidade — adicionar SET search_path = public
--   pra evitar shadowing de NOW() em schema malicioso.
-- =============================================

-- ---------------------------------------------
-- FIX 1: get_cobranca_por_token com categoria correta
-- ---------------------------------------------
DROP FUNCTION IF EXISTS public.get_cobranca_por_token(TEXT);

CREATE FUNCTION public.get_cobranca_por_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  cliente_nome TEXT,
  cliente_apelido TEXT,
  cliente_cnpj TEXT,
  cliente_nome_contador TEXT,
  total_honorarios NUMERIC,
  total_taxas NUMERIC,
  total_geral NUMERIC,
  data_vencimento DATE,
  status TEXT,
  created_at TIMESTAMPTZ,
  lancamentos JSONB,
  empresa_config JSONB,
  asaas JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cb.id,
    cl.nome,
    cl.apelido,
    cl.cnpj,
    cl.nome_contador,
    cb.total_honorarios,
    cb.total_taxas,
    cb.total_geral,
    cb.data_vencimento,
    cb.status,
    cb.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'descricao', l.descricao,
        'valor', l.valor,
        'razao_social', p.razao_social,
        'tipo_processo', p.tipo,
        'comprovante_url', l.comprovante_url,
        'observacoes_processo', p.notas,
        'observacoes_financeiro', l.observacoes_financeiro,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor,
            -- FIX 1: era va.descricao (BUG do Lovable). Correto é va.categoria.
            -- Categoria é taxonomia interna (taxa_balcao, honorario_metodo_trevo,
            -- dare_junta, outra). Frontend usa pra filtrar/agrupar visualmente.
            'categoria', va.categoria,
            'comprovante_url', va.comprovante_url
          )) FROM public.valores_adicionais va WHERE va.processo_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.razao_social)
      FROM public.lancamentos l
      LEFT JOIN public.processos p ON p.id = l.processo_id
      WHERE l.id = ANY(cb.lancamento_ids)
    ), '[]'::jsonb) as lancamentos,
    public.resolve_empresa_config(cb.empresa_id) as empresa_config,
    CASE
      WHEN cb.asaas_payment_id IS NOT NULL THEN
        jsonb_build_object(
          'payment_id', cb.asaas_payment_id,
          'status', cb.asaas_status,
          'invoice_url', cb.asaas_invoice_url,
          'boleto_url', cb.asaas_boleto_url,
          'boleto_barcode', cb.asaas_boleto_barcode,
          'pix_qrcode', cb.asaas_pix_qrcode,
          'pix_payload', cb.asaas_pix_payload,
          'gerado_em', cb.asaas_gerado_em,
          'pago_em', cb.asaas_pago_em
        )
      ELSE NULL
    END as asaas
  FROM public.cobrancas cb
  JOIN public.clientes cl ON cl.id = cb.cliente_id
  WHERE cb.share_token = p_token
    AND cb.status IN ('ativa', 'vencida', 'paga')
    AND (cb.data_expiracao IS NULL OR cb.data_expiracao > NOW());
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cobranca_por_token(TEXT) TO anon, authenticated;

-- ---------------------------------------------
-- FIX 2: _auditoria_gravar skip silencioso se empresa_id NULL
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._auditoria_gravar(
  p_empresa_id   UUID,
  p_entidade     TEXT,
  p_entidade_id  UUID,
  p_campo        TEXT,
  p_valor_antigo JSONB,
  p_valor_novo   JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  -- FIX 2: skip se empresa_id NULL. RLS de financeiro_auditoria
  -- exige empresa_id = get_empresa_id() pra leitura. Linhas com
  -- empresa_id NULL ficam inalcançáveis (poluem tabela sem servir
  -- a ninguém). Melhor não gravar.
  IF p_empresa_id IS NULL THEN
    RETURN;
  END IF;

  -- Deduplica no-ops
  IF p_valor_antigo IS NOT DISTINCT FROM p_valor_novo THEN
    RETURN;
  END IF;

  BEGIN
    v_role := public.get_user_role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  INSERT INTO public.financeiro_auditoria (
    empresa_id, entidade, entidade_id, campo,
    valor_antigo, valor_novo,
    ator_tipo, ator_id, ator_role
  ) VALUES (
    p_empresa_id, p_entidade, p_entidade_id, p_campo,
    p_valor_antigo, p_valor_novo,
    CASE WHEN v_uid IS NULL THEN 'system' ELSE 'user' END,
    v_uid, v_role
  );
END;
$$;

-- ---------------------------------------------
-- FIX 3: _empresas_config_touch_updated_at com search_path
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._empresas_config_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public  -- FIX 3: defesa em profundidade
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
