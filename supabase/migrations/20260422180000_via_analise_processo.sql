-- =============================================
-- Via de análise do processo + bloqueio de cobrança sem reembolso
-- =============================================
-- Motivação do Thales (22/04/2026): "foi a regional faturou os
-- processos pra mim, eu não solicitei o reembolso pro cliente e
-- me lasquei". ERP não tinha como rastrear que uma taxa de
-- balcão (Regional) ou taxa + honorário adicional (Método Trevo)
-- foi paga mas não cobrada do cliente.
--
-- O formulário do cliente pergunta qual via prefere:
--   ⚪ Matriz            — sem custo adicional além da DARE
--   🟡 Regional          — DARE + Taxa de Balcão (R$ 189-231)
--   🟢🚀 Método Trevo    — DARE + Taxa de Balcão + Honorário Trevo
--
-- Regra de bloqueio:
--   Se via_analise IN ('regional','metodo_trevo'), o processo NÃO
--   pode avançar pra cobrança (etapa_financeiro='cobranca_gerada'
--   ou superior) até que exista valores_adicionais com:
--     - categoria='taxa_balcao' + comprovante_url (obrigatório pra
--       regional E método trevo)
--     - categoria='honorario_metodo_trevo' (só pra método trevo)
--
-- Implementação:
--   1. ENUM via_analise
--   2. Coluna processos.via_analise (default 'matriz')
--   3. Coluna valores_adicionais.categoria (TEXT livre, mas
--      convencionamos: 'taxa_balcao', 'honorario_metodo_trevo',
--      'dare_junta', 'outra')
--   4. Coluna valores_adicionais.reembolsavel (BOOLEAN) — já existia
--      como is_taxa_reembolsavel mas não estava aqui; padronizamos.
--   5. RPC pode_avancar_cobranca(p_processo_id) — retorna JSONB
--      com {pode, faltando[], motivo}
--   6. Trigger em lancamentos que bloqueia UPDATE de etapa_financeiro
--      pra 'cobranca_gerada'/'cobranca_enviada' se pode_avancar_cobranca
--      retornar false.
--
-- Fluxo operacional:
--   Carolina marca via='regional' no cadastro
--   → Precisa adicionar valor adicional categoria='taxa_balcao' com
--     comprovante antes que processo entre em extrato/cobrança.
--   Se tentar gerar extrato sem isso, ERP bloqueia com msg clara.
-- =============================================

-- 1) ENUM
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'via_analise') THEN
    CREATE TYPE public.via_analise AS ENUM ('matriz', 'regional', 'metodo_trevo');
  END IF;
END $$;

-- 2) Coluna em processos
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS via_analise public.via_analise NOT NULL DEFAULT 'matriz';

COMMENT ON COLUMN public.processos.via_analise IS
  'Via de análise escolhida pelo cliente no formulário de solicitação. Determina regras de taxas e bloqueio de cobrança. matriz=padrão, regional=precisa taxa balcão registrada+reembolsada, metodo_trevo=precisa taxa balcão + honorário Trevo.';

CREATE INDEX IF NOT EXISTS idx_processos_via_analise
  ON public.processos(via_analise)
  WHERE via_analise IN ('regional', 'metodo_trevo');

-- 3) Coluna em valores_adicionais
ALTER TABLE public.valores_adicionais
  ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE public.valores_adicionais
  ADD COLUMN IF NOT EXISTS reembolsavel BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.valores_adicionais.categoria IS
  'Tipo da taxa adicional. Valores convencionados: taxa_balcao (Regional/Trevo), honorario_metodo_trevo (Trevo), dare_junta, outra. Usado pela RPC pode_avancar_cobranca.';

-- 4) RPC pra conferir se processo pode avançar pra cobrança
CREATE OR REPLACE FUNCTION public.pode_avancar_cobranca(p_processo_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_via          via_analise;
  v_tem_balcao   BOOLEAN := FALSE;
  v_tem_trevo    BOOLEAN := FALSE;
  v_faltando     TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT via_analise INTO v_via
    FROM public.processos
   WHERE id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pode', false,
      'motivo', 'Processo não encontrado',
      'faltando', ARRAY[]::TEXT[]
    );
  END IF;

  -- Matriz não tem restrição adicional
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

  -- Método Trevo exige adicionalmente honorário Trevo
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
      WHEN 'regional' THEN
        'Via "Regional" exige Taxa de Balcão registrada em Valores Adicionais com comprovante de pagamento antes de avançar pra cobrança.'
      WHEN 'metodo_trevo' THEN
        'Via "Método Trevo" exige Taxa de Balcão + Honorário Método Trevo registrados em Valores Adicionais.'
      ELSE
        'Via desconhecida'
    END,
    'faltando', v_faltando,
    'via', v_via::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pode_avancar_cobranca(UUID) TO authenticated;

-- 5) Trigger em lancamentos: bloqueia etapa_financeiro cobranca_gerada+
-- se pode_avancar_cobranca retornar false.
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
  -- Só checa se está MUDANDO para uma etapa de cobrança
  IF NEW.etapa_financeiro = OLD.etapa_financeiro THEN
    RETURN NEW;
  END IF;

  IF NOT (NEW.etapa_financeiro = ANY(v_etapas_cobranca)) THEN
    RETURN NEW;
  END IF;

  IF NEW.processo_id IS NULL THEN
    RETURN NEW; -- lançamento sem processo (avulso puro) não tem via
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

DROP TRIGGER IF EXISTS trg_bloqueia_cobranca_sem_reembolso ON public.lancamentos;
CREATE TRIGGER trg_bloqueia_cobranca_sem_reembolso
  BEFORE UPDATE OF etapa_financeiro ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public._bloqueia_cobranca_sem_reembolso();
