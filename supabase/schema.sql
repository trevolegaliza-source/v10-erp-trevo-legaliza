-- =============================================
-- SCHEMA TREVO LEGALIZA - Execute no seu Supabase SQL Editor
-- =============================================

-- 1. ENUM TYPES
CREATE TYPE public.tipo_cliente AS ENUM ('MENSALISTA', 'AVULSO_4D');
CREATE TYPE public.tipo_processo AS ENUM ('abertura', 'alteracao', 'transformacao', 'baixa');
CREATE TYPE public.status_financeiro AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
CREATE TYPE public.tipo_lancamento AS ENUM ('receber', 'pagar');

-- 2. CLIENTES (Contabilidades)
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_identificador TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  tipo tipo_cliente NOT NULL DEFAULT 'AVULSO_4D',
  email TEXT,
  telefone TEXT,
  dia_vencimento_mensal INTEGER DEFAULT 15, -- dia do mês para mensalistas
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_all" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- 3. PROCESSOS
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE NOT NULL,
  razao_social TEXT NOT NULL,
  tipo tipo_processo NOT NULL,
  etapa TEXT NOT NULL DEFAULT 'recebidos',
  prioridade TEXT NOT NULL DEFAULT 'normal',
  responsavel TEXT,
  valor NUMERIC(12,2),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "processos_all" ON public.processos FOR ALL USING (true) WITH CHECK (true);

-- 4. PRECOS_TIERS (Motor de Cobrança)
CREATE TABLE public.precos_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_processo tipo_processo NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1, -- 1 = base, 2+ = desconto
  valor NUMERIC(12,2) NOT NULL,
  descricao TEXT,
  UNIQUE(tipo_processo, tier)
);

ALTER TABLE public.precos_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "precos_tiers_all" ON public.precos_tiers FOR ALL USING (true) WITH CHECK (true);

-- Seed pricing tiers
INSERT INTO public.precos_tiers (tipo_processo, tier, valor, descricao) VALUES
  ('abertura', 1, 1200.00, 'Abertura - Preço Base'),
  ('abertura', 2, 900.00, 'Abertura - 2º processo+ (desconto)'),
  ('alteracao', 1, 850.00, 'Alteração - Preço Base'),
  ('alteracao', 2, 650.00, 'Alteração - 2º processo+ (desconto)'),
  ('transformacao', 1, 1500.00, 'Transformação - Preço Base'),
  ('transformacao', 2, 1200.00, 'Transformação - 2º processo+ (desconto)'),
  ('baixa', 1, 600.00, 'Baixa - Preço Base'),
  ('baixa', 2, 450.00, 'Baixa - 2º processo+ (desconto)');

-- 5. LANCAMENTOS FINANCEIROS (Contas a Receber / Pagar)
CREATE TABLE public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_lancamento NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  processo_id UUID REFERENCES public.processos(id),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  status status_financeiro NOT NULL DEFAULT 'pendente',
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  is_taxa_reembolsavel BOOLEAN DEFAULT FALSE,
  comprovante_url TEXT,
  categoria TEXT, -- para contas a pagar: 'operacional', 'colaborador', etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_all" ON public.lancamentos FOR ALL USING (true) WITH CHECK (true);

-- 6. FUNCTION: Calcular preço com tiered pricing
CREATE OR REPLACE FUNCTION public.calcular_preco_processo(
  p_cliente_id UUID,
  p_tipo tipo_processo
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count INTEGER;
  v_preco NUMERIC;
BEGIN
  -- Conta processos do mesmo tipo do cliente no mês atual
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND tipo = p_tipo
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

  -- Se já tem 1+, usa tier 2 (desconto), senão tier 1
  IF v_count >= 1 THEN
    SELECT valor INTO v_preco FROM public.precos_tiers
    WHERE tipo_processo = p_tipo AND tier = 2;
  ELSE
    SELECT valor INTO v_preco FROM public.precos_tiers
    WHERE tipo_processo = p_tipo AND tier = 1;
  END IF;

  RETURN COALESCE(v_preco, 0);
END;
$$;

-- 7. FUNCTION: Calcular data de vencimento
CREATE OR REPLACE FUNCTION public.calcular_vencimento(
  p_cliente_id UUID
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_tipo tipo_cliente;
  v_dia INTEGER;
BEGIN
  SELECT tipo, dia_vencimento_mensal INTO v_tipo, v_dia
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_tipo = 'AVULSO_4D' THEN
    RETURN (CURRENT_DATE + INTERVAL '4 days')::DATE;
  ELSE
    -- Próximo vencimento mensal
    IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
      RETURN (DATE_TRUNC('month', CURRENT_DATE) + (v_dia - 1) * INTERVAL '1 day')::DATE;
    ELSE
      RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (v_dia - 1) * INTERVAL '1 day')::DATE;
    END IF;
  END IF;
END;
$$;
