--
-- PostgreSQL database dump
--

\restrict tCrPjmM5n8PhYvjAlLRFe175g56nt3oYay3ZRXZxTWPpF0eRI7VITKfZDr65uMN

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.9

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', 'public', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: status_financeiro; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.status_financeiro AS ENUM (
    'pendente',
    'pago',
    'atrasado',
    'cancelado'
);


--
-- Name: tipo_cliente; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_cliente AS ENUM (
    'MENSALISTA',
    'AVULSO_4D',
    'PRE_PAGO'
);


--
-- Name: tipo_lancamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_lancamento AS ENUM (
    'receber',
    'pagar'
);


--
-- Name: tipo_processo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.tipo_processo AS ENUM (
    'abertura',
    'alteracao',
    'transformacao',
    'baixa',
    'avulso',
    'orcamento'
);


--
-- Name: via_analise; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.via_analise AS ENUM (
    'matriz',
    'regional',
    'metodo_trevo'
);


--
-- Name: _audit_cobrancas_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._audit_cobrancas_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: _audit_lancamentos_trigger(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._audit_lancamentos_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: _auditoria_gravar(uuid, text, uuid, text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._auditoria_gravar(p_empresa_id uuid, p_entidade text, p_entidade_id uuid, p_campo text, p_valor_antigo jsonb, p_valor_novo jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: _bloqueia_avanco_aguardando_deferimento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._bloqueia_avanco_aguardando_deferimento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_etapas_cobranca TEXT[] := ARRAY['cobranca_gerada', 'cobranca_enviada', 'aguardando_pagamento'];
BEGIN
  IF NEW.etapa_financeiro = OLD.etapa_financeiro THEN
    RETURN NEW;
  END IF;
  IF OLD.etapa_financeiro = 'aguardando_deferimento'
     AND NEW.etapa_financeiro = ANY(v_etapas_cobranca) THEN
    RAISE EXCEPTION 'Marque o processo como deferido antes de avançar pra cobrança.'
      USING ERRCODE = 'check_violation',
            HINT = 'Use a ação "Marcar como deferido" no processo. Isso promove o lançamento automaticamente.';
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _bloqueia_cobranca_sem_reembolso(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._bloqueia_cobranca_sem_reembolso() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
  v_etapas_cobranca TEXT[] := ARRAY['cobranca_gerada', 'cobranca_enviada', 'aguardando_pagamento'];
BEGIN
  IF NEW.etapa_financeiro = OLD.etapa_financeiro THEN RETURN NEW; END IF;
  IF NOT (NEW.etapa_financeiro = ANY(v_etapas_cobranca)) THEN RETURN NEW; END IF;
  IF OLD.etapa_financeiro = 'aguardando_deferimento' THEN
    RAISE EXCEPTION 'Marque o processo como deferido antes de avançar pra cobrança.'
      USING ERRCODE = 'check_violation',
            HINT = 'Use a ação "Marcar como deferido" no processo.';
  END IF;
  IF NEW.processo_id IS NULL THEN RETURN NEW; END IF;
  v_result := public.pode_avancar_cobranca(NEW.processo_id);
  IF (v_result->>'pode')::BOOLEAN THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Cobrança bloqueada: %', v_result->>'motivo'
    USING ERRCODE = 'check_violation',
          HINT = 'Adicione os Valores Adicionais pendentes no processo antes de avançar.',
          DETAIL = v_result::text;
END;
$$;


--
-- Name: _cobranca_preenche_expiracao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._cobranca_preenche_expiracao() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.data_expiracao IS NULL THEN
    IF NEW.data_vencimento IS NOT NULL THEN
      NEW.data_expiracao := (NEW.data_vencimento + INTERVAL '60 days')::TIMESTAMPTZ;
    ELSE
      NEW.data_expiracao := COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _empresas_config_touch_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._empresas_config_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


--
-- Name: _log_acesso_publico(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._log_acesso_publico(p_tipo text, p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_hash TEXT;
  v_count INTEGER;
BEGIN
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  SELECT COUNT(*) INTO v_count
    FROM public.acessos_publicos_log
   WHERE token_hash = v_hash
     AND acessado_em > NOW() - INTERVAL '5 minutes';

  IF v_count > 60 THEN
    RAISE EXCEPTION 'Rate limit excedido. Tente novamente em alguns minutos.'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.acessos_publicos_log (tipo, token_hash)
  VALUES (p_tipo, v_hash);
EXCEPTION
  WHEN OTHERS THEN
    IF SQLSTATE = 'check_violation' THEN
      RAISE;
    END IF;
END;
$$;


--
-- Name: _orcamento_preenche_expiracao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._orcamento_preenche_expiracao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.data_expiracao IS NULL
     AND NEW.status IN ('enviado', 'aguardando_pagamento')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.data_expiracao := NOW() + (COALESCE(NEW.validade_dias, 15) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: _sync_cobranca_lancamentos_junction(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._sync_cobranca_lancamentos_junction() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.cobrancas_lancamentos
    WHERE cobranca_id = NEW.id
      AND lancamento_id <> ALL(COALESCE(NEW.lancamento_ids, ARRAY[]::UUID[]));
  END IF;

  IF NEW.lancamento_ids IS NOT NULL AND array_length(NEW.lancamento_ids, 1) > 0 THEN
    INSERT INTO public.cobrancas_lancamentos (cobranca_id, lancamento_id, empresa_id)
    SELECT NEW.id, lid, NEW.empresa_id
    FROM UNNEST(NEW.lancamento_ids) AS lid
    ON CONFLICT (cobranca_id, lancamento_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: _validate_cobranca_lancamento_ids(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._validate_cobranca_lancamento_ids() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count_total INTEGER;
  v_count_match INTEGER;
BEGIN
  IF NEW.lancamento_ids IS NULL OR array_length(NEW.lancamento_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  v_count_total := array_length(NEW.lancamento_ids, 1);

  SELECT COUNT(*) INTO v_count_match
  FROM public.lancamentos
  WHERE id = ANY(NEW.lancamento_ids)
    AND empresa_id = NEW.empresa_id;

  IF v_count_match <> v_count_total THEN
    RAISE EXCEPTION 'lancamento_ids contém UUIDs inválidos ou de outra empresa (esperado %, válidos %)',
      v_count_total, v_count_match
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: alterar_valor_lancamento(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.alterar_valor_lancamento(p_lancamento_id uuid, p_novo_valor numeric, p_valor_atual numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_processo_id UUID;
  v_valor_original NUMERIC;
  v_user UUID;
  v_role TEXT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  v_user := auth.uid();
  v_role := public.get_user_role();

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'usuário não autenticado' USING ERRCODE = '42501';
  END IF;

  IF v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'sem permissão para alterar valor' USING ERRCODE = '42501';
  END IF;

  IF p_novo_valor IS NULL OR p_novo_valor < 0 THEN
    RAISE EXCEPTION 'valor inválido' USING ERRCODE = '22023';
  END IF;

  SELECT processo_id, valor_original
    INTO v_processo_id, v_valor_original
    FROM public.lancamentos
   WHERE id = p_lancamento_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lançamento não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_processo_id IS NOT NULL THEN
    UPDATE public.processos
       SET valor = p_novo_valor,
           updated_at = v_now
     WHERE id = v_processo_id;
  END IF;

  UPDATE public.lancamentos
     SET valor = p_novo_valor,
         valor_original = COALESCE(v_valor_original, p_valor_atual),
         valor_alterado_por = v_user,
         valor_alterado_em = v_now,
         updated_at = v_now
   WHERE id = p_lancamento_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lancamento_id', p_lancamento_id,
    'processo_id', v_processo_id,
    'valor_anterior', p_valor_atual,
    'valor_novo', p_novo_valor
  );
END;
$$;


--
-- Name: arquivar_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.arquivar_cliente(p_cliente_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
  v_empresa UUID;
  v_cli_empresa UUID;
BEGIN
  SELECT role, empresa_id INTO v_role, v_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'Permissão negada para arquivar cliente'
      USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_cli_empresa
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_cli_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_cli_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.clientes
  SET is_archived = TRUE, updated_at = NOW()
  WHERE id = p_cliente_id;

  UPDATE public.processos
  SET is_archived = TRUE, updated_at = NOW()
  WHERE cliente_id = p_cliente_id;
END;
$$;


--
-- Name: asaas_tentar_lock_cobranca(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.asaas_tentar_lock_cobranca(p_cobranca_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row            RECORD;
  v_now            TIMESTAMPTZ := NOW();
  v_lock_duration  INTERVAL    := '60 seconds';
  v_updated_count  INTEGER;
BEGIN
  UPDATE public.cobrancas
     SET asaas_gerando_lock_ate = v_now + v_lock_duration
   WHERE id = p_cobranca_id
     AND asaas_payment_id IS NULL
     AND status NOT IN ('paga', 'cancelada')
     AND (asaas_gerando_lock_ate IS NULL OR asaas_gerando_lock_ate < v_now);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 1 THEN
    RETURN jsonb_build_object('acquired', true);
  END IF;

  SELECT asaas_payment_id, asaas_gerando_lock_ate, status
    INTO v_row
    FROM public.cobrancas
   WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'not_found');
  END IF;

  IF v_row.status IN ('paga', 'cancelada') THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'wrong_status',
      'status', v_row.status
    );
  END IF;

  IF v_row.asaas_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'already_generated',
      'asaas_payment_id', v_row.asaas_payment_id
    );
  END IF;

  RETURN jsonb_build_object(
    'acquired', false,
    'reason', 'in_progress',
    'locked_until', v_row.asaas_gerando_lock_ate
  );
END;
$$;


--
-- Name: atualizar_proposta_por_token(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.atualizar_proposta_por_token(p_token text, p_status text, p_motivo text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
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


--
-- Name: calcular_preco_processo(uuid, tipo_processo); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_preco_processo(p_cliente_id uuid, p_tipo tipo_processo) RETURNS numeric
    LANGUAGE plpgsql STABLE
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
  -- Count same-month processes for this client
  SELECT COUNT(*) INTO v_count
  FROM public.processos
  WHERE cliente_id = p_cliente_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', NOW());
  v_desconto := COALESCE(v_cliente.desconto_progressivo, 0);
  -- Compounding discount: each subsequent process applies discount to previous value
  IF v_count > 0 AND v_desconto > 0 THEN
    v_preco := v_base;
    FOR v_i IN 1..v_count LOOP
      v_preco := v_preco * (1 - v_desconto / 100.0);
    END LOOP;
    -- Apply floor limit
    IF v_cliente.valor_limite_desconto IS NOT NULL AND v_preco < v_cliente.valor_limite_desconto THEN
      v_preco := v_cliente.valor_limite_desconto;
    END IF;
  ELSE
    v_preco := v_base;
  END IF;
  RETURN GREATEST(v_preco, 0);
END;
$$;


--
-- Name: calcular_vencimento(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calcular_vencimento(p_cliente_id uuid) RETURNS date
    LANGUAGE plpgsql STABLE
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


--
-- Name: criar_evento_proposta(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.criar_evento_proposta(p_orcamento_id uuid, p_tipo text, p_dados jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.orcamentos WHERE id = p_orcamento_id;
  
  IF v_empresa_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO public.proposta_eventos (orcamento_id, tipo, dados, empresa_id)
  VALUES (p_orcamento_id, p_tipo, p_dados, v_empresa_id);
END;
$$;


--
-- Name: criar_notificacao_proposta(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.criar_notificacao_proposta(p_orcamento_id uuid, p_tipo text, p_mensagem text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_empresa_id uuid;
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


--
-- Name: criar_processo_com_lancamento(uuid, text, text, text, text, numeric, text, timestamp with time zone, boolean, numeric, text, text[], boolean, text, boolean, date, date, boolean, numeric, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.criar_processo_com_lancamento(p_cliente_id uuid, p_razao_social text, p_tipo text, p_prioridade text DEFAULT 'normal'::text, p_responsavel text DEFAULT NULL::text, p_valor numeric DEFAULT 0, p_notas text DEFAULT NULL::text, p_created_at timestamp with time zone DEFAULT now(), p_dentro_do_plano boolean DEFAULT NULL::boolean, p_valor_avulso numeric DEFAULT 0, p_justificativa_avulso text DEFAULT NULL::text, p_etiquetas text[] DEFAULT '{}'::text[], p_criar_lancamento boolean DEFAULT true, p_descricao_lancamento text DEFAULT ''::text, p_ja_pago boolean DEFAULT false, p_data_vencimento date DEFAULT NULL::date, p_data_lancamento date DEFAULT NULL::date, p_criar_avulso_extra boolean DEFAULT false, p_valor_avulso_extra numeric DEFAULT 0, p_descricao_avulso_extra text DEFAULT ''::text, p_via_analise text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_processo_id UUID;
  v_empresa_id UUID;
  v_cliente_empresa UUID;
  v_lanc_date DATE;
  v_momento_faturamento TEXT;
  v_etapa_lanc TEXT;
  v_venc_lanc DATE;
BEGIN
  v_empresa_id := public.get_empresa_id();
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não possui empresa associada';
  END IF;

  SELECT empresa_id, COALESCE(momento_faturamento, 'na_solicitacao')
    INTO v_cliente_empresa, v_momento_faturamento
    FROM public.clientes
   WHERE id = p_cliente_id;

  IF v_cliente_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;
  IF v_cliente_empresa != v_empresa_id THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  INSERT INTO public.processos (
    cliente_id, razao_social, tipo, prioridade, responsavel, valor, notas,
    created_at, dentro_do_plano, valor_avulso, justificativa_avulso, etiquetas,
    empresa_id, etapa
  )
  VALUES (
    p_cliente_id, p_razao_social, p_tipo::public.tipo_processo, p_prioridade,
    p_responsavel, p_valor, p_notas, p_created_at, p_dentro_do_plano,
    p_valor_avulso, p_justificativa_avulso, p_etiquetas, v_empresa_id,
    CASE WHEN p_ja_pago THEN 'finalizados' ELSE 'recebidos' END
  )
  RETURNING id INTO v_processo_id;

  -- Grava via_analise se a coluna existir
  IF p_via_analise IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'processos' AND column_name = 'via_analise'
  ) THEN
    EXECUTE format('UPDATE public.processos SET via_analise = %L WHERE id = %L', p_via_analise, v_processo_id);
  END IF;

  IF p_criar_lancamento THEN
    v_lanc_date := COALESCE(p_data_lancamento, CURRENT_DATE);
    IF p_ja_pago THEN
      v_etapa_lanc := 'honorario_pago';
      v_venc_lanc := v_lanc_date;
    ELSIF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := NULL;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, data_pagamento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_lancamento, p_valor,
      CASE WHEN p_ja_pago THEN 'pago'::public.status_financeiro ELSE 'pendente'::public.status_financeiro END,
      v_venc_lanc,
      CASE WHEN p_ja_pago THEN v_lanc_date ELSE NULL END,
      p_created_at,
      v_etapa_lanc,
      v_empresa_id
    );
  END IF;

  IF p_criar_avulso_extra AND p_valor_avulso_extra > 0 THEN
    IF v_momento_faturamento = 'no_deferimento' THEN
      v_etapa_lanc := 'aguardando_deferimento';
      v_venc_lanc := NULL;
    ELSE
      v_etapa_lanc := 'solicitacao_criada';
      v_venc_lanc := COALESCE(p_data_vencimento, public.calcular_vencimento(p_cliente_id));
    END IF;

    INSERT INTO public.lancamentos (
      tipo, cliente_id, processo_id, descricao, valor, status,
      data_vencimento, created_at, etapa_financeiro, empresa_id
    )
    VALUES (
      'receber'::public.tipo_lancamento, p_cliente_id, v_processo_id,
      p_descricao_avulso_extra, p_valor_avulso_extra,
      'pendente'::public.status_financeiro,
      v_venc_lanc, p_created_at, v_etapa_lanc, v_empresa_id
    );
  END IF;

  RETURN v_processo_id;
END;
$$;


--
-- Name: desarquivar_cliente(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.desarquivar_cliente(p_cliente_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_role TEXT;
  v_empresa UUID;
  v_cli_empresa UUID;
BEGIN
  SELECT role, empresa_id INTO v_role, v_empresa
  FROM public.profiles WHERE id = auth.uid();

  IF v_role IS NULL OR v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'Permissão negada' USING ERRCODE = '42501';
  END IF;

  SELECT empresa_id INTO v_cli_empresa
  FROM public.clientes WHERE id = p_cliente_id;

  IF v_cli_empresa IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_cli_empresa <> v_empresa THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.clientes
  SET is_archived = FALSE, updated_at = NOW()
  WHERE id = p_cliente_id;

  UPDATE public.processos
  SET is_archived = FALSE, updated_at = NOW()
  WHERE cliente_id = p_cliente_id;
END;
$$;


--
-- Name: get_cobranca_por_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cobranca_por_token(p_token text) RETURNS TABLE(id uuid, cliente_nome text, cliente_apelido text, cliente_cnpj text, cliente_nome_contador text, total_honorarios numeric, total_taxas numeric, total_geral numeric, data_vencimento date, status text, created_at timestamp with time zone, lancamentos jsonb, empresa_config jsonb, asaas jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public._log_acesso_publico('cobranca', p_token);

  RETURN QUERY
  SELECT
    cb.id,
    cl.nome,
    cl.apelido,
    cl.cnpj,
    cl.nome_contador,
    cb.total_honorarios,
    cb.total_taxas,
    cb.total_geral,
    cb.data_vencimento,
    cb.status,
    cb.created_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'descricao', l.descricao,
        'valor', l.valor,
        'razao_social', p.razao_social,
        'tipo_processo', p.tipo,
        'comprovante_url', l.comprovante_url,
        'observacoes_processo', p.notas,
        'observacoes_financeiro', l.observacoes_financeiro,
        'taxas', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'descricao', va.descricao,
            'valor', va.valor,
            'categoria', va.categoria,
            'comprovante_url', va.comprovante_url
          )) FROM public.valores_adicionais va WHERE va.processo_id = p.id
        ), '[]'::jsonb)
      ) ORDER BY p.razao_social)
      FROM public.lancamentos l
      LEFT JOIN public.processos p ON p.id = l.processo_id
      WHERE l.id = ANY(cb.lancamento_ids)
    ), '[]'::jsonb) as lancamentos,
    public.resolve_empresa_config(cb.empresa_id) as empresa_config,
    CASE
      WHEN cb.asaas_payment_id IS NOT NULL THEN
        jsonb_build_object(
          'payment_id', cb.asaas_payment_id,
          'status', cb.asaas_status,
          'invoice_url', cb.asaas_invoice_url,
          'boleto_url', cb.asaas_boleto_url,
          'boleto_barcode', cb.asaas_boleto_barcode,
          'pix_qrcode', cb.asaas_pix_qrcode,
          'pix_payload', cb.asaas_pix_payload,
          'gerado_em', cb.asaas_gerado_em,
          'pago_em', cb.asaas_pago_em
        )
      ELSE NULL
    END as asaas
  FROM public.cobrancas cb
  JOIN public.clientes cl ON cl.id = cb.cliente_id
  WHERE cb.share_token = p_token
    AND cb.status IN ('ativa', 'vencida', 'paga')
    AND (cb.data_expiracao IS NULL OR cb.data_expiracao > NOW());
END;
$$;


--
-- Name: get_empresa_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_empresa_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;


--
-- Name: get_historico_financeiro(text, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_historico_financeiro(p_entidade text, p_entidade_id uuid, p_limit integer DEFAULT 50) RETURNS TABLE(id bigint, campo text, valor_antigo jsonb, valor_novo jsonb, ator_tipo text, ator_nome text, ator_role text, criado_em timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: get_proposta_por_token(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_proposta_por_token(p_token text) RETURNS TABLE(id uuid, numero integer, prospect_nome text, prospect_cnpj text, prospect_email text, prospect_telefone text, prospect_contato text, tipo_contrato text, servicos jsonb, naturezas jsonb, escopo jsonb, valor_base numeric, valor_final numeric, desconto_pct numeric, qtd_processos integer, status text, share_token text, created_at timestamp with time zone, updated_at timestamp with time zone, pdf_url text, observacoes text, validade_dias integer, pagamento text, sla text, prazo_execucao text, ordem_execucao text, contexto text, destinatario text, secoes jsonb, pacotes jsonb, etapas_fluxo jsonb, riscos jsonb, cenarios jsonb, cenario_selecionado text, headline_cenario text, beneficios_capa jsonb, desconto_progressivo_ativo boolean, desconto_progressivo_pct numeric, desconto_progressivo_limite numeric, aprovado_em timestamp with time zone, enviado_em timestamp with time zone, recusado_em timestamp with time zone, observacoes_recusa text, convertido_em timestamp with time zone, pago_em timestamp with time zone, contrato_assinado_url text, clicksign_document_key text, itens_selecionados jsonb, prazo_pagamento_dias integer, empresa_id uuid, cliente_id uuid, created_by text, has_password boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public._log_acesso_publico('proposta', p_token);

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
    o.pago_em, o.contrato_assinado_url,
    o.clicksign_document_key, o.itens_selecionados,
    o.prazo_pagamento_dias, o.empresa_id, o.cliente_id, o.created_by,
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password
  FROM public.orcamentos o
  WHERE o.share_token = p_token
    AND o.status IN ('enviado', 'aguardando_pagamento')
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$$;


--
-- Name: get_user_empresa_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_empresa_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_empresa_id UUID;
  v_total_empresas INTEGER;
BEGIN
  v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::UUID;

  IF v_empresa_id IS NULL THEN
    SELECT COUNT(DISTINCT empresa_id) INTO v_total_empresas
      FROM public.profiles
     WHERE empresa_id IS NOT NULL;

    IF v_total_empresas = 1 THEN
      SELECT DISTINCT empresa_id INTO v_empresa_id
        FROM public.profiles
       WHERE empresa_id IS NOT NULL
       LIMIT 1;
    END IF;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'empresa_id ausente no signup e ambiente é multi-tenant (% empresas). Convide via tela admin.', v_total_empresas
      USING HINT = 'Use /admin para convidar usuários — passe empresa_id no metadata.';
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


--
-- Name: FUNCTION handle_new_user(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_user() IS 'Single-tenant: usa única empresa do banco se metadata vazio. Multi-tenant: exige empresa_id no metadata. Audit fix #20.';


--
-- Name: hash_master_password(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hash_master_password(p_password text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'extensions'
    AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf', 12));
$$;


--
-- Name: mark_cobranca_visualizada(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mark_cobranca_visualizada(p_token text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.cobrancas c
  SET visualizada_em = COALESCE(c.visualizada_em, NOW())
  WHERE c.share_token = p_token AND c.status IN ('ativa', 'vencida');
END;
$$;


--
-- Name: pode_avancar_cobranca(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pode_avancar_cobranca(p_processo_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
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
  SELECT EXISTS (
    SELECT 1 FROM public.valores_adicionais
     WHERE processo_id = p_processo_id AND categoria = 'taxa_balcao'
       AND valor > 0 AND comprovante_url IS NOT NULL AND reembolsavel = TRUE
  ) INTO v_tem_balcao;
  IF NOT v_tem_balcao THEN
    v_faltando := array_append(v_faltando, 'taxa_balcao');
  END IF;
  IF v_via = 'metodo_trevo' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.valores_adicionais
       WHERE processo_id = p_processo_id AND categoria = 'honorario_metodo_trevo' AND valor > 0
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
    'faltando', v_faltando, 'via', v_via::TEXT
  );
END;
$$;


--
-- Name: promover_lancamento_ao_deferir(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promover_lancamento_ao_deferir(p_processo_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_lanc_id UUID;
  v_processo RECORD;
  v_vencimento DATE;
  v_empresa_caller UUID;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  SELECT p.id, p.cliente_id, p.razao_social, p.tipo, p.valor, p.empresa_id
    INTO v_processo
    FROM public.processos p
   WHERE p.id = p_processo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_nao_encontrado');
  END IF;
  IF v_processo.empresa_id <> v_empresa_caller THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'processo_outra_empresa');
  END IF;

  SELECT id INTO v_lanc_id
    FROM public.lancamentos
   WHERE processo_id = p_processo_id
     AND tipo = 'receber'
     AND etapa_financeiro = 'aguardando_deferimento'
   ORDER BY created_at
   LIMIT 1
   FOR UPDATE;

  v_vencimento := public.calcular_vencimento(v_processo.cliente_id);

  IF v_lanc_id IS NOT NULL THEN
    UPDATE public.lancamentos
       SET etapa_financeiro = 'solicitacao_criada',
           data_vencimento = v_vencimento,
           updated_at = NOW()
     WHERE id = v_lanc_id;
    RETURN jsonb_build_object('ok', true, 'acao', 'promovido', 'lancamento_id', v_lanc_id);
  END IF;

  INSERT INTO public.lancamentos (
    tipo, cliente_id, processo_id, descricao, valor, status,
    data_vencimento, created_at, etapa_financeiro, empresa_id
  )
  VALUES (
    'receber'::public.tipo_lancamento,
    v_processo.cliente_id,
    p_processo_id,
    INITCAP(v_processo.tipo::text) || ' - ' || v_processo.razao_social || ' (Deferido)',
    COALESCE(v_processo.valor, 0),
    'pendente'::public.status_financeiro,
    v_vencimento,
    NOW(),
    'solicitacao_criada',
    v_processo.empresa_id
  )
  RETURNING id INTO v_lanc_id;

  RETURN jsonb_build_object('ok', true, 'acao', 'criado', 'lancamento_id', v_lanc_id);
END;
$$;


--
-- Name: register_master_password_attempt(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.register_master_password_attempt(p_user_id uuid, p_ip text, p_success boolean) RETURNS TABLE(allowed boolean, recent_failures integer, retry_after_seconds integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count_user_1h INTEGER;
  v_count_ip_1h INTEGER;
  v_oldest_ts TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_retry INTEGER;
BEGIN
  INSERT INTO public.master_password_attempts (user_id, ip, success)
  VALUES (p_user_id, p_ip, p_success);

  SELECT COUNT(*) INTO v_count_user_1h
    FROM public.master_password_attempts
   WHERE user_id = p_user_id
     AND success = FALSE
     AND attempted_at > NOW() - INTERVAL '60 minutes';

  SELECT COUNT(*) INTO v_count_ip_1h
    FROM public.master_password_attempts
   WHERE ip IS NOT NULL
     AND ip = p_ip
     AND success = FALSE
     AND attempted_at > NOW() - INTERVAL '60 minutes';

  v_allowed := v_count_user_1h < 5 AND v_count_ip_1h < 10;

  IF NOT v_allowed THEN
    SELECT MIN(attempted_at) INTO v_oldest_ts
      FROM public.master_password_attempts
     WHERE (user_id = p_user_id OR ip = p_ip)
       AND success = FALSE
       AND attempted_at > NOW() - INTERVAL '60 minutes';
    v_retry := GREATEST(
      0,
      EXTRACT(EPOCH FROM (v_oldest_ts + INTERVAL '60 minutes' - NOW()))::INTEGER
    );
  ELSE
    v_retry := 0;
  END IF;

  RETURN QUERY SELECT
    v_allowed,
    GREATEST(v_count_user_1h, v_count_ip_1h),
    v_retry;
END;
$$;


--
-- Name: resolve_empresa_config(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_empresa_config(p_empresa_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_row public.empresas_config%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.empresas_config WHERE empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'nome', 'TREVO LEGALIZA LTDA',
      'cnpj', '39.969.412/0001-70',
      'pix_chave', '39.969.412/0001-70',
      'pix_banco', 'C6 Bank',
      'whatsapp', '5511934927001',
      'site', 'trevolegaliza.com.br'
    );
  END IF;

  RETURN jsonb_build_object(
    'nome', COALESCE(v_row.razao_social, ''),
    'cnpj', COALESCE(v_row.cnpj, ''),
    'pix_chave', COALESCE(v_row.pix_chave, ''),
    'pix_banco', COALESCE(v_row.pix_banco, ''),
    'whatsapp', COALESCE(v_row.whatsapp, ''),
    'site', COALESCE(v_row.site, '')
  );
END;
$$;


--
-- Name: reverter_boas_vindas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reverter_boas_vindas(p_cliente_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = false,
         updated_at = NOW()
   WHERE id = p_cliente_id
     AND empresa_id = public.get_empresa_id();
END;
$$;


--
-- Name: rotacionar_cobranca_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rotacionar_cobranca_token(p_cobranca_id uuid) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_novo_token TEXT;
  v_empresa_user UUID;
  v_empresa_cobr UUID;
  v_role TEXT;
BEGIN
  v_empresa_user := public.get_empresa_id();
  v_role := public.get_user_role();

  IF v_empresa_user IS NULL THEN
    RAISE EXCEPTION 'usuário sem empresa_id';
  END IF;

  IF v_role NOT IN ('master', 'gerente', 'financeiro') THEN
    RAISE EXCEPTION 'sem permissão para rotacionar token';
  END IF;

  SELECT empresa_id INTO v_empresa_cobr
    FROM public.cobrancas
   WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cobrança não encontrada';
  END IF;

  IF v_empresa_cobr <> v_empresa_user THEN
    RAISE EXCEPTION 'cobrança não pertence à sua empresa';
  END IF;

  v_novo_token := encode(extensions.gen_random_bytes(24), 'hex');

  UPDATE public.cobrancas
     SET share_token     = v_novo_token,
         data_expiracao  = NULL
   WHERE id = p_cobranca_id;

  RETURN v_novo_token;
END;
$$;


--
-- Name: salvar_selecao_proposta(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.salvar_selecao_proposta(p_token text, p_itens_selecionados jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
  v_status TEXT;
BEGIN
  SELECT id, status INTO v_id, v_status
  FROM orcamentos
  WHERE share_token = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_status NOT IN ('rascunho', 'enviado') THEN
    RETURN FALSE;
  END IF;

  UPDATE orcamentos
  SET itens_selecionados = p_itens_selecionados,
      updated_at = NOW()
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION salvar_selecao_proposta(p_token text, p_itens_selecionados jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.salvar_selecao_proposta(p_token text, p_itens_selecionados jsonb) IS 'Salva a seleção de itens de uma proposta pública via token. Retorna TRUE se sucesso, FALSE caso contrário.';


--
-- Name: set_master_password_hash(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_master_password_hash(p_hash text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF get_user_role() <> 'master' THEN
    RAISE EXCEPTION 'apenas master pode alterar senha master';
  END IF;
  IF p_hash IS NULL OR length(p_hash) < 30 THEN
    RAISE EXCEPTION 'hash inválido';
  END IF;

  UPDATE public.master_password_config
     SET password_hash = p_hash,
         updated_at = NOW(),
         updated_by = auth.uid()
   WHERE id = 1;
END;
$$;


--
-- Name: sync_deferimento_on_etapa_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_deferimento_on_etapa_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_etapas_pos_deferimento TEXT[] := ARRAY[
    'registro','mat','inscricao_me','alvaras',
    'conselho','finalizados','arquivo'
  ];
BEGIN
  -- Etapa moveu para pós-deferimento e ainda não há data → preencher
  IF NEW.etapa = ANY(v_etapas_pos_deferimento)
     AND OLD.etapa IS DISTINCT FROM NEW.etapa
     AND NEW.data_deferimento IS NULL THEN
    NEW.data_deferimento := CURRENT_DATE;
  END IF;

  -- Etapa voltou para pré-deferimento → limpar data
  IF NOT (NEW.etapa = ANY(v_etapas_pos_deferimento))
     AND OLD.etapa IS DISTINCT FROM NEW.etapa
     AND NEW.data_deferimento IS NOT NULL THEN
    NEW.data_deferimento := NULL;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: tentar_aplicar_boas_vindas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tentar_aplicar_boas_vindas(p_cliente_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ja_aplicado     BOOLEAN;
  v_empresa_cliente UUID;
  v_empresa_caller  UUID;
BEGIN
  v_empresa_caller := public.get_empresa_id();

  SELECT empresa_id, COALESCE(desconto_boas_vindas_aplicado, false)
    INTO v_empresa_cliente, v_ja_aplicado
    FROM public.clientes
   WHERE id = p_cliente_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente não encontrado';
  END IF;

  IF v_empresa_cliente IS DISTINCT FROM v_empresa_caller THEN
    RAISE EXCEPTION 'Cliente não pertence à sua empresa';
  END IF;

  IF v_ja_aplicado THEN
    RETURN jsonb_build_object('aplicado', false, 'motivo', 'ja_aplicado');
  END IF;

  UPDATE public.clientes
     SET desconto_boas_vindas_aplicado = true,
         updated_at = NOW()
   WHERE id = p_cliente_id;

  RETURN jsonb_build_object('aplicado', true);
END;
$$;


--
-- Name: FUNCTION tentar_aplicar_boas_vindas(p_cliente_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.tentar_aplicar_boas_vindas(p_cliente_id uuid) IS 'Aplica desconto de boas-vindas atomicamente via SELECT FOR UPDATE. Hotfix 23/04 — garante presença no schema cache.';


--
-- Name: verificar_senha_proposta(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verificar_senha_proposta(p_token text, p_senha text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_senha text;
BEGIN
  SELECT senha_link INTO v_senha
  FROM public.orcamentos
  WHERE share_token = p_token
  AND status IN ('enviado', 'aguardando_pagamento');
  
  IF v_senha IS NULL THEN
    RETURN false;
  END IF;
  
  RETURN v_senha = p_senha;
END;
$$;


--
-- Name: verify_master_password_hash(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.verify_master_password_hash(p_password text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash
    FROM public.master_password_config WHERE id = 1;

  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN NULL;
  END IF;

  RETURN extensions.crypt(p_password, v_hash) = v_hash;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: acessos_publicos_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.acessos_publicos_log (
    id bigint NOT NULL,
    tipo text NOT NULL,
    token_hash text NOT NULL,
    acessado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: acessos_publicos_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.acessos_publicos_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: acessos_publicos_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.acessos_publicos_log_id_seq OWNED BY public.acessos_publicos_log.id;


--
-- Name: asaas_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asaas_webhook_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text,
    event_type text,
    asaas_payment_id text,
    cobranca_id uuid,
    processed boolean DEFAULT false,
    payload jsonb,
    error text,
    received_at timestamp with time zone DEFAULT now()
);


--
-- Name: backup_extratos_20260420; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_extratos_20260420 (
    id uuid,
    cliente_id uuid,
    pdf_url text,
    filename text,
    total_honorarios numeric(12,2),
    total_taxas numeric(12,2),
    total_geral numeric(12,2),
    qtd_processos integer,
    processo_ids uuid[],
    competencia_mes integer,
    competencia_ano integer,
    status text,
    observacoes text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by text,
    enviado boolean,
    data_envio timestamp with time zone,
    empresa_id uuid
);


--
-- Name: backup_lancamentos_20260420; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_lancamentos_20260420 (
    id uuid,
    tipo tipo_lancamento,
    cliente_id uuid,
    processo_id uuid,
    descricao text,
    valor numeric(12,2),
    status status_financeiro,
    data_vencimento date,
    data_pagamento date,
    is_taxa_reembolsavel boolean,
    comprovante_url text,
    categoria text,
    etapa_financeiro text,
    honorario_extra numeric(12,2),
    cobranca_encaminhada boolean,
    confirmado_recebimento boolean,
    observacoes_financeiro text,
    boleto_url text,
    url_comprovante text,
    url_recibo_taxa text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    colaborador_id uuid,
    recibo_assinado_url text,
    subcategoria text,
    fornecedor text,
    despesa_recorrente_id uuid,
    competencia_mes integer,
    competencia_ano integer,
    data_ultimo_contato date,
    tentativas_cobranca integer,
    notas_cobranca text,
    extrato_id uuid,
    empresa_id uuid,
    data_retorno_cobranca date,
    conta_id uuid,
    centro_custo text,
    auditado boolean,
    auditado_por uuid,
    auditado_em timestamp with time zone,
    valor_original numeric,
    valor_alterado_por uuid,
    valor_alterado_em timestamp with time zone,
    contestacao_motivo text,
    contestacao_anexo_url text,
    contestacao_data timestamp with time zone
);


--
-- Name: backup_valores_adicionais_20260420; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_valores_adicionais_20260420 (
    id uuid,
    processo_id uuid,
    descricao text,
    valor numeric(12,2),
    anexo_url text,
    comprovante_url text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    empresa_id uuid
);


--
-- Name: catalogo_precos_uf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_precos_uf (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id(),
    servico_id uuid NOT NULL,
    uf character(2) NOT NULL,
    honorario_trevo numeric DEFAULT 0 NOT NULL,
    taxa_orgao numeric DEFAULT 0 NOT NULL,
    prazo_estimado text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: catalogo_servicos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.catalogo_servicos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id(),
    nome text NOT NULL,
    categoria text NOT NULL,
    descricao text,
    prazo_estimado text,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: clientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    codigo_identificador text NOT NULL,
    nome text NOT NULL,
    tipo tipo_cliente DEFAULT 'AVULSO_4D'::tipo_cliente NOT NULL,
    email text,
    telefone text,
    nome_contador text,
    apelido text,
    cnpj text,
    dia_vencimento_mensal integer DEFAULT 15,
    valor_base numeric(12,2),
    desconto_progressivo numeric(5,2) DEFAULT 0,
    valor_limite_desconto numeric(12,2),
    tipo_desconto text DEFAULT 'progressivo'::text,
    mensalidade numeric(12,2),
    qtd_processos integer,
    vencimento integer,
    dia_cobranca integer,
    momento_faturamento text DEFAULT 'na_solicitacao'::text,
    observacoes text,
    contrato_url text,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    saldo_prepago numeric DEFAULT 0,
    saldo_ultima_recarga numeric DEFAULT 0,
    data_ultima_recarga date,
    franquia_processos integer DEFAULT 0,
    desconto_boas_vindas_aplicado boolean DEFAULT false,
    estado text,
    cidade text,
    cep text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    latitude numeric,
    longitude numeric,
    empresa_id uuid DEFAULT get_empresa_id(),
    auditado_financeiro boolean DEFAULT false,
    auditado_em timestamp with time zone,
    nome_contato_financeiro text,
    telefone_financeiro text,
    trello_board_id text,
    trello_board_url text,
    trello_provisionado_em timestamp with time zone,
    asaas_customer_id text
);


--
-- Name: COLUMN clientes.nome_contato_financeiro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clientes.nome_contato_financeiro IS 'Nome do responsável financeiro do escritório (se diferente do contador)';


--
-- Name: COLUMN clientes.telefone_financeiro; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.clientes.telefone_financeiro IS 'Telefone do financeiro (se diferente do telefone principal)';


--
-- Name: cobrancas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobrancas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id() NOT NULL,
    cliente_id uuid NOT NULL,
    extrato_id uuid,
    share_token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    lancamento_ids uuid[] NOT NULL,
    total_honorarios numeric(12,2) DEFAULT 0 NOT NULL,
    total_taxas numeric(12,2) DEFAULT 0 NOT NULL,
    total_geral numeric(12,2) NOT NULL,
    data_vencimento date,
    status text DEFAULT 'ativa'::text NOT NULL,
    visualizada_em timestamp with time zone,
    pago_em timestamp with time zone,
    whatsapp_enviado_em timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    asaas_payment_id text,
    asaas_status text,
    asaas_invoice_url text,
    asaas_boleto_url text,
    asaas_boleto_barcode text,
    asaas_pix_qrcode text,
    asaas_pix_payload text,
    asaas_gerado_em timestamp with time zone,
    asaas_pago_em timestamp with time zone,
    asaas_last_event jsonb,
    asaas_webhook_recebido_em timestamp with time zone,
    asaas_gerando_lock_ate timestamp with time zone,
    data_expiracao timestamp with time zone,
    is_archived boolean DEFAULT false
);


--
-- Name: COLUMN cobrancas.asaas_gerando_lock_ate; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cobrancas.asaas_gerando_lock_ate IS 'Timestamp até quando a cobrança está "bloqueada" por uma edge function gerando Asaas. Se NULL ou no passado, o lock está livre.';


--
-- Name: COLUMN cobrancas.data_expiracao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cobrancas.data_expiracao IS 'Prazo de validade do link público de cobrança. Após esta data, a RPC get_cobranca_por_token recusa o token. Default: data_vencimento + 60 dias, ou created_at + 90 dias.';


--
-- Name: cobrancas_lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cobrancas_lancamentos (
    cobranca_id uuid NOT NULL,
    lancamento_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE cobrancas_lancamentos; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cobrancas_lancamentos IS 'Junction table com FK real entre cobrancas e lancamentos. Sincronizada automaticamente a partir de cobrancas.lancamento_ids via trigger _sync_cobranca_lancamentos_junction. Onda 7 #10.';


--
-- Name: colaborador_avaliacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaborador_avaliacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    colaborador_id uuid NOT NULL,
    mes integer NOT NULL,
    ano integer NOT NULL,
    feedback text,
    conclusao_trimestral text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: colaboradores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.colaboradores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    email text,
    regime text DEFAULT 'CLT'::text NOT NULL,
    salario_base numeric DEFAULT 0 NOT NULL,
    vt_diario numeric DEFAULT 0 NOT NULL,
    vr_diario numeric DEFAULT 0 NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    adiantamento_tipo text DEFAULT 'percentual'::text NOT NULL,
    adiantamento_valor numeric DEFAULT 0 NOT NULL,
    pix_tipo text,
    pix_chave text,
    valor_das numeric DEFAULT 0 NOT NULL,
    aumento_previsto_valor numeric DEFAULT 0,
    aumento_previsto_data text,
    possui_adiantamento boolean DEFAULT true NOT NULL,
    dia_pagamento_integral integer DEFAULT 5,
    data_inicio date,
    aniversario date,
    dia_adiantamento integer DEFAULT 20,
    dia_salario integer DEFAULT 5,
    dia_vt_vr integer DEFAULT 0,
    dia_das integer DEFAULT 20,
    fgts_percentual numeric DEFAULT 8,
    inss_patronal_percentual numeric DEFAULT 20,
    provisionar_13 boolean DEFAULT true,
    provisionar_ferias boolean DEFAULT true,
    observacoes_pagamento text,
    tipo_transporte text DEFAULT 'vt'::text NOT NULL,
    auxilio_combustivel_valor numeric DEFAULT 0 NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id(),
    trello_username text,
    CONSTRAINT colaboradores_regime_check CHECK ((regime = ANY (ARRAY['CLT'::text, 'PJ'::text, 'INDEFINIDO'::text]))),
    CONSTRAINT colaboradores_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'inativo'::text])))
);


--
-- Name: TABLE colaboradores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.colaboradores IS 'Folha de pagamento. Acesso restrito a master/financeiro (audit fix #4 27/04/2026)';


--
-- Name: contatos_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contatos_estado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uf character(2) NOT NULL,
    tipo text NOT NULL,
    nome text NOT NULL,
    municipio text,
    site_url text,
    telefone text,
    email text,
    contato_interno text,
    endereco text,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    rating integer DEFAULT 0,
    pin_cor text
);


--
-- Name: contratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orcamento_id uuid,
    empresa_id uuid DEFAULT get_empresa_id(),
    numero_contrato text NOT NULL,
    contratante_tipo text DEFAULT 'juridica'::text,
    contratante_nome text NOT NULL,
    contratante_cnpj_cpf text NOT NULL,
    contratante_endereco text NOT NULL,
    contratante_representante text NOT NULL,
    contratante_representante_cpf text NOT NULL,
    contratante_representante_qualificacao text,
    contratada_nome text DEFAULT 'TREVO ASSESSORIA SOCIETÁRIA LTDA'::text,
    contratada_cnpj text DEFAULT '39.969.412/0001-70'::text,
    contratada_endereco text DEFAULT 'Rua Brasil, nº 1170, Rudge Ramos, São Bernardo do Campo/SP'::text,
    contratada_representante text DEFAULT 'Dr. Thales Felipe Burger'::text,
    contratada_representante_cpf text DEFAULT '447.821.658-46'::text,
    contratada_representante_qualificacao text DEFAULT 'empresário e advogado, brasileiro, solteiro'::text,
    cidade_contrato text DEFAULT 'São Bernardo do Campo/SP'::text,
    data_contrato date DEFAULT CURRENT_DATE,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT contratos_contratante_tipo_check CHECK ((contratante_tipo = ANY (ARRAY['juridica'::text, 'fisica'::text])))
);


--
-- Name: despesas_recorrentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.despesas_recorrentes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    descricao text NOT NULL,
    categoria text NOT NULL,
    subcategoria text,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    dia_vencimento integer DEFAULT 10 NOT NULL,
    fornecedor text,
    colaborador_id uuid,
    ativo boolean DEFAULT true NOT NULL,
    data_inicio date DEFAULT CURRENT_DATE NOT NULL,
    data_fim date,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: documentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    tipo_documento text NOT NULL,
    status text DEFAULT 'pendente'::text NOT NULL,
    url text,
    observacao text,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: empresas_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empresas_config (
    empresa_id uuid NOT NULL,
    razao_social text,
    cnpj text,
    pix_chave text,
    pix_banco text,
    whatsapp text,
    site text,
    nome_fantasia text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE empresas_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.empresas_config IS 'Configuração por empresa: dados usados em cobranças (PIX, banco, contatos). 1 linha por empresa_id.';


--
-- Name: extratos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extratos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    pdf_url text NOT NULL,
    filename text NOT NULL,
    total_honorarios numeric(12,2) DEFAULT 0 NOT NULL,
    total_taxas numeric(12,2) DEFAULT 0 NOT NULL,
    total_geral numeric(12,2) DEFAULT 0 NOT NULL,
    qtd_processos integer DEFAULT 0 NOT NULL,
    processo_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    competencia_mes integer NOT NULL,
    competencia_ano integer NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    observacoes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    enviado boolean DEFAULT false NOT NULL,
    data_envio timestamp with time zone,
    empresa_id uuid DEFAULT get_empresa_id(),
    created_by uuid DEFAULT auth.uid()
);


--
-- Name: COLUMN extratos.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.extratos.created_by IS 'Usuário que gerou o extrato. FK pra profiles. Default = auth.uid() pra preencher automático em INSERTs.';


--
-- Name: financeiro_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_auditoria (
    id bigint NOT NULL,
    empresa_id uuid,
    entidade text NOT NULL,
    entidade_id uuid NOT NULL,
    campo text NOT NULL,
    valor_antigo jsonb,
    valor_novo jsonb,
    ator_tipo text NOT NULL,
    ator_id uuid,
    ator_role text,
    motivo text,
    criado_em timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE financeiro_auditoria; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.financeiro_auditoria IS 'Histórico de mudanças em cobrancas e lancamentos. Append-only.';


--
-- Name: financeiro_auditoria_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.financeiro_auditoria_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: financeiro_auditoria_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.financeiro_auditoria_id_seq OWNED BY public.financeiro_auditoria.id;


--
-- Name: lancamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lancamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo tipo_lancamento NOT NULL,
    cliente_id uuid,
    processo_id uuid,
    descricao text NOT NULL,
    valor numeric(12,2) NOT NULL,
    status status_financeiro DEFAULT 'pendente'::status_financeiro NOT NULL,
    data_vencimento date NOT NULL,
    data_pagamento date,
    is_taxa_reembolsavel boolean DEFAULT false,
    comprovante_url text,
    categoria text,
    etapa_financeiro text DEFAULT 'solicitacao_criada'::text NOT NULL,
    honorario_extra numeric(12,2) DEFAULT 0,
    cobranca_encaminhada boolean DEFAULT false,
    confirmado_recebimento boolean DEFAULT false,
    observacoes_financeiro text,
    boleto_url text,
    url_comprovante text,
    url_recibo_taxa text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    colaborador_id uuid,
    recibo_assinado_url text,
    subcategoria text,
    fornecedor text,
    despesa_recorrente_id uuid,
    competencia_mes integer,
    competencia_ano integer,
    data_ultimo_contato date,
    tentativas_cobranca integer DEFAULT 0,
    notas_cobranca text,
    extrato_id uuid,
    empresa_id uuid DEFAULT get_empresa_id(),
    data_retorno_cobranca date,
    conta_id uuid,
    centro_custo text,
    auditado boolean DEFAULT false,
    auditado_por uuid,
    auditado_em timestamp with time zone,
    valor_original numeric,
    valor_alterado_por uuid,
    valor_alterado_em timestamp with time zone,
    contestacao_motivo text,
    contestacao_anexo_url text,
    contestacao_data timestamp with time zone,
    CONSTRAINT lancamentos_data_pagamento_coerente_check CHECK (((data_pagamento IS NULL) OR ((status)::text = ANY (ARRAY['pago'::text, 'cancelado'::text]))))
);


--
-- Name: COLUMN lancamentos.auditado; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.auditado IS 'Se true, processo foi validado e pode ser cobrado';


--
-- Name: COLUMN lancamentos.auditado_por; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.auditado_por IS 'Quem auditou (profile id)';


--
-- Name: COLUMN lancamentos.auditado_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.auditado_em IS 'Quando foi auditado';


--
-- Name: COLUMN lancamentos.valor_original; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.valor_original IS 'Valor antes de qualquer alteração manual';


--
-- Name: COLUMN lancamentos.valor_alterado_por; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.valor_alterado_por IS 'Quem alterou o valor por último';


--
-- Name: COLUMN lancamentos.valor_alterado_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.lancamentos.valor_alterado_em IS 'Quando o valor foi alterado por último';


--
-- Name: master_password_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_password_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    attempted_at timestamp with time zone DEFAULT now(),
    ip text,
    success boolean DEFAULT true NOT NULL
);


--
-- Name: master_password_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.master_password_config (
    id smallint DEFAULT 1 NOT NULL,
    password_hash text,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid,
    CONSTRAINT master_password_config_id_check CHECK ((id = 1))
);


--
-- Name: TABLE master_password_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.master_password_config IS 'Singleton (id=1) com hash bcrypt da senha master. Audit fix #2.';


--
-- Name: notas_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notas_estado (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    uf character(2) NOT NULL,
    conteudo text,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: notificacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text NOT NULL,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    lida boolean DEFAULT false,
    orcamento_id uuid,
    empresa_id uuid DEFAULT get_empresa_id(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT notificacoes_tipo_check CHECK ((tipo = ANY (ARRAY['aprovacao'::text, 'recusa'::text, 'assinatura'::text, 'cobranca'::text, 'pagamento'::text])))
);


--
-- Name: orcamento_pdfs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orcamento_pdfs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orcamento_id uuid NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id(),
    modo text NOT NULL,
    versao integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'ativo'::text NOT NULL,
    url text NOT NULL,
    storage_path text NOT NULL,
    filename text NOT NULL,
    gerado_em timestamp with time zone DEFAULT now() NOT NULL,
    cancelado_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT orcamento_pdfs_modo_check CHECK ((modo = ANY (ARRAY['contador'::text, 'cliente'::text, 'direto'::text]))),
    CONSTRAINT orcamento_pdfs_status_check CHECK ((status = ANY (ARRAY['ativo'::text, 'cancelado'::text])))
);


--
-- Name: orcamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orcamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    numero integer NOT NULL,
    prospect_nome text NOT NULL,
    prospect_cnpj text,
    prospect_email text,
    prospect_telefone text,
    prospect_contato text,
    tipo_contrato text DEFAULT 'avulso'::text NOT NULL,
    servicos jsonb DEFAULT '[]'::jsonb NOT NULL,
    naturezas jsonb DEFAULT '[]'::jsonb NOT NULL,
    escopo jsonb DEFAULT '[]'::jsonb NOT NULL,
    valor_base numeric(12,2) DEFAULT 880 NOT NULL,
    qtd_processos integer DEFAULT 1,
    desconto_pct numeric(5,2) DEFAULT 0,
    valor_final numeric(12,2) DEFAULT 880 NOT NULL,
    desconto_progressivo_ativo boolean DEFAULT false,
    desconto_progressivo_pct numeric(5,2) DEFAULT 5,
    desconto_progressivo_limite numeric(12,2) DEFAULT 600,
    validade_dias integer DEFAULT 15,
    pagamento text,
    sla text DEFAULT 'Prazo para início: até 5 dias úteis após recebimento COMPLETO da documentação. SLA de atendimento: 48 horas úteis.'::text,
    observacoes text,
    status text DEFAULT 'rascunho'::text,
    share_token text DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text),
    cliente_id uuid,
    convertido_em timestamp with time zone,
    pdf_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by text,
    prazo_execucao text,
    empresa_id uuid DEFAULT get_empresa_id(),
    contexto text,
    ordem_execucao text,
    pacotes jsonb DEFAULT '[]'::jsonb,
    secoes jsonb DEFAULT '[]'::jsonb,
    destinatario text DEFAULT 'contador'::text,
    riscos jsonb DEFAULT '[]'::jsonb,
    etapas_fluxo jsonb DEFAULT '[]'::jsonb,
    beneficios_capa jsonb DEFAULT '[]'::jsonb,
    headline_cenario text DEFAULT ''::text,
    enviado_em timestamp with time zone,
    aprovado_em timestamp with time zone,
    cenarios jsonb DEFAULT '[]'::jsonb,
    senha_link text,
    prazo_pagamento_dias integer DEFAULT 2,
    observacoes_recusa text,
    recusado_em timestamp with time zone,
    itens_selecionados jsonb,
    cenario_selecionado text,
    clicksign_document_key text,
    contrato_assinado_url text,
    pago_em timestamp with time zone,
    data_expiracao timestamp with time zone,
    is_archived boolean DEFAULT false,
    CONSTRAINT orcamentos_destinatario_check CHECK ((destinatario = ANY (ARRAY['contador'::text, 'cliente_via_contador'::text, 'cliente_direto'::text])))
);


--
-- Name: COLUMN orcamentos.data_expiracao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.orcamentos.data_expiracao IS 'Data limite pra acesso público via share_token. NULL = expira por validade_dias contado de enviado_em (audit fix #6).';


--
-- Name: orcamentos_numero_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orcamentos_numero_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orcamentos_numero_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orcamentos_numero_seq OWNED BY public.orcamentos.numero;


--
-- Name: plano_contas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plano_contas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    empresa_id uuid DEFAULT get_empresa_id(),
    codigo text NOT NULL,
    nome text NOT NULL,
    tipo text NOT NULL,
    grupo text NOT NULL,
    subgrupo text,
    centro_custo text,
    ativo boolean DEFAULT true NOT NULL,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: precos_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.precos_tiers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo_processo tipo_processo NOT NULL,
    tier integer DEFAULT 1 NOT NULL,
    valor numeric(12,2) NOT NULL,
    descricao text
);


--
-- Name: prepago_movimentacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prepago_movimentacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    tipo text NOT NULL,
    valor numeric NOT NULL,
    saldo_anterior numeric NOT NULL,
    saldo_posterior numeric NOT NULL,
    descricao text NOT NULL,
    processo_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: processos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.processos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    razao_social text NOT NULL,
    tipo tipo_processo NOT NULL,
    etapa text DEFAULT 'recebidos'::text NOT NULL,
    prioridade text DEFAULT 'normal'::text NOT NULL,
    responsavel text,
    valor numeric(12,2),
    notas text,
    is_archived boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id(),
    dentro_do_plano boolean,
    valor_avulso numeric(10,2) DEFAULT 0,
    justificativa_avulso text,
    link_drive text,
    data_deferimento date,
    auditado_financeiro boolean DEFAULT false,
    auditado_em timestamp with time zone,
    etiquetas text[] DEFAULT '{}'::text[],
    via_analise via_analise DEFAULT 'matriz'::via_analise NOT NULL
);


--
-- Name: COLUMN processos.etiquetas; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.processos.etiquetas IS 'Etiquetas do processo: metodo_trevo, prioridade, cortesia, boas_vindas';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    nome text,
    email text,
    role text DEFAULT 'visualizador'::text NOT NULL,
    ativo boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    convidado_por uuid,
    convidado_em timestamp with time zone,
    ultimo_acesso timestamp with time zone,
    motivo_inativacao text,
    cpf text,
    data_nascimento date,
    foto_url text,
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['master'::text, 'financeiro'::text, 'operacional'::text, 'visualizador'::text, 'usuario'::text])))
);


--
-- Name: COLUMN profiles.convidado_por; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.convidado_por IS 'Profile ID de quem convidou este usuário';


--
-- Name: COLUMN profiles.convidado_em; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.convidado_em IS 'Quando o convite foi enviado';


--
-- Name: COLUMN profiles.ultimo_acesso; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.ultimo_acesso IS 'Último login do usuário';


--
-- Name: COLUMN profiles.motivo_inativacao; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.profiles.motivo_inativacao IS 'Motivo se o usuário foi desativado';


--
-- Name: proposta_eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.proposta_eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    orcamento_id uuid,
    tipo text NOT NULL,
    dados jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    empresa_id uuid DEFAULT get_empresa_id(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT proposta_eventos_tipo_check CHECK ((tipo = ANY (ARRAY['visualizou'::text, 'selecionou_item'::text, 'removeu_item'::text, 'selecionou_cenario'::text, 'aprovou'::text, 'recusou'::text, 'assinou'::text])))
);


--
-- Name: role_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role text NOT NULL,
    nome_display text NOT NULL,
    descricao text,
    modulos_padrao text[] DEFAULT '{}'::text[] NOT NULL,
    cor text DEFAULT 'gray'::text,
    ordem integer DEFAULT 0
);


--
-- Name: service_negotiations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_negotiations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cliente_id uuid NOT NULL,
    service_name text NOT NULL,
    fixed_price numeric(12,2) DEFAULT 0 NOT NULL,
    billing_trigger text DEFAULT 'request'::text NOT NULL,
    trigger_days integer DEFAULT 0,
    is_custom boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    valor_prepago numeric DEFAULT 0,
    observacoes text,
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: trello_guard_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trello_guard_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    action_type text NOT NULL,
    board_id text,
    board_name text,
    card_id text,
    card_name text,
    member_username text,
    was_reverted boolean DEFAULT false,
    revert_detail text,
    raw_action jsonb
);


--
-- Name: trello_provisioner_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trello_provisioner_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    board_id text,
    board_name text,
    trigger_type text,
    actions_applied jsonb,
    errors jsonb,
    success boolean DEFAULT false
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    empresa_id uuid NOT NULL,
    modulo text NOT NULL,
    pode_ver boolean DEFAULT false,
    pode_criar boolean DEFAULT false,
    pode_editar boolean DEFAULT false,
    pode_excluir boolean DEFAULT false,
    pode_aprovar boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_permissions_modulo_check CHECK ((modulo = ANY (ARRAY['dashboard'::text, 'processos'::text, 'clientes'::text, 'importar'::text, 'orcamentos'::text, 'catalogo'::text, 'financeiro'::text, 'contas_pagar'::text, 'relatorios_dre'::text, 'fluxo_caixa'::text, 'colaboradores'::text, 'documentos'::text, 'intel_geografica'::text, 'configuracoes'::text])))
);


--
-- Name: valores_adicionais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.valores_adicionais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    processo_id uuid NOT NULL,
    descricao text NOT NULL,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    anexo_url text,
    comprovante_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id(),
    categoria text,
    reembolsavel boolean DEFAULT true NOT NULL
);


--
-- Name: webhook_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.webhook_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    url text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    empresa_id uuid DEFAULT get_empresa_id()
);


--
-- Name: acessos_publicos_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acessos_publicos_log ALTER COLUMN id SET DEFAULT nextval('acessos_publicos_log_id_seq'::regclass);


--
-- Name: financeiro_auditoria id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_auditoria ALTER COLUMN id SET DEFAULT nextval('financeiro_auditoria_id_seq'::regclass);


--
-- Name: orcamentos numero; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos ALTER COLUMN numero SET DEFAULT nextval('orcamentos_numero_seq'::regclass);


--
-- Name: acessos_publicos_log acessos_publicos_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.acessos_publicos_log
    ADD CONSTRAINT acessos_publicos_log_pkey PRIMARY KEY (id);


--
-- Name: asaas_webhook_events asaas_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_webhook_events
    ADD CONSTRAINT asaas_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: catalogo_precos_uf catalogo_precos_uf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos_uf
    ADD CONSTRAINT catalogo_precos_uf_pkey PRIMARY KEY (id);


--
-- Name: catalogo_precos_uf catalogo_precos_uf_servico_id_uf_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos_uf
    ADD CONSTRAINT catalogo_precos_uf_servico_id_uf_key UNIQUE (servico_id, uf);


--
-- Name: catalogo_servicos catalogo_servicos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_servicos
    ADD CONSTRAINT catalogo_servicos_pkey PRIMARY KEY (id);


--
-- Name: clientes clientes_codigo_identificador_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_codigo_identificador_key UNIQUE (codigo_identificador);


--
-- Name: clientes clientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clientes
    ADD CONSTRAINT clientes_pkey PRIMARY KEY (id);


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas_lancamentos
    ADD CONSTRAINT cobrancas_lancamentos_pkey PRIMARY KEY (cobranca_id, lancamento_id);


--
-- Name: cobrancas cobrancas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas
    ADD CONSTRAINT cobrancas_pkey PRIMARY KEY (id);


--
-- Name: cobrancas cobrancas_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas
    ADD CONSTRAINT cobrancas_share_token_key UNIQUE (share_token);


--
-- Name: cobrancas cobrancas_total_nonneg; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.cobrancas
    ADD CONSTRAINT cobrancas_total_nonneg CHECK (((total_geral IS NULL) OR (total_geral >= (0)::numeric))) NOT VALID;


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_colaborador_id_mes_ano_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_avaliacoes
    ADD CONSTRAINT colaborador_avaliacoes_colaborador_id_mes_ano_key UNIQUE (colaborador_id, mes, ano);


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_avaliacoes
    ADD CONSTRAINT colaborador_avaliacoes_pkey PRIMARY KEY (id);


--
-- Name: colaboradores colaboradores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaboradores
    ADD CONSTRAINT colaboradores_pkey PRIMARY KEY (id);


--
-- Name: contatos_estado contatos_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos_estado
    ADD CONSTRAINT contatos_estado_pkey PRIMARY KEY (id);


--
-- Name: contratos contratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_pkey PRIMARY KEY (id);


--
-- Name: despesas_recorrentes despesas_recorrentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despesas_recorrentes
    ADD CONSTRAINT despesas_recorrentes_pkey PRIMARY KEY (id);


--
-- Name: documentos documentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_pkey PRIMARY KEY (id);


--
-- Name: empresas_config empresas_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empresas_config
    ADD CONSTRAINT empresas_config_pkey PRIMARY KEY (empresa_id);


--
-- Name: extratos extratos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extratos
    ADD CONSTRAINT extratos_pkey PRIMARY KEY (id);


--
-- Name: financeiro_auditoria financeiro_auditoria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro_auditoria
    ADD CONSTRAINT financeiro_auditoria_pkey PRIMARY KEY (id);


--
-- Name: lancamentos lancamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_pkey PRIMARY KEY (id);


--
-- Name: lancamentos lancamentos_valor_positivo_check; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos
    ADD CONSTRAINT lancamentos_valor_positivo_check CHECK ((valor > (0)::numeric)) NOT VALID;


--
-- Name: lancamentos lancamentos_valor_sane; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos
    ADD CONSTRAINT lancamentos_valor_sane CHECK (((valor IS NULL) OR (abs(valor) <= (1000000000)::numeric))) NOT VALID;


--
-- Name: master_password_attempts master_password_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_password_attempts
    ADD CONSTRAINT master_password_attempts_pkey PRIMARY KEY (id);


--
-- Name: master_password_config master_password_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.master_password_config
    ADD CONSTRAINT master_password_config_pkey PRIMARY KEY (id);


--
-- Name: notas_estado notas_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_estado
    ADD CONSTRAINT notas_estado_pkey PRIMARY KEY (id);


--
-- Name: notas_estado notas_estado_uf_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notas_estado
    ADD CONSTRAINT notas_estado_uf_key UNIQUE (uf);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: orcamento_pdfs orcamento_pdfs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamento_pdfs
    ADD CONSTRAINT orcamento_pdfs_pkey PRIMARY KEY (id);


--
-- Name: orcamentos orcamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_pkey PRIMARY KEY (id);


--
-- Name: orcamentos orcamentos_share_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_share_token_key UNIQUE (share_token);


--
-- Name: orcamentos orcamentos_valor_base_nonneg; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.orcamentos
    ADD CONSTRAINT orcamentos_valor_base_nonneg CHECK (((valor_base IS NULL) OR (valor_base >= (0)::numeric))) NOT VALID;


--
-- Name: orcamentos orcamentos_valor_final_nonneg; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.orcamentos
    ADD CONSTRAINT orcamentos_valor_final_nonneg CHECK (((valor_final IS NULL) OR (valor_final >= (0)::numeric))) NOT VALID;


--
-- Name: plano_contas plano_contas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plano_contas
    ADD CONSTRAINT plano_contas_pkey PRIMARY KEY (id);


--
-- Name: precos_tiers precos_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precos_tiers
    ADD CONSTRAINT precos_tiers_pkey PRIMARY KEY (id);


--
-- Name: precos_tiers precos_tiers_tipo_processo_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.precos_tiers
    ADD CONSTRAINT precos_tiers_tipo_processo_tier_key UNIQUE (tipo_processo, tier);


--
-- Name: prepago_movimentacoes prepago_movimentacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prepago_movimentacoes
    ADD CONSTRAINT prepago_movimentacoes_pkey PRIMARY KEY (id);


--
-- Name: processos processos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT processos_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: proposta_eventos proposta_eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_eventos
    ADD CONSTRAINT proposta_eventos_pkey PRIMARY KEY (id);


--
-- Name: role_templates role_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_templates
    ADD CONSTRAINT role_templates_pkey PRIMARY KEY (id);


--
-- Name: role_templates role_templates_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_templates
    ADD CONSTRAINT role_templates_role_key UNIQUE (role);


--
-- Name: service_negotiations service_negotiations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_negotiations
    ADD CONSTRAINT service_negotiations_pkey PRIMARY KEY (id);


--
-- Name: trello_guard_logs trello_guard_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trello_guard_logs
    ADD CONSTRAINT trello_guard_logs_pkey PRIMARY KEY (id);


--
-- Name: trello_provisioner_logs trello_provisioner_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trello_provisioner_logs
    ADD CONSTRAINT trello_provisioner_logs_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_permissions user_permissions_user_id_modulo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_modulo_key UNIQUE (user_id, modulo);


--
-- Name: valores_adicionais valores_adicionais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valores_adicionais
    ADD CONSTRAINT valores_adicionais_pkey PRIMARY KEY (id);


--
-- Name: webhook_configs webhook_configs_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_key_key UNIQUE (key);


--
-- Name: webhook_configs webhook_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.webhook_configs
    ADD CONSTRAINT webhook_configs_pkey PRIMARY KEY (id);


--
-- Name: idx_acessos_publicos_tipo_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acessos_publicos_tipo_data ON public.acessos_publicos_log USING btree (tipo, acessado_em DESC);


--
-- Name: idx_acessos_publicos_token_hash_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_acessos_publicos_token_hash_data ON public.acessos_publicos_log USING btree (token_hash, acessado_em DESC);


--
-- Name: idx_asaas_webhook_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_asaas_webhook_event_id ON public.asaas_webhook_events USING btree (event_id) WHERE (event_id IS NOT NULL);


--
-- Name: idx_asaas_webhook_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asaas_webhook_payment ON public.asaas_webhook_events USING btree (asaas_payment_id);


--
-- Name: idx_auditoria_ator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_ator ON public.financeiro_auditoria USING btree (ator_id, criado_em DESC) WHERE (ator_id IS NOT NULL);


--
-- Name: idx_auditoria_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_empresa ON public.financeiro_auditoria USING btree (empresa_id, criado_em DESC) WHERE (empresa_id IS NOT NULL);


--
-- Name: idx_auditoria_entidade; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auditoria_entidade ON public.financeiro_auditoria USING btree (entidade, entidade_id, criado_em DESC);


--
-- Name: idx_catalogo_precos_uf_servico; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_precos_uf_servico ON public.catalogo_precos_uf USING btree (servico_id);


--
-- Name: idx_catalogo_precos_uf_uf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_precos_uf_uf ON public.catalogo_precos_uf USING btree (uf);


--
-- Name: idx_catalogo_servicos_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_catalogo_servicos_empresa ON public.catalogo_servicos USING btree (empresa_id);


--
-- Name: idx_clientes_archived; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_archived ON public.clientes USING btree (empresa_id) WHERE (is_archived = false);


--
-- Name: idx_clientes_asaas_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_asaas_customer ON public.clientes USING btree (asaas_customer_id) WHERE (asaas_customer_id IS NOT NULL);


--
-- Name: idx_clientes_asaas_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_asaas_customer_id ON public.clientes USING btree (asaas_customer_id) WHERE (asaas_customer_id IS NOT NULL);


--
-- Name: idx_clientes_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clientes_empresa_id ON public.clientes USING btree (empresa_id);


--
-- Name: idx_cob_lan_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cob_lan_empresa ON public.cobrancas_lancamentos USING btree (empresa_id);


--
-- Name: idx_cob_lan_lancamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cob_lan_lancamento ON public.cobrancas_lancamentos USING btree (lancamento_id);


--
-- Name: idx_cobrancas_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_active ON public.cobrancas USING btree (empresa_id, created_at DESC) WHERE ((is_archived = false) OR (is_archived IS NULL));


--
-- Name: idx_cobrancas_asaas_payment; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_cobrancas_asaas_payment ON public.cobrancas USING btree (asaas_payment_id) WHERE (asaas_payment_id IS NOT NULL);


--
-- Name: idx_cobrancas_asaas_payment_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_asaas_payment_id ON public.cobrancas USING btree (asaas_payment_id) WHERE (asaas_payment_id IS NOT NULL);


--
-- Name: idx_cobrancas_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_cliente ON public.cobrancas USING btree (cliente_id);


--
-- Name: idx_cobrancas_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_cliente_id ON public.cobrancas USING btree (cliente_id);


--
-- Name: idx_cobrancas_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_empresa_id ON public.cobrancas USING btree (empresa_id);


--
-- Name: idx_cobrancas_empresa_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_empresa_status ON public.cobrancas USING btree (empresa_id, status);


--
-- Name: idx_cobrancas_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_share_token ON public.cobrancas USING btree (share_token) WHERE (share_token IS NOT NULL);


--
-- Name: idx_cobrancas_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_status ON public.cobrancas USING btree (status);


--
-- Name: idx_cobrancas_status_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_status_data ON public.cobrancas USING btree (status, data_vencimento);


--
-- Name: idx_cobrancas_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cobrancas_token ON public.cobrancas USING btree (share_token);


--
-- Name: idx_colaboradores_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaboradores_empresa_id ON public.colaboradores USING btree (empresa_id);


--
-- Name: idx_colaboradores_trello; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_colaboradores_trello ON public.colaboradores USING btree (trello_username) WHERE (trello_username IS NOT NULL);


--
-- Name: idx_contatos_estado_municipio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_estado_municipio ON public.contatos_estado USING btree (municipio);


--
-- Name: idx_contatos_estado_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_estado_tipo ON public.contatos_estado USING btree (tipo);


--
-- Name: idx_contatos_estado_uf; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contatos_estado_uf ON public.contatos_estado USING btree (uf);


--
-- Name: idx_documentos_processo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_documentos_processo_id ON public.documentos USING btree (processo_id);


--
-- Name: idx_extratos_cliente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extratos_cliente ON public.extratos USING btree (cliente_id);


--
-- Name: idx_extratos_competencia; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extratos_competencia ON public.extratos USING btree (competencia_mes, competencia_ano);


--
-- Name: idx_extratos_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extratos_created_by ON public.extratos USING btree (created_by) WHERE (created_by IS NOT NULL);


--
-- Name: idx_extratos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_extratos_status ON public.extratos USING btree (status);


--
-- Name: idx_lancamentos_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_cliente_id ON public.lancamentos USING btree (cliente_id);


--
-- Name: idx_lancamentos_colaborador_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_colaborador_id ON public.lancamentos USING btree (colaborador_id);


--
-- Name: idx_lancamentos_conta_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_conta_id ON public.lancamentos USING btree (conta_id);


--
-- Name: idx_lancamentos_data_pagamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_data_pagamento ON public.lancamentos USING btree (data_pagamento DESC) WHERE (data_pagamento IS NOT NULL);


--
-- Name: idx_lancamentos_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_empresa_id ON public.lancamentos USING btree (empresa_id);


--
-- Name: idx_lancamentos_extrato_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_extrato_id ON public.lancamentos USING btree (extrato_id);


--
-- Name: idx_lancamentos_processo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_processo_id ON public.lancamentos USING btree (processo_id);


--
-- Name: idx_lancamentos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_status ON public.lancamentos USING btree (status);


--
-- Name: idx_lancamentos_status_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lancamentos_status_etapa ON public.lancamentos USING btree (status, etapa_financeiro);


--
-- Name: idx_master_pwd_attempts_ip_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_pwd_attempts_ip_time ON public.master_password_attempts USING btree (ip, attempted_at DESC) WHERE (ip IS NOT NULL);


--
-- Name: idx_master_pwd_attempts_user_fail_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_master_pwd_attempts_user_fail_time ON public.master_password_attempts USING btree (user_id, attempted_at DESC) WHERE (success = false);


--
-- Name: idx_notificacoes_nao_lidas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_nao_lidas ON public.notificacoes USING btree (lida) WHERE (lida = false);


--
-- Name: idx_orcamento_pdfs_orcamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamento_pdfs_orcamento ON public.orcamento_pdfs USING btree (orcamento_id);


--
-- Name: idx_orcamentos_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_active ON public.orcamentos USING btree (empresa_id, created_at DESC) WHERE ((is_archived = false) OR (is_archived IS NULL));


--
-- Name: idx_orcamentos_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_cliente_id ON public.orcamentos USING btree (cliente_id);


--
-- Name: idx_orcamentos_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_empresa_id ON public.orcamentos USING btree (empresa_id);


--
-- Name: idx_orcamentos_share; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_share ON public.orcamentos USING btree (share_token);


--
-- Name: idx_orcamentos_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_share_token ON public.orcamentos USING btree (share_token);


--
-- Name: idx_orcamentos_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orcamentos_status ON public.orcamentos USING btree (status);


--
-- Name: idx_plano_contas_empresa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plano_contas_empresa ON public.plano_contas USING btree (empresa_id);


--
-- Name: idx_plano_contas_tipo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plano_contas_tipo ON public.plano_contas USING btree (tipo);


--
-- Name: idx_processos_cliente_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processos_cliente_id ON public.processos USING btree (cliente_id);


--
-- Name: idx_processos_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processos_empresa_id ON public.processos USING btree (empresa_id);


--
-- Name: idx_processos_etapa; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processos_etapa ON public.processos USING btree (etapa) WHERE (is_archived = false);


--
-- Name: idx_processos_via_analise; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_processos_via_analise ON public.processos USING btree (via_analise) WHERE (via_analise = ANY (ARRAY['regional'::via_analise, 'metodo_trevo'::via_analise]));


--
-- Name: idx_profiles_empresa_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_empresa_id ON public.profiles USING btree (empresa_id);


--
-- Name: idx_profiles_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_role ON public.profiles USING btree (role);


--
-- Name: idx_trello_guard_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_trello_guard_logs_created_at ON public.trello_guard_logs USING btree (created_at DESC);


--
-- Name: idx_user_permissions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_user_id ON public.user_permissions USING btree (user_id);


--
-- Name: idx_valores_adicionais_processo_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_valores_adicionais_processo_id ON public.valores_adicionais USING btree (processo_id);


--
-- Name: cobrancas trg_audit_cobrancas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_cobrancas AFTER UPDATE ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION _audit_cobrancas_trigger();


--
-- Name: lancamentos trg_audit_lancamentos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_lancamentos AFTER UPDATE ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION _audit_lancamentos_trigger();


--
-- Name: lancamentos trg_bloqueia_cobranca_sem_reembolso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_bloqueia_cobranca_sem_reembolso BEFORE UPDATE OF etapa_financeiro ON public.lancamentos FOR EACH ROW EXECUTE FUNCTION _bloqueia_cobranca_sem_reembolso();


--
-- Name: cobrancas trg_cobranca_expiracao_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cobranca_expiracao_default BEFORE INSERT OR UPDATE ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION _cobranca_preenche_expiracao();


--
-- Name: empresas_config trg_empresas_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_empresas_config_updated_at BEFORE UPDATE ON public.empresas_config FOR EACH ROW EXECUTE FUNCTION _empresas_config_touch_updated_at();


--
-- Name: orcamentos trg_orcamento_expiracao_default; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_orcamento_expiracao_default BEFORE INSERT OR UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION _orcamento_preenche_expiracao();


--
-- Name: cobrancas trg_sync_cobranca_lancamentos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_cobranca_lancamentos AFTER INSERT OR UPDATE OF lancamento_ids ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION _sync_cobranca_lancamentos_junction();


--
-- Name: processos trg_sync_deferimento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_deferimento BEFORE UPDATE ON public.processos FOR EACH ROW EXECUTE FUNCTION sync_deferimento_on_etapa_change();


--
-- Name: cobrancas trg_validate_cobranca_lancamento_ids; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_cobranca_lancamento_ids BEFORE INSERT OR UPDATE OF lancamento_ids ON public.cobrancas FOR EACH ROW EXECUTE FUNCTION _validate_cobranca_lancamento_ids();


--
-- Name: asaas_webhook_events asaas_webhook_events_cobranca_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asaas_webhook_events
    ADD CONSTRAINT asaas_webhook_events_cobranca_id_fkey FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE SET NULL;


--
-- Name: catalogo_precos_uf catalogo_precos_uf_servico_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.catalogo_precos_uf
    ADD CONSTRAINT catalogo_precos_uf_servico_id_fkey FOREIGN KEY (servico_id) REFERENCES catalogo_servicos(id) ON DELETE CASCADE;


--
-- Name: cobrancas cobrancas_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas
    ADD CONSTRAINT cobrancas_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;


--
-- Name: cobrancas cobrancas_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas
    ADD CONSTRAINT cobrancas_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id);


--
-- Name: cobrancas cobrancas_extrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas
    ADD CONSTRAINT cobrancas_extrato_id_fkey FOREIGN KEY (extrato_id) REFERENCES extratos(id) ON DELETE SET NULL;


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_cobranca_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas_lancamentos
    ADD CONSTRAINT cobrancas_lancamentos_cobranca_id_fkey FOREIGN KEY (cobranca_id) REFERENCES cobrancas(id) ON DELETE CASCADE;


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_lancamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cobrancas_lancamentos
    ADD CONSTRAINT cobrancas_lancamentos_lancamento_id_fkey FOREIGN KEY (lancamento_id) REFERENCES lancamentos(id) ON DELETE RESTRICT;


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.colaborador_avaliacoes
    ADD CONSTRAINT colaborador_avaliacoes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE CASCADE;


--
-- Name: contratos contratos_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contratos
    ADD CONSTRAINT contratos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE;


--
-- Name: despesas_recorrentes despesas_recorrentes_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.despesas_recorrentes
    ADD CONSTRAINT despesas_recorrentes_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE SET NULL;


--
-- Name: documentos documentos_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos
    ADD CONSTRAINT documentos_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE RESTRICT;


--
-- Name: extratos extratos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extratos
    ADD CONSTRAINT extratos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);


--
-- Name: extratos extratos_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extratos
    ADD CONSTRAINT extratos_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_auditado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_auditado_por_fkey FOREIGN KEY (auditado_por) REFERENCES profiles(id);


--
-- Name: lancamentos lancamentos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);


--
-- Name: lancamentos lancamentos_colaborador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_colaborador_id_fkey FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_conta_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_conta_id_fkey FOREIGN KEY (conta_id) REFERENCES plano_contas(id);


--
-- Name: lancamentos lancamentos_despesa_recorrente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_despesa_recorrente_id_fkey FOREIGN KEY (despesa_recorrente_id) REFERENCES despesas_recorrentes(id) ON DELETE SET NULL;


--
-- Name: lancamentos lancamentos_extrato_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_extrato_id_fkey FOREIGN KEY (extrato_id) REFERENCES extratos(id);


--
-- Name: lancamentos lancamentos_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processos(id);


--
-- Name: lancamentos lancamentos_valor_alterado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lancamentos
    ADD CONSTRAINT lancamentos_valor_alterado_por_fkey FOREIGN KEY (valor_alterado_por) REFERENCES profiles(id);


--
-- Name: notificacoes notificacoes_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE;


--
-- Name: orcamento_pdfs orcamento_pdfs_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamento_pdfs
    ADD CONSTRAINT orcamento_pdfs_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE;


--
-- Name: orcamentos orcamentos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orcamentos
    ADD CONSTRAINT orcamentos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id);


--
-- Name: plano_contas plano_contas_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plano_contas
    ADD CONSTRAINT plano_contas_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES plano_contas(id);


--
-- Name: prepago_movimentacoes prepago_movimentacoes_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prepago_movimentacoes
    ADD CONSTRAINT prepago_movimentacoes_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;


--
-- Name: prepago_movimentacoes prepago_movimentacoes_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prepago_movimentacoes
    ADD CONSTRAINT prepago_movimentacoes_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE SET NULL;


--
-- Name: processos processos_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.processos
    ADD CONSTRAINT processos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_convidado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_convidado_por_fkey FOREIGN KEY (convidado_por) REFERENCES profiles(id);


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: proposta_eventos proposta_eventos_orcamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.proposta_eventos
    ADD CONSTRAINT proposta_eventos_orcamento_id_fkey FOREIGN KEY (orcamento_id) REFERENCES orcamentos(id) ON DELETE CASCADE;


--
-- Name: service_negotiations service_negotiations_cliente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_negotiations
    ADD CONSTRAINT service_negotiations_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE;


--
-- Name: user_permissions user_permissions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;


--
-- Name: valores_adicionais valores_adicionais_processo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.valores_adicionais
    ADD CONSTRAINT valores_adicionais_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE RESTRICT;


--
-- Name: acessos_publicos_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.acessos_publicos_log ENABLE ROW LEVEL SECURITY;

--
-- Name: acessos_publicos_log acessos_publicos_select_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY acessos_publicos_select_master ON public.acessos_publicos_log FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: asaas_webhook_events asaas_events_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY asaas_events_master_read ON public.asaas_webhook_events FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: asaas_webhook_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro_auditoria auditoria_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_master_read ON public.financeiro_auditoria FOR SELECT TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'gerente'::text]))));


--
-- Name: financeiro_auditoria auditoria_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY auditoria_self_read ON public.financeiro_auditoria FOR SELECT TO authenticated USING (((empresa_id = get_empresa_id()) AND (ator_id = auth.uid())));


--
-- Name: backup_extratos_20260420; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_extratos_20260420 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_extratos_20260420 backup_extratos_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_extratos_master_read ON public.backup_extratos_20260420 FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: backup_lancamentos_20260420; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_lancamentos_20260420 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_lancamentos_20260420 backup_lancamentos_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_lancamentos_master_read ON public.backup_lancamentos_20260420 FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: backup_valores_adicionais_20260420; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.backup_valores_adicionais_20260420 ENABLE ROW LEVEL SECURITY;

--
-- Name: backup_valores_adicionais_20260420 backup_valores_adicionais_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY backup_valores_adicionais_master_read ON public.backup_valores_adicionais_20260420 FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: catalogo_precos_uf; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalogo_precos_uf ENABLE ROW LEVEL SECURITY;

--
-- Name: catalogo_precos_uf catalogo_precos_uf_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_precos_uf_delete ON public.catalogo_precos_uf FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_precos_uf catalogo_precos_uf_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_precos_uf_insert ON public.catalogo_precos_uf FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_precos_uf catalogo_precos_uf_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_precos_uf_select ON public.catalogo_precos_uf FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_precos_uf catalogo_precos_uf_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_precos_uf_update ON public.catalogo_precos_uf FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_servicos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.catalogo_servicos ENABLE ROW LEVEL SECURITY;

--
-- Name: catalogo_servicos catalogo_servicos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_servicos_delete ON public.catalogo_servicos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_servicos catalogo_servicos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_servicos_insert ON public.catalogo_servicos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_servicos catalogo_servicos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_servicos_select ON public.catalogo_servicos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: catalogo_servicos catalogo_servicos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY catalogo_servicos_update ON public.catalogo_servicos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: clientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--
-- Name: clientes clientes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_delete ON public.clientes FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: clientes clientes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_insert ON public.clientes FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: clientes clientes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_select ON public.clientes FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: clientes clientes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY clientes_update ON public.clientes FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

--
-- Name: cobrancas cobrancas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_delete ON public.cobrancas FOR DELETE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: cobrancas cobrancas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_insert ON public.cobrancas FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas_lancamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.cobrancas_lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_lancamentos_delete ON public.cobrancas_lancamentos FOR DELETE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_lancamentos_insert ON public.cobrancas_lancamentos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_lancamentos_select ON public.cobrancas_lancamentos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas_lancamentos cobrancas_lancamentos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_lancamentos_update ON public.cobrancas_lancamentos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas cobrancas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_select ON public.cobrancas FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: cobrancas cobrancas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cobrancas_update ON public.cobrancas FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: colaborador_avaliacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaborador_avaliacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaborador_avaliacoes_delete ON public.colaborador_avaliacoes FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaborador_avaliacoes_insert ON public.colaborador_avaliacoes FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaborador_avaliacoes_select ON public.colaborador_avaliacoes FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: colaborador_avaliacoes colaborador_avaliacoes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaborador_avaliacoes_update ON public.colaborador_avaliacoes FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: colaboradores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

--
-- Name: colaboradores colaboradores_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_delete ON public.colaboradores FOR DELETE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: colaboradores colaboradores_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_insert ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))));


--
-- Name: colaboradores colaboradores_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_select ON public.colaboradores FOR SELECT TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))));


--
-- Name: colaboradores colaboradores_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY colaboradores_update ON public.colaboradores FOR UPDATE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])))) WITH CHECK (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))));


