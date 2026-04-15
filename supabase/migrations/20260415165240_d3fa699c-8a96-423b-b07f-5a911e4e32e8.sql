
-- ═══ C3: IMPEDIR AUTO-ESCALADA DE ROLE ═══
DROP POLICY IF EXISTS "profiles_update_role" ON profiles;

CREATE POLICY "profiles_update_self_safe"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  AND ativo = (SELECT p.ativo FROM profiles p WHERE p.id = auth.uid())
  AND empresa_id = (SELECT p.empresa_id FROM profiles p WHERE p.id = auth.uid())
);

CREATE POLICY "profiles_update_master"
ON profiles FOR UPDATE
TO authenticated
USING (get_user_role() = 'master' AND empresa_id = get_empresa_id())
WITH CHECK (get_user_role() = 'master' AND empresa_id = get_empresa_id());


-- ═══ C1: REMOVER SELECT ANON DE ORÇAMENTOS ═══
DROP POLICY IF EXISTS "orcamentos_anon_select_por_token" ON orcamentos;
DROP POLICY IF EXISTS "orcamentos_select_anon" ON orcamentos;

CREATE OR REPLACE FUNCTION public.get_proposta_por_token(p_token text)
RETURNS SETOF orcamentos AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.orcamentos
  WHERE share_token = p_token
  AND status IN ('enviado', 'aguardando_pagamento');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_proposta_por_token TO anon;


-- ═══ C2: REMOVER UPDATE ANON DE ORÇAMENTOS ═══
DROP POLICY IF EXISTS "orcamentos_update_anon_restricted" ON orcamentos;

CREATE OR REPLACE FUNCTION public.atualizar_proposta_por_token(
  p_token text,
  p_status text,
  p_motivo text DEFAULT NULL
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.atualizar_proposta_por_token TO anon;


-- ═══ C4: NOTIFICAÇÕES SEM empresa_id NULL ═══
DROP POLICY IF EXISTS "notificacoes_select" ON notificacoes;

CREATE POLICY "notificacoes_select"
ON notificacoes FOR SELECT
TO authenticated
USING (empresa_id = get_empresa_id());

DELETE FROM notificacoes WHERE empresa_id IS NULL;


-- ═══ C5: REMOVER INSERT ANON EM PROPOSTA_EVENTOS ═══
DROP POLICY IF EXISTS "proposta_eventos_insert_anon_restricted" ON proposta_eventos;

REVOKE INSERT ON proposta_eventos FROM anon;

CREATE OR REPLACE FUNCTION public.criar_evento_proposta(
  p_orcamento_id uuid,
  p_tipo text,
  p_dados jsonb DEFAULT '{}'
) RETURNS void AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  SELECT empresa_id INTO v_empresa_id
  FROM public.orcamentos WHERE id = p_orcamento_id;
  
  IF v_empresa_id IS NULL THEN RETURN; END IF;
  
  INSERT INTO public.proposta_eventos (orcamento_id, tipo, dados, empresa_id)
  VALUES (p_orcamento_id, p_tipo, p_dados, v_empresa_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.criar_evento_proposta TO anon;


-- ═══ R6: CORRIGIR DEFAULT empresa_id ═══
ALTER TABLE profiles ALTER COLUMN empresa_id DROP DEFAULT;
