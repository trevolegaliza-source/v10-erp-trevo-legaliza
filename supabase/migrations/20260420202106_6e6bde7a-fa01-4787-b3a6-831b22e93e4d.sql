CREATE TABLE IF NOT EXISTS public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL DEFAULT public.get_empresa_id(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  extrato_id UUID REFERENCES public.extratos(id) ON DELETE SET NULL,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  lancamento_ids UUID[] NOT NULL,
  total_honorarios NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_taxas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_geral NUMERIC(12,2) NOT NULL,
  data_vencimento DATE,
  status TEXT NOT NULL DEFAULT 'ativa',
  visualizada_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  whatsapp_enviado_em TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cobrancas_select" ON public.cobrancas
  FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_insert" ON public.cobrancas
  FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_update" ON public.cobrancas
  FOR UPDATE TO authenticated 
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

CREATE POLICY "cobrancas_delete" ON public.cobrancas
  FOR DELETE TO authenticated 
  USING (empresa_id = public.get_empresa_id() AND public.get_user_role() = 'master');

CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente ON public.cobrancas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_token ON public.cobrancas(share_token);
CREATE INDEX IF NOT EXISTS idx_cobrancas_empresa_status ON public.cobrancas(empresa_id, status);