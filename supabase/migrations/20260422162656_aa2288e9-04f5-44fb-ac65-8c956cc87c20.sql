-- Migration 16: Audit trail Financeiro

CREATE TABLE IF NOT EXISTS public.financeiro_auditoria (
  id BIGSERIAL PRIMARY KEY,
  empresa_id UUID,
  entidade TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_antigo JSONB,
  valor_novo JSONB,
  ator_tipo TEXT NOT NULL,
  ator_id UUID,
  ator_role TEXT,
  motivo TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.financeiro_auditoria IS
  'Histórico de mudanças em cobrancas e lancamentos. Append-only.';

CREATE INDEX IF NOT EXISTS idx_auditoria_entidade
  ON public.financeiro_auditoria(entidade, entidade_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_empresa
  ON public.financeiro_auditoria(empresa_id, criado_em DESC) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auditoria_ator
  ON public.financeiro_auditoria(ator_id, criado_em DESC) WHERE ator_id IS NOT NULL;

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_master_read" ON public.financeiro_auditoria;
CREATE POLICY "auditoria_master_read" ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND public.get_user_role() IN ('master', 'gerente'));

DROP POLICY IF EXISTS "auditoria_self_read" ON public.financeiro_auditoria;
CREATE POLICY "auditoria_self_read" ON public.financeiro_auditoria
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id() AND ator_id = auth.uid());

CREATE OR REPLACE FUNCTION public._auditoria_gravar(
  p_empresa_id UUID, p_entidade TEXT, p_entidade_id UUID,
  p_campo TEXT, p_valor_antigo JSONB, p_valor_novo JSONB
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF p_valor_antigo IS NOT DISTINCT FROM p_valor_novo THEN RETURN; END IF;
  BEGIN v_role := public.get_user_role(); EXCEPTION WHEN OTHERS THEN v_role := NULL; END;
  INSERT INTO public.financeiro_auditoria (
    empresa_id, entidade, entidade_id, campo, valor_antigo, valor_novo,
    ator_tipo, ator_id, ator_role
  ) VALUES (
    p_empresa_id, p_entidade, p_entidade_id, p_campo, p_valor_antigo, p_valor_novo,
    CASE WHEN v_uid IS NULL THEN 'system' ELSE 'user' END, v_uid, v_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._audit_cobrancas_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'status', to_jsonb(OLD.status), to_jsonb(NEW.status));
  END IF;
  IF NEW.total_geral IS DISTINCT FROM OLD.total_geral THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'total_geral', to_jsonb(OLD.total_geral), to_jsonb(NEW.total_geral));
  END IF;
  IF NEW.data_vencimento IS DISTINCT FROM OLD.data_vencimento THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'data_vencimento', to_jsonb(OLD.data_vencimento), to_jsonb(NEW.data_vencimento));
  END IF;
  IF NEW.data_expiracao IS DISTINCT FROM OLD.data_expiracao THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'data_expiracao', to_jsonb(OLD.data_expiracao), to_jsonb(NEW.data_expiracao));
  END IF;
  IF NEW.asaas_payment_id IS DISTINCT FROM OLD.asaas_payment_id THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'asaas_payment_id', to_jsonb(OLD.asaas_payment_id), to_jsonb(NEW.asaas_payment_id));
  END IF;
  IF NEW.asaas_status IS DISTINCT FROM OLD.asaas_status THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'asaas_status', to_jsonb(OLD.asaas_status), to_jsonb(NEW.asaas_status));
  END IF;
  IF NEW.share_token IS DISTINCT FROM OLD.share_token THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'cobranca', NEW.id, 'share_token_rotacionado', to_jsonb(OLD.updated_at), to_jsonb(NEW.updated_at));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_cobrancas ON public.cobrancas;
CREATE TRIGGER trg_audit_cobrancas
  AFTER UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public._audit_cobrancas_trigger();

CREATE OR REPLACE FUNCTION public._audit_lancamentos_trigger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'status', to_jsonb(OLD.status), to_jsonb(NEW.status));
  END IF;
  IF NEW.etapa_financeiro IS DISTINCT FROM OLD.etapa_financeiro THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'etapa_financeiro', to_jsonb(OLD.etapa_financeiro), to_jsonb(NEW.etapa_financeiro));
  END IF;
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'valor', to_jsonb(OLD.valor), to_jsonb(NEW.valor));
  END IF;
  IF NEW.data_pagamento IS DISTINCT FROM OLD.data_pagamento THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'data_pagamento', to_jsonb(OLD.data_pagamento), to_jsonb(NEW.data_pagamento));
  END IF;
  IF NEW.confirmado_recebimento IS DISTINCT FROM OLD.confirmado_recebimento THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'confirmado_recebimento', to_jsonb(OLD.confirmado_recebimento), to_jsonb(NEW.confirmado_recebimento));
  END IF;
  IF NEW.contestacao_motivo IS DISTINCT FROM OLD.contestacao_motivo THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'contestacao_motivo', to_jsonb(OLD.contestacao_motivo), to_jsonb(NEW.contestacao_motivo));
  END IF;
  IF NEW.auditado IS DISTINCT FROM OLD.auditado THEN
    PERFORM public._auditoria_gravar(NEW.empresa_id, 'lancamento', NEW.id, 'auditado', to_jsonb(OLD.auditado), to_jsonb(NEW.auditado));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_audit_lancamentos
  AFTER UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public._audit_lancamentos_trigger();

CREATE OR REPLACE FUNCTION public.get_historico_financeiro(
  p_entidade TEXT, p_entidade_id UUID, p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT, campo TEXT, valor_antigo JSONB, valor_novo JSONB,
  ator_tipo TEXT, ator_nome TEXT, ator_role TEXT, criado_em TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.financeiro_auditoria
     WHERE entidade = p_entidade AND entidade_id = p_entidade_id
       AND (empresa_id = public.get_empresa_id() OR empresa_id IS NULL)
     LIMIT 1
  ) THEN RETURN; END IF;

  RETURN QUERY
  SELECT a.id, a.campo, a.valor_antigo, a.valor_novo, a.ator_tipo,
    COALESCE(p.nome, p.email, a.ator_id::text) AS ator_nome, a.ator_role, a.criado_em
  FROM public.financeiro_auditoria a
  LEFT JOIN public.profiles p ON p.id = a.ator_id
  WHERE a.entidade = p_entidade AND a.entidade_id = p_entidade_id
    AND (a.empresa_id = public.get_empresa_id() OR a.empresa_id IS NULL)
  ORDER BY a.criado_em DESC
  LIMIT GREATEST(p_limit, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_historico_financeiro(TEXT, UUID, INTEGER) TO authenticated;

-- Fix do warning da migration 15: search_path em _empresas_config_touch_updated_at
CREATE OR REPLACE FUNCTION public._empresas_config_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;