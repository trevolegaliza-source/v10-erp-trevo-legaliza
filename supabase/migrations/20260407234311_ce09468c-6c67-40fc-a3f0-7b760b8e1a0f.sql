CREATE TABLE IF NOT EXISTS public.orcamento_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES orcamentos(id) ON DELETE CASCADE,
  empresa_id uuid DEFAULT get_empresa_id(),
  modo text NOT NULL CHECK (modo IN ('contador', 'cliente')),
  versao integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  url text NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  gerado_em timestamptz NOT NULL DEFAULT now(),
  cancelado_em timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orcamento_pdfs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orcamento_pdfs_select" ON public.orcamento_pdfs
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_insert" ON public.orcamento_pdfs
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_update" ON public.orcamento_pdfs
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "orcamento_pdfs_delete" ON public.orcamento_pdfs
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE INDEX IF NOT EXISTS idx_orcamento_pdfs_orcamento ON public.orcamento_pdfs(orcamento_id);