-- =============================================
-- SCHEMA TREVO LEGALIZA — Espelho do banco real
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

-- =============================================
-- HELPER FUNCTIONS (must exist before policies)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- =============================================
-- 2. PROFILES
-- =============================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  nome TEXT,
  role TEXT NOT NULL DEFAULT 'visualizador',
  ativo BOOLEAN DEFAULT false,
  empresa_id UUID NOT NULL,
  foto_url TEXT,
  cpf TEXT,
  data_nascimento DATE,
  ultimo_acesso TIMESTAMPTZ,
  motivo_inativacao TEXT,
  convidado_por UUID REFERENCES public.profiles(id),
  convidado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_empresa" ON public.profiles
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "profiles_insert_trigger" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self_safe" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND ativo = (SELECT p.ativo FROM profiles p WHERE p.id = auth.uid())
    AND empresa_id = (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid())
  );

CREATE POLICY "profiles_update_master" ON public.profiles
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'master' AND empresa_id = get_empresa_id())
  WITH CHECK (get_user_role() = 'master' AND empresa_id = get_empresa_id());

CREATE POLICY "profiles_delete_master" ON public.profiles
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- =============================================
-- 3. CLIENTES
-- =============================================

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
  saldo_prepago NUMERIC DEFAULT 0,
  saldo_ultima_recarga NUMERIC DEFAULT 0,
  data_ultima_recarga DATE,
  franquia_processos INTEGER DEFAULT 0,
  desconto_boas_vindas_aplicado BOOLEAN DEFAULT false,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  estado TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  nome_contato_financeiro TEXT,
  telefone_financeiro TEXT,
  auditado_financeiro BOOLEAN DEFAULT false,
  auditado_em TIMESTAMPTZ,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes_select" ON public.clientes
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "clientes_insert" ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "clientes_update" ON public.clientes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "clientes_delete" ON public.clientes
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 4. PROCESSOS
-- =============================================

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
  etiquetas TEXT[] DEFAULT '{}',
  data_deferimento DATE,
  link_drive TEXT,
  justificativa_avulso TEXT,
  valor_avulso NUMERIC DEFAULT 0,
  dentro_do_plano BOOLEAN,
  auditado_financeiro BOOLEAN DEFAULT false,
  auditado_em TIMESTAMPTZ,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processos_select" ON public.processos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "processos_insert" ON public.processos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "processos_update" ON public.processos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "processos_delete" ON public.processos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 5. PRECOS_TIERS
-- =============================================

CREATE TABLE IF NOT EXISTS public.precos_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_processo tipo_processo NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  valor NUMERIC(12,2) NOT NULL,
  descricao TEXT,
  UNIQUE(tipo_processo, tier)
);

ALTER TABLE public.precos_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precos_tiers_select" ON public.precos_tiers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "precos_tiers_insert_master" ON public.precos_tiers
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'master');

CREATE POLICY "precos_tiers_update_master" ON public.precos_tiers
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'master')
  WITH CHECK (get_user_role() = 'master');

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

