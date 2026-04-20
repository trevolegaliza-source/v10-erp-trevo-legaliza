-- Backup snapshots
CREATE TABLE IF NOT EXISTS public.backup_lancamentos_20260420 AS 
SELECT * FROM public.lancamentos;

CREATE TABLE IF NOT EXISTS public.backup_extratos_20260420 AS 
SELECT * FROM public.extratos;

CREATE TABLE IF NOT EXISTS public.backup_valores_adicionais_20260420 AS 
SELECT * FROM public.valores_adicionais;

-- Enable RLS
ALTER TABLE public.backup_lancamentos_20260420 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_extratos_20260420 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_valores_adicionais_20260420 ENABLE ROW LEVEL SECURITY;

-- Master-only read policies
CREATE POLICY "backup_lancamentos_master_read" ON public.backup_lancamentos_20260420
  FOR SELECT TO authenticated USING (public.get_user_role() = 'master');

CREATE POLICY "backup_extratos_master_read" ON public.backup_extratos_20260420
  FOR SELECT TO authenticated USING (public.get_user_role() = 'master');

CREATE POLICY "backup_valores_adicionais_master_read" ON public.backup_valores_adicionais_20260420
  FOR SELECT TO authenticated USING (public.get_user_role() = 'master');