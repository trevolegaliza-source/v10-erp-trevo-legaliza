
DROP FUNCTION IF EXISTS public.get_proposta_por_token(text);

CREATE FUNCTION public.get_proposta_por_token(p_token text)
RETURNS TABLE(
  id uuid, numero integer, prospect_nome text, prospect_cnpj text, prospect_email text,
  prospect_telefone text, prospect_contato text, tipo_contrato text, servicos jsonb,
  naturezas jsonb, escopo jsonb, valor_base numeric, valor_final numeric, desconto_pct numeric,
  qtd_processos integer, status text, share_token text, created_at timestamptz,
  updated_at timestamptz, pdf_url text, observacoes text, validade_dias integer,
  pagamento text, sla text, prazo_execucao text, ordem_execucao text, contexto text,
  destinatario text, secoes jsonb, pacotes jsonb, etapas_fluxo jsonb, riscos jsonb,
  cenarios jsonb, cenario_selecionado text, headline_cenario text, beneficios_capa jsonb,
  desconto_progressivo_ativo boolean, desconto_progressivo_pct numeric,
  desconto_progressivo_limite numeric, aprovado_em timestamptz, enviado_em timestamptz,
  recusado_em timestamptz, observacoes_recusa text, convertido_em timestamptz,
  pago_em timestamptz, contrato_assinado_url text, clicksign_document_key text,
  itens_selecionados jsonb, prazo_pagamento_dias integer, empresa_id uuid,
  cliente_id uuid, created_by text, has_password boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
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
    o.pago_em, o.contrato_assinado_url, o.clicksign_document_key,
    o.itens_selecionados, o.prazo_pagamento_dias, o.empresa_id,
    o.cliente_id, o.created_by,
    (o.senha_link IS NOT NULL AND o.senha_link <> '') AS has_password
  FROM public.orcamentos o
  WHERE o.share_token = p_token
  AND o.status IN ('enviado', 'aguardando_pagamento');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_proposta_por_token TO anon;

CREATE OR REPLACE FUNCTION public.verificar_senha_proposta(p_token text, p_senha text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION public.verificar_senha_proposta TO anon;
