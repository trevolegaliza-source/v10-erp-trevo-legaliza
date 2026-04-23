-- ════════════════════════════════════════════════════════════════════════════
-- ⚠️  DUPLICATA PARCIAL de 20260423100000_rpc_salvar_selecao_proposta.sql
-- ────────────────────────────────────────────────────────────────────────────
-- Gerada pelo Lovable no mesmo dia. CREATE OR REPLACE garante idempotência, mas
-- a execução dupla é sujeira técnica. Esta migration difere da anterior APENAS
-- em:
--   (a) COMMENT ON FUNCTION (linha final)
--   (b) CREATE INDEX IF NOT EXISTS idx_orcamentos_share_token (linha final)
--
-- Não deletar (quebraria `supabase db reset` em devs com estado parcial).
-- Canônica = 20260423100000. Diffs vão pra cá.
-- Identificado na auditoria 23/04 (commit e1d1593).
-- ════════════════════════════════════════════════════════════════════════════

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

GRANT EXECUTE ON FUNCTION public.salvar_selecao_proposta(TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.salvar_selecao_proposta(TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.salvar_selecao_proposta IS 'Salva a seleção de itens de uma proposta pública via token. Retorna TRUE se sucesso, FALSE caso contrário.';

-- Índice para otimizar busca por share_token (se não existir)
CREATE INDEX IF NOT EXISTS idx_orcamentos_share_token ON public.orcamentos(share_token);