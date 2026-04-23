-- RPC pública (anon) para o contador salvar silenciosamente a seleção de itens
-- e os valores ajustados que ele quer cobrar do cliente final.
-- Só atualiza se o orçamento ainda está no status 'enviado' (não aprovado/recusado).

CREATE OR REPLACE FUNCTION public.salvar_selecao_proposta(
  p_token TEXT,
  p_itens_selecionados JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Só salva se ainda não foi aprovado/recusado/convertido
  IF v_status NOT IN ('rascunho', 'enviado') THEN
    RETURN FALSE;
  END IF;

  UPDATE orcamentos
  SET
    itens_selecionados = p_itens_selecionados,
    updated_at = NOW()
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;

-- Permissão para anon (página pública não tem auth)
GRANT EXECUTE ON FUNCTION public.salvar_selecao_proposta(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.salvar_selecao_proposta(TEXT, JSONB) TO authenticated;
