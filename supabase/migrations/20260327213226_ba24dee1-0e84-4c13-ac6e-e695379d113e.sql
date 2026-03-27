ALTER TABLE public.extratos ADD COLUMN IF NOT EXISTS enviado boolean NOT NULL DEFAULT false;
ALTER TABLE public.extratos ADD COLUMN IF NOT EXISTS data_envio timestamptz;