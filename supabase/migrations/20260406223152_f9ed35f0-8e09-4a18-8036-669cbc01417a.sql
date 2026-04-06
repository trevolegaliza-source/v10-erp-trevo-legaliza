
-- Tabela principal: Catálogo de Serviços
CREATE TABLE IF NOT EXISTS catalogo_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid DEFAULT get_empresa_id(),
  nome text NOT NULL,
  categoria text NOT NULL,
  descricao text,
  prazo_estimado text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela filha: Preços por UF
CREATE TABLE IF NOT EXISTS catalogo_precos_uf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid DEFAULT get_empresa_id(),
  servico_id uuid NOT NULL REFERENCES catalogo_servicos(id) ON DELETE CASCADE,
  uf char(2) NOT NULL,
  honorario_trevo numeric NOT NULL DEFAULT 0,
  taxa_orgao numeric NOT NULL DEFAULT 0,
  prazo_estimado text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(servico_id, uf)
);

-- RLS: catalogo_servicos
ALTER TABLE catalogo_servicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogo_servicos_select ON catalogo_servicos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY catalogo_servicos_insert ON catalogo_servicos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY catalogo_servicos_update ON catalogo_servicos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY catalogo_servicos_delete ON catalogo_servicos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- RLS: catalogo_precos_uf
ALTER TABLE catalogo_precos_uf ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogo_precos_uf_select ON catalogo_precos_uf
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY catalogo_precos_uf_insert ON catalogo_precos_uf
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY catalogo_precos_uf_update ON catalogo_precos_uf
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY catalogo_precos_uf_delete ON catalogo_precos_uf
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_catalogo_precos_uf_servico ON catalogo_precos_uf(servico_id);
CREATE INDEX IF NOT EXISTS idx_catalogo_precos_uf_uf ON catalogo_precos_uf(uf);
CREATE INDEX IF NOT EXISTS idx_catalogo_servicos_empresa ON catalogo_servicos(empresa_id);