--
-- Name: contatos_estado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contatos_estado ENABLE ROW LEVEL SECURITY;

--
-- Name: contatos_estado contatos_estado_delete_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contatos_estado_delete_auth ON public.contatos_estado FOR DELETE TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: contatos_estado contatos_estado_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contatos_estado_insert_auth ON public.contatos_estado FOR INSERT TO authenticated WITH CHECK ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])));


--
-- Name: contatos_estado contatos_estado_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contatos_estado_select ON public.contatos_estado FOR SELECT TO authenticated USING (true);


--
-- Name: contatos_estado contatos_estado_update_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contatos_estado_update_auth ON public.contatos_estado FOR UPDATE TO authenticated USING ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])));


--
-- Name: contratos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

--
-- Name: contratos contratos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contratos_delete ON public.contratos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: contratos contratos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contratos_insert ON public.contratos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: contratos contratos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contratos_select ON public.contratos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: contratos contratos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contratos_update ON public.contratos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: despesas_recorrentes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;

--
-- Name: despesas_recorrentes despesas_recorrentes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY despesas_recorrentes_delete ON public.despesas_recorrentes FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: despesas_recorrentes despesas_recorrentes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY despesas_recorrentes_insert ON public.despesas_recorrentes FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: despesas_recorrentes despesas_recorrentes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY despesas_recorrentes_select ON public.despesas_recorrentes FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: despesas_recorrentes despesas_recorrentes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY despesas_recorrentes_update ON public.despesas_recorrentes FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: documentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