-- =============================================
-- 6. LANCAMENTOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo tipo_lancamento NOT NULL,
  cliente_id UUID REFERENCES public.clientes(id),
  processo_id UUID REFERENCES public.processos(id),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  valor_original NUMERIC(12,2),
  valor_alterado_por UUID REFERENCES public.profiles(id),
  valor_alterado_em TIMESTAMPTZ,
  status status_financeiro NOT NULL DEFAULT 'pendente',
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  is_taxa_reembolsavel BOOLEAN DEFAULT FALSE,
  comprovante_url TEXT,
  categoria TEXT,
  subcategoria TEXT,
  fornecedor TEXT,
  centro_custo TEXT,
  etapa_financeiro TEXT NOT NULL DEFAULT 'solicitacao_criada',
  honorario_extra NUMERIC(12,2) DEFAULT 0,
  cobranca_encaminhada BOOLEAN DEFAULT FALSE,
  confirmado_recebimento BOOLEAN DEFAULT FALSE,
  observacoes_financeiro TEXT,
  boleto_url TEXT,
  url_comprovante TEXT,
  url_recibo_taxa TEXT,
  recibo_assinado_url TEXT,
  colaborador_id UUID REFERENCES public.colaboradores(id),
  despesa_recorrente_id UUID REFERENCES public.despesas_recorrentes(id),
  conta_id UUID REFERENCES public.plano_contas(id),
  extrato_id UUID REFERENCES public.extratos(id),
  competencia_mes INTEGER,
  competencia_ano INTEGER,
  data_ultimo_contato DATE,
  data_retorno_cobranca DATE,
  tentativas_cobranca INTEGER DEFAULT 0,
  notas_cobranca TEXT,
  auditado BOOLEAN DEFAULT false,
  auditado_por UUID REFERENCES public.profiles(id),
  auditado_em TIMESTAMPTZ,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lancamentos_select" ON public.lancamentos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "lancamentos_insert_role" ON public.lancamentos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  );

CREATE POLICY "lancamentos_update_role" ON public.lancamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'))
  WITH CHECK (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "lancamentos_delete_role" ON public.lancamentos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() = 'master');

-- =============================================
-- 7. DOCUMENTOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  tipo_documento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente',
  url TEXT,
  observacao TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_select" ON public.documentos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "documentos_insert" ON public.documentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "documentos_update" ON public.documentos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "documentos_delete" ON public.documentos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 8. VALORES ADICIONAIS
-- =============================================

CREATE TABLE IF NOT EXISTS public.valores_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  anexo_url TEXT,
  comprovante_url TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.valores_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "valores_adicionais_select" ON public.valores_adicionais
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "valores_adicionais_insert" ON public.valores_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "valores_adicionais_update" ON public.valores_adicionais
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "valores_adicionais_delete" ON public.valores_adicionais
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 9. EXTRATOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.extratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  competencia_mes INTEGER NOT NULL,
  competencia_ano INTEGER NOT NULL,
  pdf_url TEXT NOT NULL,
  filename TEXT NOT NULL,
  total_honorarios NUMERIC NOT NULL DEFAULT 0,
  total_taxas NUMERIC NOT NULL DEFAULT 0,
  total_geral NUMERIC NOT NULL DEFAULT 0,
  qtd_processos INTEGER NOT NULL DEFAULT 0,
  processo_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ativo',
  enviado BOOLEAN NOT NULL DEFAULT false,
  data_envio TIMESTAMPTZ,
  observacoes TEXT,
  created_by TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.extratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "extratos_select" ON public.extratos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "extratos_insert" ON public.extratos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "extratos_update" ON public.extratos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "extratos_delete" ON public.extratos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 10. WEBHOOK_CONFIGS
-- =============================================

CREATE TABLE IF NOT EXISTS public.webhook_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  url TEXT NOT NULL,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_configs_select" ON public.webhook_configs
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "webhook_configs_insert" ON public.webhook_configs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "webhook_configs_update" ON public.webhook_configs
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "webhook_configs_delete" ON public.webhook_configs
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 11. COLABORADORES
-- =============================================

CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  email TEXT,
  regime TEXT NOT NULL DEFAULT 'CLT',
  status TEXT NOT NULL DEFAULT 'ativo',
  salario_base NUMERIC NOT NULL DEFAULT 0,
  vt_diario NUMERIC NOT NULL DEFAULT 0,
  vr_diario NUMERIC NOT NULL DEFAULT 0,
  auxilio_combustivel_valor NUMERIC NOT NULL DEFAULT 0,
  tipo_transporte TEXT NOT NULL DEFAULT 'vt',
  valor_das NUMERIC NOT NULL DEFAULT 0,
  possui_adiantamento BOOLEAN NOT NULL DEFAULT true,
  adiantamento_valor NUMERIC NOT NULL DEFAULT 0,
  adiantamento_tipo TEXT NOT NULL DEFAULT 'percentual',
  dia_adiantamento INTEGER DEFAULT 20,
  dia_pagamento_integral INTEGER DEFAULT 5,
  dia_salario INTEGER DEFAULT 5,
  dia_vt_vr INTEGER DEFAULT 0,
  dia_das INTEGER DEFAULT 20,
  data_inicio DATE,
  aniversario DATE,
  pix_chave TEXT,
  pix_tipo TEXT,
  observacoes_pagamento TEXT,
  provisionar_ferias BOOLEAN DEFAULT true,
  provisionar_13 BOOLEAN DEFAULT true,
  inss_patronal_percentual NUMERIC DEFAULT 20,
  fgts_percentual NUMERIC DEFAULT 8,
  aumento_previsto_valor NUMERIC DEFAULT 0,
  aumento_previsto_data TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_select" ON public.colaboradores
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id() AND get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "colaboradores_insert" ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "colaboradores_update" ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "colaboradores_delete" ON public.colaboradores
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 12. COLABORADOR_AVALIACOES
-- =============================================

CREATE TABLE IF NOT EXISTS public.colaborador_avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES public.colaboradores(id) NOT NULL,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  feedback TEXT,
  conclusao_trimestral TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.colaborador_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaborador_avaliacoes_select" ON public.colaborador_avaliacoes
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "colaborador_avaliacoes_insert" ON public.colaborador_avaliacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "colaborador_avaliacoes_update" ON public.colaborador_avaliacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "colaborador_avaliacoes_delete" ON public.colaborador_avaliacoes
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 13. DESPESAS_RECORRENTES
-- =============================================

CREATE TABLE IF NOT EXISTS public.despesas_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  valor NUMERIC NOT NULL DEFAULT 0,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  fornecedor TEXT,
  colaborador_id UUID REFERENCES public.colaboradores(id),
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "despesas_recorrentes_select" ON public.despesas_recorrentes
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "despesas_recorrentes_insert" ON public.despesas_recorrentes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "despesas_recorrentes_update" ON public.despesas_recorrentes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "despesas_recorrentes_delete" ON public.despesas_recorrentes
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 14. PLANO_CONTAS
-- =============================================

CREATE TABLE IF NOT EXISTS public.plano_contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  grupo TEXT NOT NULL,
  subgrupo TEXT,
  centro_custo TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  parent_id UUID REFERENCES public.plano_contas(id),
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plano_contas_select" ON public.plano_contas
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "plano_contas_insert" ON public.plano_contas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "plano_contas_update" ON public.plano_contas
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "plano_contas_delete" ON public.plano_contas
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 15. CATALOGO_SERVICOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.catalogo_servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT,
  prazo_estimado TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catalogo_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_servicos_select" ON public.catalogo_servicos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_servicos_insert" ON public.catalogo_servicos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_servicos_update" ON public.catalogo_servicos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_servicos_delete" ON public.catalogo_servicos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 16. CATALOGO_PRECOS_UF
-- =============================================

