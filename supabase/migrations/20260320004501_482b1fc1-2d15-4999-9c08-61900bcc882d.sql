-- Create colaboradores table
CREATE TABLE public.colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text,
  regime text NOT NULL DEFAULT 'CLT' CHECK (regime IN ('CLT', 'PJ')),
  salario_base numeric NOT NULL DEFAULT 0,
  vt_diario numeric NOT NULL DEFAULT 0,
  vr_diario numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "colaboradores_authenticated_all"
ON public.colaboradores
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Add colaborador_id to lancamentos for linking
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE SET NULL;