--
-- Name: documentos documentos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_delete ON public.documentos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: documentos documentos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_insert ON public.documentos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: documentos documentos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_select ON public.documentos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: documentos documentos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY documentos_update ON public.documentos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: empresas_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.empresas_config ENABLE ROW LEVEL SECURITY;

--
-- Name: empresas_config empresas_config_master_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_config_master_write ON public.empresas_config TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text))) WITH CHECK (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: empresas_config empresas_config_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY empresas_config_select ON public.empresas_config FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: extratos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.extratos ENABLE ROW LEVEL SECURITY;

--
-- Name: extratos extratos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extratos_delete ON public.extratos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: extratos extratos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extratos_insert ON public.extratos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: extratos extratos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extratos_select ON public.extratos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: extratos extratos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY extratos_update ON public.extratos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: financeiro_auditoria; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: lancamentos lancamentos_delete_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lancamentos_delete_role ON public.lancamentos FOR DELETE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: lancamentos lancamentos_insert_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lancamentos_insert_role ON public.lancamentos FOR INSERT TO authenticated WITH CHECK (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))));


--
-- Name: lancamentos lancamentos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lancamentos_select ON public.lancamentos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: lancamentos lancamentos_update_role; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lancamentos_update_role ON public.lancamentos FOR UPDATE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])))) WITH CHECK (((empresa_id = get_empresa_id()) AND (get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))));


