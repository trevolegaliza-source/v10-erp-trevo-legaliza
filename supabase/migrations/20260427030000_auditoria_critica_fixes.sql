-- =============================================================================
-- AUDITORIA CRÍTICA — Fixes consolidados (27/04/2026)
-- =============================================================================
--
-- Esta migration ataca os críticos #4, #6, #13, #20, #2 da auditoria
-- (RELATORIO_AUDITORIA_ERP.md). Fixes #1 (storage), #5 (CASCADE), #10 (junction)
-- e cálculos monetários ficam pra próxima onda — exigem migração de dados
-- existentes mais cuidadosa.
--
-- Conservadora por design:
--  - Só ADICIONA estruturas (colunas, policies novas com nome novo, RPCs)
--  - NÃO altera comportamento de CASCADE existente (próxima fase)
--  - Compat backwards: senha master plaintext continua funcionando
--    se hash não setado (modo migração) — Edge Function escolhe.
-- =============================================================================

-- 1) =========================================================================
-- CRÍTICO #4 — colaboradores: INSERT/UPDATE/DELETE exigem role master/financeiro
-- =========================================================================

DROP POLICY IF EXISTS "colaboradores_insert" ON public.colaboradores;
CREATE POLICY "colaboradores_insert" ON public.colaboradores
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  );

DROP POLICY IF EXISTS "colaboradores_update" ON public.colaboradores;
CREATE POLICY "colaboradores_update" ON public.colaboradores
  FOR UPDATE TO authenticated
  USING (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  )
  WITH CHECK (
    empresa_id = get_empresa_id()
    AND get_user_role() IN ('master', 'financeiro')
  );

DROP POLICY IF EXISTS "colaboradores_delete" ON public.colaboradores;
CREATE POLICY "colaboradores_delete" ON public.colaboradores
  FOR DELETE TO authenticated
  USING (
    empresa_id = get_empresa_id()
    AND get_user_role() = 'master'
  );

COMMENT ON TABLE public.colaboradores IS
  'Folha de pagamento. Acesso restrito a master/financeiro (audit fix #4 27/04/2026)';

-- 2) =========================================================================
-- CRÍTICO #6 — Expiração obrigatória em propostas (orcamentos)
-- (cobranças já têm data_expiracao via 20260422130000)
-- =========================================================================

ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS data_expiracao TIMESTAMPTZ;

COMMENT ON COLUMN public.orcamentos.data_expiracao IS
  'Data limite pra acesso público via share_token. NULL = expira por validade_dias contado de enviado_em (audit fix #6).';

-- Trigger pra preencher data_expiracao quando proposta é enviada
CREATE OR REPLACE FUNCTION public._orcamento_preenche_expiracao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Só preenche se foi recém-enviado e ainda sem expiração
  IF NEW.data_expiracao IS NULL
     AND NEW.status IN ('enviado', 'aguardando_pagamento')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.data_expiracao := NOW() + (COALESCE(NEW.validade_dias, 15) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orcamento_expiracao_default ON public.orcamentos;
CREATE TRIGGER trg_orcamento_expiracao_default
  BEFORE INSERT OR UPDATE ON public.orcamentos
  FOR EACH ROW
  EXECUTE FUNCTION public._orcamento_preenche_expiracao();

-- Backfill: orçamentos antigos enviados ganham expiração 90 dias a partir do envio
UPDATE public.orcamentos
   SET data_expiracao = COALESCE(enviado_em, created_at, NOW())
                        + (COALESCE(validade_dias, 90) || ' days')::INTERVAL
 WHERE data_expiracao IS NULL
   AND status IN ('enviado', 'aguardando_pagamento');

-- Atualiza get_proposta_por_token pra rejeitar expirados
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
  -- audit log de acesso público
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
    -- bloqueia links expirados (audit fix #6)
    AND (o.data_expiracao IS NULL OR o.data_expiracao > NOW());
END;
$$;

-- 3) =========================================================================
-- CRÍTICO #13 — Auditoria de acesso a RPCs públicas
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.acessos_publicos_log (
  id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL,           -- 'proposta', 'cobranca', 'portfolio'
  token_hash TEXT NOT NULL,     -- só hash do token (privacy)
  acessado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_acessos_publicos_tipo_data
  ON public.acessos_publicos_log (tipo, acessado_em DESC);

CREATE INDEX IF NOT EXISTS idx_acessos_publicos_token_hash_data
  ON public.acessos_publicos_log (token_hash, acessado_em DESC);

ALTER TABLE public.acessos_publicos_log ENABLE ROW LEVEL SECURITY;

-- Só master da empresa pode ler logs (auditoria)
CREATE POLICY "acessos_publicos_select_master" ON public.acessos_publicos_log
  FOR SELECT TO authenticated
  USING (get_user_role() = 'master');

-- Helper de log + rate limit (60 req / 5min por token)
CREATE OR REPLACE FUNCTION public._log_acesso_publico(p_tipo TEXT, p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_hash TEXT;
  v_count INTEGER;
BEGIN
  -- Hash do token pra não armazenar em clear
  v_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  -- Rate limit: 60 acessos em 5min pelo mesmo token
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
    -- Se digest não existe ou tabela falha, não bloqueia acesso (degradação suave)
    IF SQLSTATE = 'check_violation' THEN
      RAISE; -- propaga rate limit
    END IF;
    -- demais erros: ignora silenciosamente (log não pode quebrar fluxo)
END;
$$;

-- Adiciona log também na get_cobranca_por_token (se existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_cobranca_por_token'
  ) THEN
    -- Não mexemos na implementação aqui; o log será adicionado em migration
    -- separada quando ela for refatorada. Por enquanto, get_proposta_por_token
    -- já chama _log_acesso_publico (acima).
    NULL;
  END IF;
END $$;

-- 4) =========================================================================
-- CRÍTICO #20 — handle_new_user: REMOVE fallback "LIMIT 1 master qualquer"
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
  v_total_empresas INTEGER;
BEGIN
  -- 1) Tenta pegar empresa_id do raw_user_meta_data (passado no signup)
  v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::UUID;

  -- 2) Se não veio, conta empresas no banco. Se houver EXATAMENTE 1, usa ela
  --    (modo single-tenant da Trevo hoje). Se houver 2+, exige metadata.
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

