
-- FIX 1: Orçamentos — restringir SELECT anon
DROP POLICY IF EXISTS "orcamentos_select_anon" ON orcamentos;
DROP POLICY IF EXISTS "Orcamentos: leitura publica por token" ON orcamentos;

CREATE POLICY "orcamentos_anon_select_por_token"
ON orcamentos FOR SELECT
TO anon
USING (
  share_token IS NOT NULL
  AND status IN ('enviado', 'aguardando_pagamento')
);

-- FIX 2: Notificações — remover INSERT anon
DROP POLICY IF EXISTS "notificacoes_insert_anon_restricted" ON notificacoes;
DROP POLICY IF EXISTS "Notificacoes: inserir por empresa" ON notificacoes;

REVOKE INSERT ON notificacoes FROM anon;

-- FIX 3: Função segura para criar notificação a partir da proposta pública
CREATE OR REPLACE FUNCTION criar_notificacao_proposta(
  p_orcamento_id uuid,
  p_tipo text,
  p_mensagem text
) RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION criar_notificacao_proposta TO anon;
