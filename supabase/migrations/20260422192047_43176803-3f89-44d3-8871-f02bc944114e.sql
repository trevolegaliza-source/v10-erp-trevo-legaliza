-- Cobrança Pública: expor comprovantes de taxas + comprovante do lançamento
DROP FUNCTION IF EXISTS public.get_cobranca_por_token(text);

CREATE OR REPLACE FUNCTION public.get_cobranca_por_token(p_token text)
 RETURNS TABLE(
   id uuid,
   cliente_nome text,
   cliente_apelido text,
   cliente_cnpj text,
   cliente_nome_contador text,
   total_honorarios numeric,
   total_taxas numeric,
   total_geral numeric,
   data_vencimento date,
   status text,
   created_at timestamp with time zone,
   lancamentos jsonb,
   empresa_config jsonb,
   asaas jsonb
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    cb.id, cl.nome, cl.apelido, cl.cnpj, cl.nome_contador,
    cb.total_honorarios, cb.total_taxas, cb.total_geral,
    cb.data_vencimento, cb.status, cb.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'descricao', l.descricao,
        'valor', l.valor,
        'comprovante_url', l.comprovante_url,
        'razao_social', p.razao_social,
        'tipo_processo', p.tipo,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor,
            'categoria', va.descricao,
            'comprovante_url', va.comprovante_url
          ))
          FROM public.valores_adicionais va WHERE va.processo_id = p.id
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
$function$;