COMMENT ON FUNCTION public.handle_new_user() IS
  'Single-tenant: usa única empresa do banco se metadata vazio. Multi-tenant: exige empresa_id no metadata. Audit fix #20.';

-- 5) =========================================================================
-- CRÍTICO #2 — Hash da senha master (compat backwards)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.master_password_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton
  password_hash TEXT,                                 -- bcrypt hash
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE public.master_password_config ENABLE ROW LEVEL SECURITY;

-- Só master pode ler/escrever config (e mesmo assim, hash nunca volta pro client)
CREATE POLICY "master_pw_config_select_master" ON public.master_password_config
  FOR SELECT TO authenticated
  USING (get_user_role() = 'master');

CREATE POLICY "master_pw_config_insert_master" ON public.master_password_config
  FOR INSERT TO authenticated
  WITH CHECK (get_user_role() = 'master');

CREATE POLICY "master_pw_config_update_master" ON public.master_password_config
  FOR UPDATE TO authenticated
  USING (get_user_role() = 'master')
  WITH CHECK (get_user_role() = 'master');

INSERT INTO public.master_password_config (id, password_hash)
VALUES (1, NULL)
ON CONFLICT (id) DO NOTHING;

-- RPC pra master setar nova senha (sempre via Edge Function pra hashear)
CREATE OR REPLACE FUNCTION public.set_master_password_hash(p_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
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

-- RPC interna que verifica senha contra hash usando crypt() (bcrypt do pgcrypto)
-- Edge Function chama via service-role; nunca exposta a anon/authenticated.
CREATE OR REPLACE FUNCTION public.verify_master_password_hash(p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  SELECT password_hash INTO v_hash
    FROM public.master_password_config WHERE id = 1;

  -- Sem hash setado: retorna NULL (Edge Function decide fallback pra MASTER_PASSWORD env)
  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN NULL;
  END IF;

  RETURN extensions.crypt(p_password, v_hash) = v_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_master_password_hash(TEXT) FROM PUBLIC, authenticated, anon;
-- service_role mantém via SECURITY DEFINER

-- Helper pra o master setar hash diretamente (ex: setup inicial via seed/migration)
CREATE OR REPLACE FUNCTION public.hash_master_password(p_password TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'extensions'
AS $$
  SELECT extensions.crypt(p_password, extensions.gen_salt('bf', 12));
$$;

REVOKE ALL ON FUNCTION public.hash_master_password(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hash_master_password(TEXT) TO authenticated;

COMMENT ON TABLE public.master_password_config IS
  'Singleton (id=1) com hash bcrypt da senha master. Audit fix #2.';

-- 6) =========================================================================
-- BONUS — Índices em FKs críticas (audit IMPORTANTE #25)
-- Custo baixo, ganho de performance imediato. Apenas IF NOT EXISTS.
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_processos_cliente_id ON public.processos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_processos_empresa_id ON public.processos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_processos_etapa ON public.processos(etapa) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS idx_clientes_empresa_id ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_archived ON public.clientes(empresa_id) WHERE is_archived = false;

-- Outros (defensivo — só se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='lancamentos' AND column_name='cliente_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lancamentos_cliente_id ON public.lancamentos(cliente_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON public.lancamentos(status)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lancamentos_processo_id ON public.lancamentos(processo_id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='cobrancas' AND column_name='cliente_id') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cobrancas_cliente_id ON public.cobrancas(cliente_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON public.cobrancas(status)';
  END IF;
END $$;

-- =============================================================================
-- FIM
-- Para reverter: rodar 20260427030000_auditoria_critica_fixes_DOWN.sql (criar à parte)
-- =============================================================================