--
-- Name: master_password_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_password_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: master_password_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.master_password_config ENABLE ROW LEVEL SECURITY;

--
-- Name: master_password_attempts master_pw_attempts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_pw_attempts_insert ON public.master_password_attempts FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));


--
-- Name: master_password_attempts master_pw_attempts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_pw_attempts_select ON public.master_password_attempts FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: master_password_config master_pw_config_insert_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_pw_config_insert_master ON public.master_password_config FOR INSERT TO authenticated WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: master_password_config master_pw_config_select_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_pw_config_select_master ON public.master_password_config FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: master_password_config master_pw_config_update_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY master_pw_config_update_master ON public.master_password_config FOR UPDATE TO authenticated USING ((get_user_role() = 'master'::text)) WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: notas_estado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notas_estado ENABLE ROW LEVEL SECURITY;

--
-- Name: notas_estado notas_estado_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_estado_insert_auth ON public.notas_estado FOR INSERT TO authenticated WITH CHECK ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])));


--
-- Name: notas_estado notas_estado_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_estado_select ON public.notas_estado FOR SELECT TO authenticated USING (true);


--
-- Name: notas_estado notas_estado_update_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notas_estado_update_auth ON public.notas_estado FOR UPDATE TO authenticated USING ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text]))) WITH CHECK ((get_user_role() = ANY (ARRAY['master'::text, 'financeiro'::text])));


