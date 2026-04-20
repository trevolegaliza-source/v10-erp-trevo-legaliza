-- 1. CLIENTES
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_clientes_asaas_customer
  ON public.clientes(asaas_customer_id)
  WHERE asaas_customer_id IS NOT NULL;

-- 2. COBRANCAS
ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS asaas_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS asaas_status TEXT,
  ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_boleto_url TEXT,
  ADD COLUMN IF NOT EXISTS asaas_boleto_barcode TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_qrcode TEXT,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload TEXT,
  ADD COLUMN IF NOT EXISTS asaas_gerado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asaas_pago_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asaas_last_event JSONB,
  ADD COLUMN IF NOT EXISTS asaas_webhook_recebido_em TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cobrancas_asaas_payment
  ON public.cobrancas(asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

-- 3. WEBHOOK EVENTS
CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  event_type TEXT,
  asaas_payment_id TEXT,
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  processed BOOLEAN DEFAULT false,
  payload JSONB,
  error TEXT,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_webhook_event_id
  ON public.asaas_webhook_events(event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asaas_webhook_payment
  ON public.asaas_webhook_events(asaas_payment_id);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "asaas_events_master_read" ON public.asaas_webhook_events;
CREATE POLICY "asaas_events_master_read" ON public.asaas_webhook_events
  FOR SELECT TO authenticated
  USING (public.get_user_role() = 'master');

-- 4. RPC pública (drop antes pra mudar return type)
DROP FUNCTION IF EXISTS public.get_cobranca_por_token(TEXT);

CREATE OR REPLACE FUNCTION public.get_cobranca_por_token(p_token TEXT)
RETURNS TABLE (
  id UUID,
  cliente_nome TEXT,
  cliente_apelido TEXT,
  cliente_cnpj TEXT,
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