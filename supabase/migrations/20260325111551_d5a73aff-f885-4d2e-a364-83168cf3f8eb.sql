
-- 1. Novo tipo de cliente
ALTER TYPE public.tipo_cliente ADD VALUE IF NOT EXISTS 'PRE_PAGO';

-- 2. Novas colunas em clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS saldo_prepago NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saldo_ultima_recarga NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS data_ultima_recarga DATE,
  ADD COLUMN IF NOT EXISTS franquia_processos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_boas_vindas_aplicado BOOLEAN DEFAULT false;

-- 3. Tabela de movimentações pré-pago
CREATE TABLE IF NOT EXISTS public.prepago_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL,
  saldo_posterior NUMERIC NOT NULL,
  descricao TEXT NOT NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prepago_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prepago_movimentacoes_authenticated_all"
  ON public.prepago_movimentacoes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 4. Colunas extras em service_negotiations
ALTER TABLE public.service_negotiations
  ADD COLUMN IF NOT EXISTS valor_prepago NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;
