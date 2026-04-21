DROP FUNCTION IF EXISTS public.get_cobranca_por_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_cobranca_por_token(p_token TEXT)
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
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor
          )) FROM public.valores_adicionais va WHERE va.processo_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.razao_social)
      FROM public.lancamentos l
      LEFT JOIN public.processos p ON p.id = l.processo_id
      WHERE l.id = ANY(cb.lancamento_ids)
    ), '[]'::jsonb) as lancamentos,
    jsonb_build_object(
      'nome', 'TREVO LEGALIZA LTDA',
      'cnpj', '39.969.412/0001-70',
      'pix_chave', '39.969.412/0001-70',
      'pix_banco', 'C6 Bank',
      'whatsapp', '5511934927001',
      'site', 'trevolegaliza.com.br'
    ) as empresa_config,
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
    AND cb.status IN ('ativa', 'vencida', 'paga');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cobranca_por_token(TEXT) TO anon, authenticated;