
-- 1. Novas colunas na tabela orcamentos
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS senha_link text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS prazo_pagamento_dias integer DEFAULT 2;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS observacoes_recusa text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS recusado_em timestamptz;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS itens_selecionados jsonb;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS cenario_selecionado text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS clicksign_document_key text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS contrato_assinado_url text;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS pago_em timestamptz;

-- 2. Tabela de notificações
CREATE TABLE IF NOT EXISTS notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('aprovacao', 'recusa', 'assinatura', 'cobranca', 'pagamento')),
  titulo text NOT NULL,
  mensagem text NOT NULL,
  lida boolean DEFAULT false,
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  empresa_id uuid DEFAULT get_empresa_id(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_nao_lidas ON notificacoes (lida) WHERE lida = false;

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- 3. Tabela de eventos da proposta
CREATE TABLE IF NOT EXISTS proposta_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('visualizou', 'selecionou_item', 'removeu_item', 'selecionou_cenario', 'aprovou', 'recusou', 'assinou')),
  dados jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  empresa_id uuid DEFAULT get_empresa_id(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE proposta_eventos ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies para notificacoes
CREATE POLICY "notificacoes_select" ON notificacoes FOR SELECT TO authenticated USING (empresa_id = get_empresa_id());
CREATE POLICY "notificacoes_insert_auth" ON notificacoes FOR INSERT TO authenticated WITH CHECK (empresa_id = get_empresa_id());
CREATE POLICY "notificacoes_update" ON notificacoes FOR UPDATE TO authenticated USING (empresa_id = get_empresa_id());
CREATE POLICY "notificacoes_delete" ON notificacoes FOR DELETE TO authenticated USING (empresa_id = get_empresa_id());
-- Allow anon insert for public proposal page
CREATE POLICY "notificacoes_insert_anon" ON notificacoes FOR INSERT TO anon WITH CHECK (true);

-- 5. RLS policies para proposta_eventos
CREATE POLICY "proposta_eventos_select" ON proposta_eventos FOR SELECT TO authenticated USING (empresa_id = get_empresa_id());
CREATE POLICY "proposta_eventos_insert_auth" ON proposta_eventos FOR INSERT TO authenticated WITH CHECK (empresa_id = get_empresa_id());
-- Allow anon insert for public proposal page
CREATE POLICY "proposta_eventos_insert_anon" ON proposta_eventos FOR INSERT TO anon WITH CHECK (true);

-- 6. Allow anon to read orcamentos by share_token (public proposal page)
CREATE POLICY "orcamentos_select_anon" ON orcamentos FOR SELECT TO anon USING (share_token IS NOT NULL);
-- Allow anon to update orcamentos (public proposal page changes status)
CREATE POLICY "orcamentos_update_anon" ON orcamentos FOR UPDATE TO anon USING (share_token IS NOT NULL);

-- 7. Preencher share_token para orçamentos existentes
UPDATE orcamentos SET share_token = encode(gen_random_bytes(16), 'hex') WHERE share_token IS NULL;
