-- =============================================
-- SCHEMA TREVO LEGALIZA - Execute no seu Supabase SQL Editor
-- =============================================

-- 1. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE public.tipo_cliente AS ENUM ('MENSALISTA', 'AVULSO_4D');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_processo AS ENUM ('abertura', 'alteracao', 'transformacao', 'baixa', 'avulso', 'orcamento');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.status_financeiro AS ENUM ('pendente', 'pago', 'atrasado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.tipo_lancamento AS ENUM ('receber', 'pagar');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. CLIENTES (Contabilidades)
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_identificador TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  tipo tipo_cliente NOT NULL DEFAULT 'AVULSO_4D',
  email TEXT,
  telefone TEXT,
  nome_contador TEXT,
  apelido TEXT,
  dia_vencimento_mensal INTEGER DEFAULT 15,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clientes_all" ON public.clientes;
CREATE POLICY "clientes_all" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- 3. PROCESSOS
CREATE TABLE IF NOT EXISTS public.processos (
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
DROP POLICY IF EXISTS "processos_all" ON public.processos;
CREATE POLICY "processos_all" ON public.processos FOR ALL USING (true) WITH CHECK (true);

-- 4. PRECOS_TIERS (Motor de Cobrança)
CREATE TABLE IF NOT EXISTS public.precos_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_processo tipo_processo NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC(12,2) NOT NULL,
  descricao TEXT,
  UNIQUE(tipo_processo, tier)
);

ALTER TABLE public.precos_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "precos_tiers_all" ON public.precos_tiers;
CREATE POLICY "precos_tiers_all" ON public.precos_tiers FOR ALL USING (true) WITH CHECK (true);

-- Seed pricing tiers (upsert)
INSERT INTO public.precos_tiers (tipo_processo, tier, valor, descricao) VALUES
  ('abertura', 1, 1200.00, 'Abertura - Preço Base'),
  ('abertura', 2, 900.00, 'Abertura - 2º processo+ (desconto)'),
  ('alteracao', 1, 850.00, 'Alteração - Preço Base'),
  ('alteracao', 2, 650.00, 'Alteração - 2º processo+ (desconto)'),
  ('transformacao', 1, 1500.00, 'Transformação - Preço Base'),
  ('transformacao', 2, 1200.00, 'Transformação - 2º processo+ (desconto)'),
  ('baixa', 1, 600.00, 'Baixa - Preço Base'),
  ('baixa', 2, 450.00, 'Baixa - 2º processo+ (desconto)')
ON CONFLICT (tipo_processo, tier) DO NOTHING;

-- 5. LANCAMENTOS FINANCEIROS
CREATE TABLE IF NOT EXISTS public.lancamentos (
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
  categoria TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lancamentos_all" ON public.lancamentos;
CREATE POLICY "lancamentos_all" ON public.lancamentos FOR ALL USING (true) WITH CHECK (true);

-- 6. DOCUMENTOS (Estação de Validação)
CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  tipo_documento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  url TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documentos_all" ON public.documentos;
CREATE POLICY "documentos_all" ON public.documentos FOR ALL USING (true) WITH CHECK (true);

-- 7. FUNCTION: Calcular preço com tiered pricing
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
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND tipo = p_tipo
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());

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

-- 8. FUNCTION: Calcular data de vencimento
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
    IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
      RETURN (DATE_TRUNC('month', CURRENT_DATE) + (v_dia - 1) * INTERVAL '1 day')::DATE;
    ELSE
      RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (v_dia - 1) * INTERVAL '1 day')::DATE;
    END IF;
  END IF;
END;
$$;

-- MIGRATION: Add new columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'nome_contador') THEN
    ALTER TABLE public.clientes ADD COLUMN nome_contador TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'apelido') THEN
    ALTER TABLE public.clientes ADD COLUMN apelido TEXT;
  END IF;
END $$;

-- MIGRATION: Add new enum values if they don't exist
DO $$
BEGIN
  ALTER TYPE public.tipo_processo ADD VALUE IF NOT EXISTS 'avulso';
  ALTER TYPE public.tipo_processo ADD VALUE IF NOT EXISTS 'orcamento';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- MIGRATION: Add is_archived column to clientes and processos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'is_archived') THEN
    ALTER TABLE public.clientes ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'processos' AND column_name = 'is_archived') THEN
    ALTER TABLE public.processos ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- MIGRATION: Add cnpj column to clientes
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'cnpj') THEN
    ALTER TABLE public.clientes ADD COLUMN cnpj TEXT;
  END IF;
END $$;

-- MIGRATION: Add financial kanban columns to lancamentos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'etapa_financeiro') THEN
    ALTER TABLE public.lancamentos ADD COLUMN etapa_financeiro TEXT NOT NULL DEFAULT 'solicitacao_criada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'honorario_extra') THEN
    ALTER TABLE public.lancamentos ADD COLUMN honorario_extra NUMERIC(12,2) DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'cobranca_encaminhada') THEN
    ALTER TABLE public.lancamentos ADD COLUMN cobranca_encaminhada BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'confirmado_recebimento') THEN
    ALTER TABLE public.lancamentos ADD COLUMN confirmado_recebimento BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'observacoes_financeiro') THEN
    ALTER TABLE public.lancamentos ADD COLUMN observacoes_financeiro TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lancamentos' AND column_name = 'boleto_url') THEN
    ALTER TABLE public.lancamentos ADD COLUMN boleto_url TEXT;
  END IF;
END $$;
