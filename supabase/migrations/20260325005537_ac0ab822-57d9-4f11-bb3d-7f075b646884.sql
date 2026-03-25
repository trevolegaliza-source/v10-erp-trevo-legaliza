
-- 1. Create despesas_recorrentes table
CREATE TABLE IF NOT EXISTS public.despesas_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL,
  subcategoria TEXT,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  dia_vencimento INTEGER NOT NULL DEFAULT 10,
  fornecedor TEXT,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.despesas_recorrentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "despesas_recorrentes_authenticated_all"
  ON public.despesas_recorrentes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- 2. Add new columns to lancamentos
ALTER TABLE public.lancamentos
  ADD COLUMN IF NOT EXISTS subcategoria TEXT,
  ADD COLUMN IF NOT EXISTS fornecedor TEXT,
  ADD COLUMN IF NOT EXISTS despesa_recorrente_id UUID REFERENCES public.despesas_recorrentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS competencia_mes INTEGER,
  ADD COLUMN IF NOT EXISTS competencia_ano INTEGER;

-- 3. Enable realtime for despesas_recorrentes
ALTER PUBLICATION supabase_realtime ADD TABLE public.despesas_recorrentes;