CREATE TABLE IF NOT EXISTS public.catalogo_precos_uf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  servico_id UUID REFERENCES public.catalogo_servicos(id) NOT NULL,
  uf CHAR(2) NOT NULL,
  honorario_trevo NUMERIC NOT NULL DEFAULT 0,
  taxa_orgao NUMERIC NOT NULL DEFAULT 0,
  prazo_estimado TEXT,
  observacoes TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.catalogo_precos_uf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalogo_precos_uf_select" ON public.catalogo_precos_uf
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_precos_uf_insert" ON public.catalogo_precos_uf
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_precos_uf_update" ON public.catalogo_precos_uf
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "catalogo_precos_uf_delete" ON public.catalogo_precos_uf
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 17. ORCAMENTOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER NOT NULL DEFAULT nextval('orcamentos_numero_seq'),
  prospect_nome TEXT NOT NULL,
  prospect_cnpj TEXT,
  prospect_email TEXT,
  prospect_telefone TEXT,
  prospect_contato TEXT,
  tipo_contrato TEXT NOT NULL DEFAULT 'avulso',
  servicos JSONB NOT NULL DEFAULT '[]',
  naturezas JSONB NOT NULL DEFAULT '[]',
  escopo JSONB NOT NULL DEFAULT '[]',
  valor_base NUMERIC NOT NULL DEFAULT 880,
  valor_final NUMERIC NOT NULL DEFAULT 880,
  desconto_pct NUMERIC DEFAULT 0,
  qtd_processos INTEGER DEFAULT 1,
  status TEXT DEFAULT 'rascunho',
  share_token TEXT DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  senha_link TEXT,
  validade_dias INTEGER DEFAULT 15,
  pagamento TEXT,
  sla TEXT,
  prazo_execucao TEXT,
  ordem_execucao TEXT,
  contexto TEXT,
  destinatario TEXT DEFAULT 'contador',
  observacoes TEXT,
  pdf_url TEXT,
  secoes JSONB DEFAULT '[]',
  pacotes JSONB DEFAULT '[]',
  etapas_fluxo JSONB DEFAULT '[]',
  riscos JSONB DEFAULT '[]',
  cenarios JSONB DEFAULT '[]',
  cenario_selecionado TEXT,
  headline_cenario TEXT DEFAULT '',
  beneficios_capa JSONB DEFAULT '[]',
  desconto_progressivo_ativo BOOLEAN DEFAULT false,
  desconto_progressivo_pct NUMERIC DEFAULT 5,
  desconto_progressivo_limite NUMERIC DEFAULT 600,
  itens_selecionados JSONB,
  prazo_pagamento_dias INTEGER DEFAULT 2,
  aprovado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  recusado_em TIMESTAMPTZ,
  observacoes_recusa TEXT,
  convertido_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  contrato_assinado_url TEXT,
  clicksign_document_key TEXT,
  cliente_id UUID REFERENCES public.clientes(id),
  created_by TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamentos_select" ON public.orcamentos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "orcamentos_insert" ON public.orcamentos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamentos_update" ON public.orcamentos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamentos_delete" ON public.orcamentos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 18. ORCAMENTO_PDFS
-- =============================================

CREATE TABLE IF NOT EXISTS public.orcamento_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID REFERENCES public.orcamentos(id) NOT NULL,
  modo TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  gerado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelado_em TIMESTAMPTZ,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orcamento_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_pdfs_select" ON public.orcamento_pdfs
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_insert" ON public.orcamento_pdfs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_update" ON public.orcamento_pdfs
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_delete" ON public.orcamento_pdfs
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 19. CONTRATOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_contrato TEXT NOT NULL,
  orcamento_id UUID REFERENCES public.orcamentos(id),
  contratante_tipo TEXT DEFAULT 'juridica',
  contratante_nome TEXT NOT NULL,
  contratante_cnpj_cpf TEXT NOT NULL,
  contratante_endereco TEXT NOT NULL,
  contratante_representante TEXT NOT NULL,
  contratante_representante_cpf TEXT NOT NULL,
  contratante_representante_qualificacao TEXT,
  contratada_nome TEXT DEFAULT 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  contratada_cnpj TEXT DEFAULT '39.969.412/0001-70',
  contratada_endereco TEXT DEFAULT 'Rua Brasil, nº 1170, Rudge Ramos, São Bernardo do Campo/SP',
  contratada_representante TEXT DEFAULT 'Dr. Thales Felipe Burger',
  contratada_representante_cpf TEXT DEFAULT '447.821.658-46',
  contratada_representante_qualificacao TEXT DEFAULT 'empresário e advogado, brasileiro, solteiro',
  cidade_contrato TEXT DEFAULT 'São Bernardo do Campo/SP',
  data_contrato DATE DEFAULT CURRENT_DATE,
  pdf_url TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_select" ON public.contratos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "contratos_insert" ON public.contratos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "contratos_update" ON public.contratos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "contratos_delete" ON public.contratos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 20. NOTIFICACOES
