
ALTER TABLE public.colaboradores 
  ADD COLUMN IF NOT EXISTS tipo_transporte text NOT NULL DEFAULT 'vt',
  ADD COLUMN IF NOT EXISTS auxilio_combustivel_valor numeric NOT NULL DEFAULT 0;
