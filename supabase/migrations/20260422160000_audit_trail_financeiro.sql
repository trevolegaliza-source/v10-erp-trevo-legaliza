-- =============================================
-- Audit trail pro Financeiro — cobrancas + lancamentos
-- =============================================
-- Motivação: hoje é IMPOSSÍVEL responder "quem marcou essa cobrança
-- como paga?" ou "quando esse lançamento foi contestado?". Isso
-- quebra compliance e inviabiliza resolução de disputas.
--
-- Solução: tabela genérica `financeiro_auditoria` que grava toda
-- mudança relevante de status/valor em cobrancas e lançamentos.
-- Triggers AFTER UPDATE só gravam quando campos auditáveis mudam.
--
-- Campos auditáveis:
--   cobrancas: status, data_vencimento, data_expiracao,
--              asaas_payment_id, asaas_status, total_geral
--   lancamentos: status, etapa_financeiro, valor, data_pagamento,
--                confirmado_recebimento, contestacao_motivo
--
-- Quem grava: auth.uid() no UPDATE normal.
-- Se NULL (ação via service_role, ex: webhook Asaas), marca como
-- 'system' no campo `ator_tipo`.
-- =============================================

-- ---------------------------------------------
-- 1) Tabela genérica de auditoria
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id              BIGSERIAL PRIMARY KEY,
  empresa_id      UUID,
  entidade        TEXT NOT NULL,            -- 'cobranca' | 'lancamento'
  entidade_id     UUID NOT NULL,
  campo           TEXT NOT NULL,            -- ex: 'status', 'valor'
  valor_antigo    JSONB,                    -- snapshot do valor anterior
  valor_novo      JSONB,                    -- snapshot do valor novo
  ator_tipo       TEXT NOT NULL,            -- 'user' | 'system'
  ator_id         UUID,                     -- auth.uid() quando user
  ator_role       TEXT,                     -- role do user (master/gerente/financeiro)
  motivo          TEXT,                     -- opcional — pra contestação, desfazer, etc
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.financeiro_auditoria IS
  'Histórico de mudanças em cobrancas e lancamentos. 1 linha por campo alterado por UPDATE. Append-only.';

CREATE INDEX IF NOT EXISTS idx_auditoria_entidade
  ON public.financeiro_auditoria(entidade, entidade_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_empresa
  ON public.financeiro_auditoria(empresa_id, criado_em DESC)
  WHERE empresa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_ator
  ON public.financeiro_auditoria(ator_id, criado_em DESC)
  WHERE ator_id IS NOT NULL;

-- ---------------------------------------------
-- 2) RLS — master lê toda da empresa; outros só leem as próprias
-- ---------------------------------------------
ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_master_read" ON public.financeiro_auditoria;
CREATE POLICY "auditoria_master_read" ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND public.get_user_role() IN ('master', 'gerente')
  );

DROP POLICY IF EXISTS "auditoria_self_read" ON public.financeiro_auditoria;
CREATE POLICY "auditoria_self_read" ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (
    empresa_id = public.get_empresa_id()
    AND ator_id = auth.uid()
  );

-- Ninguém escreve via client — só triggers (BYPASSRLS via SECURITY DEFINER)
-- então nenhum INSERT/UPDATE/DELETE policy.

-- ---------------------------------------------
-- 3) Helper genérico pra gravar audit
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._auditoria_gravar(
  p_empresa_id   UUID,
  p_entidade     TEXT,
  p_entidade_id  UUID,
  p_campo        TEXT,
  p_valor_antigo JSONB,
  p_valor_novo   JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_role TEXT;
BEGIN
  -- Deduplica no-ops (quando o valor é o mesmo)
  IF p_valor_antigo IS NOT DISTINCT FROM p_valor_novo THEN
    RETURN;
  END IF;

  BEGIN
    v_role := public.get_user_role();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  INSERT INTO public.financeiro_auditoria (
    empresa_id, entidade, entidade_id, campo,
    valor_antigo, valor_novo,
    ator_tipo, ator_id, ator_role
  ) VALUES (
    p_empresa_id, p_entidade, p_entidade_id, p_campo,
    p_valor_antigo, p_valor_novo,
    CASE WHEN v_uid IS NULL THEN 'system' ELSE 'user' END,
    v_uid, v_role
  );
END;
$$;

-- ---------------------------------------------
-- 4) Trigger em COBRANCAS
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._audit_cobrancas_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'status',
      to_jsonb(OLD.status), to_jsonb(NEW.status)
    );
  END IF;

  -- total_geral
  IF NEW.total_geral IS DISTINCT FROM OLD.total_geral THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'total_geral',
      to_jsonb(OLD.total_geral), to_jsonb(NEW.total_geral)
    );
  END IF;

  -- data_vencimento
  IF NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'data_vencimento',
      to_jsonb(OLD.data_vencimento), to_jsonb(NEW.data_vencimento)
    );
  END IF;

  -- data_expiracao
  IF NEW.data_expiracao IS DISTINCT FROM OLD.data_expiracao THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'data_expiracao',
      to_jsonb(OLD.data_expiracao), to_jsonb(NEW.data_expiracao)
    );
  END IF;

  -- asaas_payment_id (nascimento do payment no Asaas)
  IF NEW.asaas_payment_id IS DISTINCT FROM OLD.asaas_payment_id THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'asaas_payment_id',
      to_jsonb(OLD.asaas_payment_id), to_jsonb(NEW.asaas_payment_id)
    );
  END IF;

  -- asaas_status (pra rastrear eventos do Asaas)
  IF NEW.asaas_status IS DISTINCT FROM OLD.asaas_status THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'asaas_status',
      to_jsonb(OLD.asaas_status), to_jsonb(NEW.asaas_status)
    );
  END IF;

  -- share_token (rotação = ato de segurança, importante logar)
  -- Não gravamos o token real pra não expor em query de audit;
  -- usamos timestamps OLD/NEW de updated_at pra garantir que o helper
  -- _auditoria_gravar não descarte como no-op.
  IF NEW.share_token IS DISTINCT FROM OLD.share_token THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'cobranca', NEW.id, 'share_token_rotacionado',
      to_jsonb(OLD.updated_at), to_jsonb(NEW.updated_at)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cobrancas ON public.cobrancas;
