
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL,
  modulo TEXT NOT NULL CHECK (modulo IN (
    'dashboard','processos','clientes','orcamentos',
    'financeiro','contas_pagar','colaboradores',
    'documentos','intel_geografica','configuracoes'
  )),
  pode_ver BOOLEAN DEFAULT FALSE,
  pode_criar BOOLEAN DEFAULT FALSE,
  pode_editar BOOLEAN DEFAULT FALSE,
  pode_excluir BOOLEAN DEFAULT FALSE,
  pode_aprovar BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, modulo)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid recursion when querying profiles from RLS
CREATE OR REPLACE FUNCTION public.get_user_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Separate policies per operation
CREATE POLICY "permissions_select_by_empresa" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_user_empresa_id());

CREATE POLICY "permissions_insert_by_empresa" ON public.user_permissions
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "permissions_update_by_empresa" ON public.user_permissions
  FOR UPDATE TO authenticated
  USING (empresa_id = public.get_user_empresa_id())
  WITH CHECK (empresa_id = public.get_user_empresa_id());

CREATE POLICY "permissions_delete_by_empresa" ON public.user_permissions
  FOR DELETE TO authenticated
  USING (empresa_id = public.get_user_empresa_id());
