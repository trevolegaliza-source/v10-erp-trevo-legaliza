ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS dentro_do_plano boolean DEFAULT NULL;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS valor_avulso numeric(10,2) DEFAULT 0;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS justificativa_avulso text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS link_drive text;