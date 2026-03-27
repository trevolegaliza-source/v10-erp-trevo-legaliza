
CREATE TABLE public.extratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id),
  pdf_url text NOT NULL,
  filename text NOT NULL,
  total_honorarios numeric(12,2) NOT NULL DEFAULT 0,
  total_taxas numeric(12,2) NOT NULL DEFAULT 0,
  total_geral numeric(12,2) NOT NULL DEFAULT 0,
  qtd_processos integer NOT NULL DEFAULT 0,
  processo_ids uuid[] NOT NULL DEFAULT '{}',
  competencia_mes integer NOT NULL,
  competencia_ano integer NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE public.extratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extratos_authenticated_all" ON public.extratos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_extratos_cliente ON public.extratos(cliente_id);
CREATE INDEX idx_extratos_competencia ON public.extratos(competencia_mes, competencia_ano);
CREATE INDEX idx_extratos_status ON public.extratos(status);

ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS extrato_id uuid REFERENCES public.extratos(id);