-- =============================================

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  lida BOOLEAN DEFAULT false,
  orcamento_id UUID REFERENCES public.orcamentos(id),
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notificacoes_select" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "notificacoes_insert_auth" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "notificacoes_update" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "notificacoes_delete" ON public.notificacoes
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 21. PROPOSTA_EVENTOS
-- =============================================

CREATE TABLE IF NOT EXISTS public.proposta_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id UUID REFERENCES public.orcamentos(id),
  tipo TEXT NOT NULL,
  dados JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.proposta_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposta_eventos_select" ON public.proposta_eventos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "proposta_eventos_insert_auth" ON public.proposta_eventos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

-- =============================================
-- 22. CONTATOS_ESTADO
-- =============================================

CREATE TABLE IF NOT EXISTS public.contatos_estado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uf CHAR(2) NOT NULL,
  tipo TEXT NOT NULL,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  site_url TEXT,
  municipio TEXT,
  contato_interno TEXT,
  endereco TEXT,
  observacoes TEXT,
  rating INTEGER DEFAULT 0,
  pin_cor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contatos_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatos_estado_select" ON public.contatos_estado
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "contatos_estado_insert_auth" ON public.contatos_estado
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "contatos_estado_update_auth" ON public.contatos_estado
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('master', 'financeiro'))
  WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "contatos_estado_delete_auth" ON public.contatos_estado
  FOR DELETE TO authenticated
  USING (get_user_role() = 'master');

-- =============================================
-- 23. NOTAS_ESTADO
-- =============================================

CREATE TABLE IF NOT EXISTS public.notas_estado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uf CHAR(2) NOT NULL,
  conteudo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notas_estado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notas_estado_select" ON public.notas_estado
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "notas_estado_insert_auth" ON public.notas_estado
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('master', 'financeiro'));

CREATE POLICY "notas_estado_update_auth" ON public.notas_estado
  FOR UPDATE TO authenticated
  USING (get_user_role() IN ('master', 'financeiro'))
  WITH CHECK (get_user_role() IN ('master', 'financeiro'));

-- =============================================
-- 24. PREPAGO_MOVIMENTACOES
-- =============================================

CREATE TABLE IF NOT EXISTS public.prepago_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  processo_id UUID REFERENCES public.processos(id),
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL,
  saldo_anterior NUMERIC NOT NULL,
  saldo_posterior NUMERIC NOT NULL,
  descricao TEXT NOT NULL,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.prepago_movimentacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prepago_movimentacoes_select" ON public.prepago_movimentacoes
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "prepago_movimentacoes_insert" ON public.prepago_movimentacoes
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "prepago_movimentacoes_update" ON public.prepago_movimentacoes
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "prepago_movimentacoes_delete" ON public.prepago_movimentacoes
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 25. SERVICE_NEGOTIATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.service_negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) NOT NULL,
  service_name TEXT NOT NULL,
  fixed_price NUMERIC NOT NULL DEFAULT 0,
  billing_trigger TEXT NOT NULL DEFAULT 'request',
  trigger_days INTEGER DEFAULT 0,
  is_custom BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  valor_prepago NUMERIC DEFAULT 0,
  empresa_id UUID DEFAULT get_empresa_id(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.service_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_negotiations_select" ON public.service_negotiations
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "service_negotiations_insert" ON public.service_negotiations
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "service_negotiations_update" ON public.service_negotiations
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "service_negotiations_delete" ON public.service_negotiations
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- =============================================
-- 26. ROLE_TEMPLATES
-- =============================================

CREATE TABLE IF NOT EXISTS public.role_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  nome_display TEXT NOT NULL,
  descricao TEXT,
  ordem INTEGER DEFAULT 0,
  cor TEXT DEFAULT 'gray',
  modulos_padrao TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_templates_select" ON public.role_templates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "role_templates_write_master" ON public.role_templates
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'master');

