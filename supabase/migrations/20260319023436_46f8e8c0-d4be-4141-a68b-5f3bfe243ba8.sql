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

-- 2. CLIENTES
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_identificador TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  tipo tipo_cliente NOT NULL DEFAULT 'AVULSO_4D',
  email TEXT,
  telefone TEXT,
  nome_contador TEXT,
  apelido TEXT,
  cnpj TEXT,
  dia_vencimento_mensal INTEGER DEFAULT 15,
  valor_base NUMERIC(12,2),
  desconto_progressivo NUMERIC(5,2) DEFAULT 0,
  valor_limite_desconto NUMERIC(12,2),
  tipo_desconto TEXT DEFAULT 'progressivo',
  mensalidade NUMERIC(12,2),
  qtd_processos INTEGER,
  vencimento INTEGER,
  dia_cobranca INTEGER,
  momento_faturamento TEXT DEFAULT 'na_solicitacao',
  observacoes TEXT,
  contrato_url TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
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
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "processos_all" ON public.processos FOR ALL USING (true) WITH CHECK (true);

-- 4. PRECOS_TIERS
CREATE TABLE IF NOT EXISTS public.precos_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_processo tipo_processo NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
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
  etapa_financeiro TEXT NOT NULL DEFAULT 'solicitacao_criada',
  honorario_extra NUMERIC(12,2) DEFAULT 0,
  cobranca_encaminhada BOOLEAN DEFAULT FALSE,
  confirmado_recebimento BOOLEAN DEFAULT FALSE,
  observacoes_financeiro TEXT,
  boleto_url TEXT,
  url_comprovante TEXT,
  url_recibo_taxa TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_all" ON public.lancamentos FOR ALL USING (true) WITH CHECK (true);

-- 6. DOCUMENTOS
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
CREATE POLICY "documentos_all" ON public.documentos FOR ALL USING (true) WITH CHECK (true);

-- 7. VALORES ADICIONAIS
CREATE TABLE IF NOT EXISTS public.valores_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  anexo_url TEXT,
  comprovante_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.valores_adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "valores_adicionais_all" ON public.valores_adicionais FOR ALL USING (true) WITH CHECK (true);

-- 8. PRICING ENGINE FUNCTION v2
CREATE OR REPLACE FUNCTION public.calcular_preco_processo(
  p_cliente_id UUID,
  p_tipo tipo_processo
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cliente RECORD;
  v_count INTEGER;
  v_base NUMERIC;
  v_desconto NUMERIC;
  v_preco NUMERIC;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_cliente.tipo = 'MENSALISTA' AND v_cliente.mensalidade IS NOT NULL THEN
    RETURN 0;
  END IF;
  IF v_cliente.valor_base IS NOT NULL THEN
    v_base := v_cliente.valor_base;
  ELSE
    SELECT valor INTO v_base FROM public.precos_tiers
    WHERE tipo_processo = p_tipo AND tier = 1;
    v_base := COALESCE(v_base, 0);
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  v_desconto := COALESCE(v_cliente.desconto_progressivo, 0);
  IF v_count > 0 AND v_desconto > 0 THEN
    v_preco := v_base * (1 - (v_desconto / 100.0) * v_count);
    IF v_cliente.valor_limite_desconto IS NOT NULL AND v_preco < v_cliente.valor_limite_desconto THEN
      v_preco := v_cliente.valor_limite_desconto;
    END IF;
  ELSE
    v_preco := v_base;
  END IF;
  RETURN GREATEST(v_preco, 0);
END;
$$;

-- 9. DUE DATE FUNCTION
CREATE OR REPLACE FUNCTION public.calcular_vencimento(
  p_cliente_id UUID
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cliente RECORD;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF NOT FOUND THEN RETURN CURRENT_DATE + 4; END IF;
  IF v_cliente.tipo = 'MENSALISTA' THEN
    DECLARE v_dia INTEGER := COALESCE(v_cliente.vencimento, v_cliente.dia_vencimento_mensal, 10);
    BEGIN
      IF EXTRACT(DAY FROM CURRENT_DATE) < v_dia THEN
        RETURN (DATE_TRUNC('month', CURRENT_DATE) + (v_dia - 1) * INTERVAL '1 day')::DATE;
      ELSE
        RETURN (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + (v_dia - 1) * INTERVAL '1 day')::DATE;
      END IF;
    END;
  END IF;
  RETURN CURRENT_DATE + COALESCE(v_cliente.dia_cobranca, 3);
END;
$$;

-- 10. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documentos_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "documentos_select" ON storage.objects FOR SELECT USING (bucket_id = 'documentos');
CREATE POLICY "documentos_update" ON storage.objects FOR UPDATE USING (bucket_id = 'documentos');
CREATE POLICY "documentos_delete" ON storage.objects FOR DELETE USING (bucket_id = 'documentos');