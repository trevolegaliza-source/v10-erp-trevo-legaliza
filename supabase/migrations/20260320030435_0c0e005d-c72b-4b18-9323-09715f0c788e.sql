ALTER TABLE public.colaboradores 
  ADD COLUMN IF NOT EXISTS aumento_previsto_valor numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aumento_previsto_data text DEFAULT NULL;