CREATE POLICY "role_templates_update_master" ON public.role_templates
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'master')
  WITH CHECK (get_user_role() = 'master');

CREATE POLICY "role_templates_delete_master" ON public.role_templates
  FOR DELETE TO authenticated
  USING (get_user_role() = 'master');

-- =============================================
-- 27. USER_PERMISSIONS
-- =============================================

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  empresa_id UUID NOT NULL,
  modulo TEXT NOT NULL,
  pode_ver BOOLEAN DEFAULT false,
  pode_criar BOOLEAN DEFAULT false,
  pode_editar BOOLEAN DEFAULT false,
  pode_excluir BOOLEAN DEFAULT false,
  pode_aprovar BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_select_by_empresa" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (empresa_id = get_user_empresa_id());

CREATE POLICY "permissions_insert_master" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_user_empresa_id() AND get_user_role() = 'master');

CREATE POLICY "permissions_update_master" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND get_user_role() = 'master')
  WITH CHECK (empresa_id = get_user_empresa_id() AND get_user_role() = 'master');

CREATE POLICY "permissions_delete_master" ON public.user_permissions
  FOR DELETE TO authenticated
  USING (empresa_id = get_user_empresa_id() AND get_user_role() = 'master');

-- =============================================
-- 28. MASTER_PASSWORD_ATTEMPTS
-- =============================================

CREATE TABLE IF NOT EXISTS public.master_password_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.master_password_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_pw_attempts_insert" ON public.master_password_attempts
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "master_pw_attempts_select" ON public.master_password_attempts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- STORAGE BUCKETS
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos', 'contratos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: scoped to authenticated users within empresa folder
CREATE POLICY "documentos_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "documentos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos');

CREATE POLICY "documentos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documentos');

