-- =============================================
-- REAPLICAR Onda 1 completa: via_analise + bloqueio anti-prejuízo
-- =============================================
-- Lovable confirmou em 22/04/2026: via_analise NÃO existe na tabela
-- processos. Pode_avancar_cobranca NÃO existe. Categoria/reembolsavel
-- em valores_adicionais NÃO existem. A Onda 1 precisa ser reaplicada
-- inteira em uma única migration consolidada.
--
-- Esta migration é IDEMPOTENTE — pode rodar várias vezes sem quebrar.
-- Tudo com IF NOT EXISTS / DROP IF EXISTS / CREATE OR REPLACE.
--
-- Contexto do negócio (Thales perdeu dinheiro com isso):
--   Quando cliente pede processo, formulário pergunta "via de análise":
--     ⚪ Matriz            — só DARE (Taxa Junta Comercial)
--     🟡 Regional          — DARE + Taxa de Balcão (R$ 189-231)
--     🟢🚀 Método Trevo    — DARE + Taxa de Balcão + Honorário Trevo
--   Trevo paga adiantado a Taxa de Balcão (Regional/Trevo). Se esquecer
--   de cobrar reembolso = prejuízo. ERP precisa BLOQUEAR cobrança até
--   a taxa estar registrada com comprovante.
-- =============================================

-- 1) ENUM via_analise
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'via_analise') THEN
    CREATE TYPE public.via_analise AS ENUM ('matriz', 'regional', 'metodo_trevo');
  END IF;
END $$;

-- 2) Coluna em processos
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS via_analise public.via_analise NOT NULL DEFAULT 'matriz';

COMMENT ON COLUMN public.processos.via_analise IS
  'Via de análise escolhida pelo cliente. matriz=padrão, regional=precisa taxa balcão registrada+reembolsada, metodo_trevo=precisa taxa balcão + honorário Trevo. Determina bloqueio de cobrança.';

CREATE INDEX IF NOT EXISTS idx_processos_via_analise
  ON public.processos(via_analise)
  WHERE via_analise IN ('regional', 'metodo_trevo');

-- 3) Colunas em valores_adicionais
ALTER TABLE public.valores_adicionais
  ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE public.valores_adicionais
  ADD COLUMN IF NOT EXISTS reembolsavel BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.valores_adicionais.categoria IS
  'Tipo da taxa adicional. Convencionado: taxa_balcao (Regional/Trevo), honorario_metodo_trevo (Trevo), dare_junta, outra. Usado pela RPC pode_avancar_cobranca.';

-- 4) RPC pode_avancar_cobranca
CREATE OR REPLACE FUNCTION public.pode_avancar_cobranca(p_processo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_via via_analise;
  v_tem_balcao BOOLEAN := FALSE;
  v_tem_trevo BOOLEAN := FALSE;
  v_faltando TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT via_analise INTO v_via FROM public.processos WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('pode', false, 'motivo', 'Processo não encontrado', 'faltando', ARRAY[]::TEXT[]);
  END IF;

  IF v_via = 'matriz' THEN
    RETURN jsonb_build_object('pode', true, 'faltando', ARRAY[]::TEXT[]);
  END IF;

  -- Regional e Método Trevo exigem taxa_balcao com comprovante
  SELECT EXISTS (
    SELECT 1 FROM public.valores_adicionais
     WHERE processo_id = p_processo_id
       AND categoria = 'taxa_balcao'
       AND valor > 0
       AND comprovante_url IS NOT NULL
       AND reembolsavel = TRUE
  ) INTO v_tem_balcao;

  IF NOT v_tem_balcao THEN
    v_faltando := array_append(v_faltando, 'taxa_balcao');
  END IF;

  IF v_via = 'metodo_trevo' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.valores_adicionais
       WHERE processo_id = p_processo_id
         AND categoria = 'honorario_metodo_trevo'
         AND valor > 0
    ) INTO v_tem_trevo;

    IF NOT v_tem_trevo THEN
      v_faltando := array_append(v_faltando, 'honorario_metodo_trevo');
    END IF;
  END IF;

  IF array_length(v_faltando, 1) IS NULL THEN
    RETURN jsonb_build_object('pode', true, 'faltando', ARRAY[]::TEXT[]);
  END IF;

  RETURN jsonb_build_object(
    'pode', false,
    'motivo', CASE v_via
      WHEN 'regional' THEN 'Via "Regional" exige Taxa de Balcão registrada em Valores Adicionais com comprovante de pagamento antes de avançar pra cobrança.'
      WHEN 'metodo_trevo' THEN 'Via "Método Trevo" exige Taxa de Balcão + Honorário Método Trevo registrados em Valores Adicionais.'
      ELSE 'Via desconhecida'
    END,
    'faltando', v_faltando,
    'via', v_via::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_avancar_cobranca(UUID) TO authenticated;

-- 5) Trigger de bloqueio CONSOLIDADO
-- Substitui o _bloqueia_avanco_aguardando_deferimento que Lovable criou
-- e adiciona a checagem de via_analise (matriz=ok, regional/trevo=
-- precisa taxa). Trigger único, defesa em camadas.
CREATE OR REPLACE FUNCTION public._bloqueia_cobranca_sem_reembolso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_etapas_cobranca TEXT[] := ARRAY['cobranca_gerada', 'cobranca_enviada', 'aguardando_pagamento'];
BEGIN
  IF NEW.etapa_financeiro = OLD.etapa_financeiro THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.etapa_financeiro = ANY(v_etapas_cobranca)) THEN
    RETURN NEW;
  END IF;

  -- Camada 1: aguardando_deferimento NÃO pode avançar
  IF OLD.etapa_financeiro = 'aguardando_deferimento' THEN
    RAISE EXCEPTION 'Marque o processo como deferido antes de avançar pra cobrança.'
      USING ERRCODE = 'check_violation',
            HINT = 'Use a ação "Marcar como deferido" no processo. Isso promove o lançamento automaticamente.';
  END IF;

  -- Camada 2: via_analise (regional/trevo precisa taxa)
  IF NEW.processo_id IS NULL THEN
    RETURN NEW; -- avulso puro sem via
  END IF;

  v_result := public.pode_avancar_cobranca(NEW.processo_id);

  IF (v_result->>'pode')::BOOLEAN THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cobrança bloqueada: %', v_result->>'motivo'
    USING ERRCODE = 'check_violation',
          HINT = 'Adicione os Valores Adicionais pendentes no processo antes de avançar.',
          DETAIL = v_result::text;
END;
$$;

-- Re-anexa trigger (DROP IF EXISTS + CREATE pra garantir)
DROP TRIGGER IF EXISTS trg_bloqueia_avanco_aguardando_deferimento ON public.lancamentos;
DROP TRIGGER IF EXISTS trg_bloqueia_cobranca_sem_reembolso ON public.lancamentos;
CREATE TRIGGER trg_bloqueia_cobranca_sem_reembolso
  BEFORE UPDATE OF etapa_financeiro ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public._bloqueia_cobranca_sem_reembolso();
