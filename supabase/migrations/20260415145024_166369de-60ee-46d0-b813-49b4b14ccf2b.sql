ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url text;