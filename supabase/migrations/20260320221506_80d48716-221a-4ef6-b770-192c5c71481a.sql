
-- Add new HR fields to colaboradores
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS aniversario date;

-- Create colaborador_avaliacoes table
CREATE TABLE IF NOT EXISTS public.colaborador_avaliacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  feedback text,
  conclusao_trimestral text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(colaborador_id, mes, ano)
);

ALTER TABLE public.colaborador_avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avaliacoes_authenticated_all" ON public.colaborador_avaliacoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