--
-- Name: notificacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes notificacoes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_delete ON public.notificacoes FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: notificacoes notificacoes_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_insert_auth ON public.notificacoes FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: notificacoes notificacoes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_select ON public.notificacoes FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: notificacoes notificacoes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notificacoes_update ON public.notificacoes FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: orcamento_pdfs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orcamento_pdfs ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamento_pdfs orcamento_pdfs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamento_pdfs_delete ON public.orcamento_pdfs FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: orcamento_pdfs orcamento_pdfs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamento_pdfs_insert ON public.orcamento_pdfs FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: orcamento_pdfs orcamento_pdfs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamento_pdfs_select ON public.orcamento_pdfs FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: orcamento_pdfs orcamento_pdfs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamento_pdfs_update ON public.orcamento_pdfs FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: orcamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: orcamentos orcamentos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamentos_delete ON public.orcamentos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: orcamentos orcamentos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamentos_insert ON public.orcamentos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: orcamentos orcamentos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamentos_select ON public.orcamentos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: orcamentos orcamentos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orcamentos_update ON public.orcamentos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: user_permissions permissions_delete_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_delete_master ON public.user_permissions FOR DELETE TO authenticated USING (((empresa_id = get_user_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: user_permissions permissions_insert_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_insert_master ON public.user_permissions FOR INSERT TO authenticated WITH CHECK (((empresa_id = get_user_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: user_permissions permissions_select_by_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_select_by_empresa ON public.user_permissions FOR SELECT TO authenticated USING ((empresa_id = get_user_empresa_id()));


--
-- Name: user_permissions permissions_update_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY permissions_update_master ON public.user_permissions FOR UPDATE TO authenticated USING (((empresa_id = get_user_empresa_id()) AND (get_user_role() = 'master'::text))) WITH CHECK (((empresa_id = get_user_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: plano_contas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plano_contas ENABLE ROW LEVEL SECURITY;

--
-- Name: plano_contas plano_contas_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plano_contas_delete ON public.plano_contas FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: plano_contas plano_contas_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plano_contas_insert ON public.plano_contas FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: plano_contas plano_contas_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plano_contas_select ON public.plano_contas FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: plano_contas plano_contas_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plano_contas_update ON public.plano_contas FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: precos_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.precos_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: precos_tiers precos_tiers_insert_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY precos_tiers_insert_master ON public.precos_tiers FOR INSERT TO authenticated WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: precos_tiers precos_tiers_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY precos_tiers_select ON public.precos_tiers FOR SELECT TO authenticated USING (true);


--
-- Name: precos_tiers precos_tiers_update_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY precos_tiers_update_master ON public.precos_tiers FOR UPDATE TO authenticated USING ((get_user_role() = 'master'::text)) WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: prepago_movimentacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.prepago_movimentacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: prepago_movimentacoes prepago_movimentacoes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prepago_movimentacoes_delete ON public.prepago_movimentacoes FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: prepago_movimentacoes prepago_movimentacoes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prepago_movimentacoes_insert ON public.prepago_movimentacoes FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: prepago_movimentacoes prepago_movimentacoes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prepago_movimentacoes_select ON public.prepago_movimentacoes FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: prepago_movimentacoes prepago_movimentacoes_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prepago_movimentacoes_update ON public.prepago_movimentacoes FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: processos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

--
-- Name: processos processos_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processos_delete ON public.processos FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: processos processos_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processos_insert ON public.processos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: processos processos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processos_select ON public.processos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: processos processos_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY processos_update ON public.processos FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_delete_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_delete_master ON public.profiles FOR DELETE TO authenticated USING (((empresa_id = get_empresa_id()) AND (get_user_role() = 'master'::text)));


--
-- Name: profiles profiles_insert_trigger; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_insert_trigger ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: profiles profiles_select_empresa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_empresa ON public.profiles FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: profiles profiles_update_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_master ON public.profiles FOR UPDATE TO authenticated USING (((get_user_role() = 'master'::text) AND (empresa_id = get_empresa_id()))) WITH CHECK (((get_user_role() = 'master'::text) AND (empresa_id = get_empresa_id())));


--
-- Name: profiles profiles_update_self_safe; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_self_safe ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK (((id = auth.uid()) AND (role = ( SELECT p.role
   FROM profiles p
  WHERE (p.id = auth.uid()))) AND (ativo = ( SELECT p.ativo
   FROM profiles p
  WHERE (p.id = auth.uid()))) AND (empresa_id = ( SELECT p.empresa_id
   FROM profiles p
  WHERE (p.id = auth.uid())))));


--
-- Name: proposta_eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.proposta_eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: proposta_eventos proposta_eventos_insert_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposta_eventos_insert_auth ON public.proposta_eventos FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: proposta_eventos proposta_eventos_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY proposta_eventos_select ON public.proposta_eventos FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: role_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: role_templates role_templates_delete_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_templates_delete_master ON public.role_templates FOR DELETE TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: role_templates role_templates_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_templates_select ON public.role_templates FOR SELECT TO authenticated USING (true);


--
-- Name: role_templates role_templates_update_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_templates_update_master ON public.role_templates FOR UPDATE TO authenticated USING ((get_user_role() = 'master'::text)) WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: role_templates role_templates_write_master; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY role_templates_write_master ON public.role_templates FOR INSERT TO authenticated WITH CHECK ((get_user_role() = 'master'::text));


--
-- Name: service_negotiations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_negotiations ENABLE ROW LEVEL SECURITY;

--
-- Name: service_negotiations service_negotiations_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_negotiations_delete ON public.service_negotiations FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: service_negotiations service_negotiations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_negotiations_insert ON public.service_negotiations FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: service_negotiations service_negotiations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_negotiations_select ON public.service_negotiations FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: service_negotiations service_negotiations_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_negotiations_update ON public.service_negotiations FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: trello_guard_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trello_guard_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: trello_guard_logs trello_logs_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trello_logs_master_read ON public.trello_guard_logs FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: trello_provisioner_logs trello_prov_logs_master_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trello_prov_logs_master_read ON public.trello_provisioner_logs FOR SELECT TO authenticated USING ((get_user_role() = 'master'::text));


--
-- Name: trello_provisioner_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trello_provisioner_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_permissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

--
-- Name: valores_adicionais; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.valores_adicionais ENABLE ROW LEVEL SECURITY;

--
-- Name: valores_adicionais valores_adicionais_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY valores_adicionais_delete ON public.valores_adicionais FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: valores_adicionais valores_adicionais_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY valores_adicionais_insert ON public.valores_adicionais FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: valores_adicionais valores_adicionais_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY valores_adicionais_select ON public.valores_adicionais FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: valores_adicionais valores_adicionais_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY valores_adicionais_update ON public.valores_adicionais FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: webhook_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.webhook_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: webhook_configs webhook_configs_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_configs_delete ON public.webhook_configs FOR DELETE TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: webhook_configs webhook_configs_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_configs_insert ON public.webhook_configs FOR INSERT TO authenticated WITH CHECK ((empresa_id = get_empresa_id()));


--
-- Name: webhook_configs webhook_configs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_configs_select ON public.webhook_configs FOR SELECT TO authenticated USING ((empresa_id = get_empresa_id()));


--
-- Name: webhook_configs webhook_configs_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY webhook_configs_update ON public.webhook_configs FOR UPDATE TO authenticated USING ((empresa_id = get_empresa_id())) WITH CHECK ((empresa_id = get_empresa_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict tCrPjmM5n8PhYvjAlLRFe175g56nt3oYay3ZRXZxTWPpF0eRI7VITKfZDr65uMN