CREATE TRIGGER trg_audit_cobrancas
  AFTER UPDATE ON public.cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION public._audit_cobrancas_trigger();

-- ---------------------------------------------
-- 5) Trigger em LANCAMENTOS
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._audit_lancamentos_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- status
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'status',
      to_jsonb(OLD.status), to_jsonb(NEW.status)
    );
  END IF;

  -- etapa_financeiro (quando sai de cobranca_gerada, enviada, etc)
  IF NEW.etapa_financeiro IS DISTINCT FROM OLD.etapa_financeiro THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'etapa_financeiro',
      to_jsonb(OLD.etapa_financeiro), to_jsonb(NEW.etapa_financeiro)
    );
  END IF;

  -- valor (inclui Método Trevo, editar valor)
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'valor',
      to_jsonb(OLD.valor), to_jsonb(NEW.valor)
    );
  END IF;

  -- data_pagamento
  IF NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'data_pagamento',
      to_jsonb(OLD.data_pagamento), to_jsonb(NEW.data_pagamento)
    );
  END IF;

  -- confirmado_recebimento
  IF NEW.confirmado_recebimento IS DISTINCT FROM OLD.confirmado_recebimento THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'confirmado_recebimento',
      to_jsonb(OLD.confirmado_recebimento), to_jsonb(NEW.confirmado_recebimento)
    );
  END IF;

  -- contestacao_motivo (abertura de contestação)
  IF NEW.contestacao_motivo IS DISTINCT FROM OLD.contestacao_motivo THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'contestacao_motivo',
      to_jsonb(OLD.contestacao_motivo), to_jsonb(NEW.contestacao_motivo)
    );
  END IF;

  -- auditado (checklist de Carolina)
  IF NEW.auditado IS DISTINCT FROM OLD.auditado THEN
    PERFORM public._auditoria_gravar(
      NEW.empresa_id, 'lancamento', NEW.id, 'auditado',
      to_jsonb(OLD.auditado), to_jsonb(NEW.auditado)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_audit_lancamentos
  AFTER UPDATE ON public.lancamentos
  FOR EACH ROW
  EXECUTE FUNCTION public._audit_lancamentos_trigger();

-- ---------------------------------------------
-- 6) RPC pra consultar histórico de uma entidade
-- ---------------------------------------------
-- Útil pra UI futura "Ver histórico desta cobrança/lançamento"
CREATE OR REPLACE FUNCTION public.get_historico_financeiro(
  p_entidade    TEXT,
  p_entidade_id UUID,
  p_limit       INTEGER DEFAULT 50
)
RETURNS TABLE (
  id           BIGINT,
  campo        TEXT,
  valor_antigo JSONB,
  valor_novo   JSONB,
  ator_tipo    TEXT,
  ator_nome    TEXT,
  ator_role    TEXT,
  criado_em    TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Garante isolamento: empresa do registro == empresa do caller
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_auditoria
     WHERE entidade = p_entidade
       AND entidade_id = p_entidade_id
       AND (empresa_id = public.get_empresa_id() OR empresa_id IS NULL)
     LIMIT 1
  ) THEN
    RETURN; -- nada encontrado ou empresa errada
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.campo,
    a.valor_antigo,
    a.valor_novo,
    a.ator_tipo,
    COALESCE(p.nome, p.email, a.ator_id::text) AS ator_nome,
    a.ator_role,
    a.criado_em
  FROM public.financeiro_auditoria a
  LEFT JOIN public.profiles p ON p.id = a.ator_id
  WHERE a.entidade = p_entidade
    AND a.entidade_id = p_entidade_id
    AND (a.empresa_id = public.get_empresa_id() OR a.empresa_id IS NULL)
  ORDER BY a.criado_em DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_historico_financeiro(TEXT, UUID, INTEGER) TO authenticated;