-- =============================================
-- BUSINESS FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.calcular_preco_processo(
  p_cliente_id UUID,
  p_tipo tipo_processo
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente RECORD;
  v_count INTEGER;
  v_base NUMERIC;
  v_desconto NUMERIC;
  v_preco NUMERIC;
  v_i INTEGER;
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
    v_preco := v_base;
    FOR v_i IN 1..v_count LOOP
      v_preco := v_preco * (1 - v_desconto / 100.0);
    END LOOP;
    IF v_cliente.valor_limite_desconto IS NOT NULL AND v_preco < v_cliente.valor_limite_desconto THEN
      v_preco := v_cliente.valor_limite_desconto;
    END IF;
  ELSE
    v_preco := v_base;
  END IF;
  RETURN GREATEST(v_preco, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_vencimento(
  p_cliente_id UUID
)
RETURNS DATE
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
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

-- =============================================
-- SECURITY DEFINER FUNCTIONS (proposals)
-- =============================================

CREATE OR REPLACE FUNCTION public.get_proposta_por_token(p_token TEXT)
RETURNS TABLE(
  id UUID, numero INTEGER, prospect_nome TEXT, prospect_cnpj TEXT,
  prospect_email TEXT, prospect_telefone TEXT, prospect_contato TEXT,
  tipo_contrato TEXT, servicos JSONB, naturezas JSONB, escopo JSONB,
  valor_base NUMERIC, valor_final NUMERIC, desconto_pct NUMERIC,
  qtd_processos INTEGER, status TEXT, share_token TEXT,
  created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, pdf_url TEXT,
  observacoes TEXT, validade_dias INTEGER, pagamento TEXT, sla TEXT,
  prazo_execucao TEXT, ordem_execucao TEXT, contexto TEXT,
  destinatario TEXT, secoes JSONB, pacotes JSONB, etapas_fluxo JSONB,
  riscos JSONB, cenarios JSONB, cenario_selecionado TEXT,
  headline_cenario TEXT, beneficios_capa JSONB,
  desconto_progressivo_ativo BOOLEAN, desconto_progressivo_pct NUMERIC,
  desconto_progressivo_limite NUMERIC, aprovado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ, recusado_em TIMESTAMPTZ,
  observacoes_recusa TEXT, convertido_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ, contrato_assinado_url TEXT,
  clicksign_document_key TEXT, itens_selecionados JSONB,
  prazo_pagamento_dias INTEGER, empresa_id UUID, cliente_id UUID,
  created_by TEXT, has_password BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT o.id, o.numero, o.prospect_nome, o.prospect_cnpj, o.prospect_email,
    o.prospect_telefone, o.prospect_contato, o.tipo_contrato, o.servicos,
    o.naturezas, o.escopo, o.valor_base, o.valor_final, o.desconto_pct,
    o.qtd_processos, o.status, o.share_token, o.created_at,
    o.updated_at, o.pdf_url, o.observacoes, o.validade_dias,
    o.pagamento, o.sla, o.prazo_execucao, o.ordem_execucao, o.contexto,
    o.destinatario, o.secoes, o.pacotes, o.etapas_fluxo, o.riscos,
    o.cenarios, o.cenario_selecionado, o.headline_cenario, o.beneficios_capa,
    o.desconto_progressivo_ativo, o.desconto_progressivo_pct,
    o.desconto_progressivo_limite, o.aprovado_em, o.enviado_em,
    o.recusado_em, o.observacoes_recusa, o.convertido_em,
    o.pago_em, o.contrato_assinado_url, o.clicksign_document_key,
    o.itens_selecionados, o.prazo_pagamento_dias, o.empresa_id,
    o.cliente_id, o.created_by,
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password
  FROM public.orcamentos o
  WHERE o.share_token = p_token
  AND o.status IN ('enviado', 'aguardando_pagamento');
END;
$$;

CREATE OR REPLACE FUNCTION public.atualizar_proposta_por_token(
  p_token TEXT, p_status TEXT, p_motivo TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_status NOT IN ('aprovado', 'recusado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.orcamentos
  SET status = p_status,
      observacoes_recusa = p_motivo,
      updated_at = now()
  WHERE share_token = p_token
  AND status = 'enviado';
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_evento_proposta(
  p_orcamento_id UUID, p_tipo TEXT, p_dados JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.orcamentos WHERE id = p_orcamento_id;
  IF v_empresa_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.proposta_eventos (orcamento_id, tipo, dados, empresa_id)
  VALUES (p_orcamento_id, p_tipo, p_dados, v_empresa_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.verificar_senha_proposta(p_token TEXT, p_senha TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_senha TEXT;
BEGIN
  SELECT senha_link INTO v_senha
  FROM public.orcamentos
  WHERE share_token = p_token
  AND status IN ('enviado', 'aguardando_pagamento');
  IF v_senha IS NULL THEN RETURN false; END IF;
  RETURN v_senha = p_senha;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_notificacao_proposta(
  p_orcamento_id UUID, p_tipo TEXT, p_mensagem TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM orcamentos WHERE id = p_orcamento_id;
  IF v_empresa_id IS NULL THEN RETURN; END IF;
  INSERT INTO notificacoes (empresa_id, tipo, titulo, mensagem, orcamento_id)
  VALUES (
    v_empresa_id,
    p_tipo,
    CASE WHEN p_tipo = 'aprovacao' THEN '🟢 PROPOSTA APROVADA' ELSE '🔴 PROPOSTA RECUSADA' END,
    p_mensagem,
    p_orcamento_id
  );
END;
$$;

-- =============================================
-- TRIGGER: handle_new_user
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::UUID;

  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id
    FROM public.profiles WHERE role = 'master' LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa encontrada para associar novo usuário. Contate o administrador.';
  END IF;

  INSERT INTO public.profiles (id, email, nome, role, ativo, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role_inicial', NEW.raw_user_meta_data->>'role', 'visualizador'),
    false,
    v_empresa_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    empresa_id = COALESCE(EXCLUDED.empresa_id, profiles.empresa_id);

  RETURN NEW;
END;
$$;
