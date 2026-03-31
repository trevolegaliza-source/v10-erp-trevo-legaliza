
-- =============================================
-- ADD empresa_id + REPLACE RLS FOR 6 TABLES
-- =============================================

-- 1. CLIENTES
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.clientes SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "clientes_all" ON public.clientes;
DROP POLICY IF EXISTS "clientes_authenticated_all" ON public.clientes;

CREATE POLICY "clientes_select" ON public.clientes FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "clientes_insert" ON public.clientes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "clientes_update" ON public.clientes FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "clientes_delete" ON public.clientes FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 2. PROCESSOS
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.processos SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "processos_all" ON public.processos;
DROP POLICY IF EXISTS "processos_authenticated_all" ON public.processos;

CREATE POLICY "processos_select" ON public.processos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "processos_insert" ON public.processos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "processos_update" ON public.processos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "processos_delete" ON public.processos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 3. LANCAMENTOS
ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.lancamentos SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "lancamentos_all" ON public.lancamentos;
DROP POLICY IF EXISTS "lancamentos_authenticated_all" ON public.lancamentos;

CREATE POLICY "lancamentos_select" ON public.lancamentos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "lancamentos_insert" ON public.lancamentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "lancamentos_update" ON public.lancamentos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "lancamentos_delete" ON public.lancamentos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 4. COLABORADORES
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.colaboradores SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "colaboradores_all" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_authenticated_all" ON public.colaboradores;

CREATE POLICY "colaboradores_select" ON public.colaboradores FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "colaboradores_insert" ON public.colaboradores FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "colaboradores_update" ON public.colaboradores FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "colaboradores_delete" ON public.colaboradores FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 5. ORCAMENTOS
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.orcamentos SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "orcamentos_all" ON public.orcamentos;
DROP POLICY IF EXISTS "orcamentos_authenticated_all" ON public.orcamentos;

CREATE POLICY "orcamentos_select" ON public.orcamentos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "orcamentos_insert" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "orcamentos_update" ON public.orcamentos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "orcamentos_delete" ON public.orcamentos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 6. DOCUMENTOS
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.documentos SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;

DROP POLICY IF EXISTS "documentos_all" ON public.documentos;
DROP POLICY IF EXISTS "documentos_authenticated_all" ON public.documentos;

CREATE POLICY "documentos_select" ON public.documentos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "documentos_insert" ON public.documentos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "documentos_update" ON public.documentos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "documentos_delete" ON public.documentos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());
