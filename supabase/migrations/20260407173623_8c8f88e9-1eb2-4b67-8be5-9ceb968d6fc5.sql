-- Plano de contas
CREATE TABLE IF NOT EXISTS plano_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid DEFAULT get_empresa_id(),
  codigo text NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL,
  grupo text NOT NULL,
  subgrupo text,
  centro_custo text,
  ativo boolean NOT NULL DEFAULT true,
  parent_id uuid REFERENCES plano_contas(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;

CREATE POLICY plano_contas_select ON plano_contas
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY plano_contas_insert ON plano_contas
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY plano_contas_update ON plano_contas
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY plano_contas_delete ON plano_contas
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE INDEX IF NOT EXISTS idx_plano_contas_empresa ON plano_contas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_plano_contas_tipo ON plano_contas(tipo);

-- Vincular lançamentos ao plano de contas
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS conta_id uuid REFERENCES plano_contas(id);
ALTER TABLE lancamentos ADD COLUMN IF NOT EXISTS centro_custo text;