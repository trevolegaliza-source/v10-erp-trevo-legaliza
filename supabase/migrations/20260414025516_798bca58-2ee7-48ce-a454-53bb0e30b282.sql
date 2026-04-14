
-- Add user management columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS convidado_por uuid REFERENCES public.profiles(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS convidado_em timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS motivo_inativacao text;

COMMENT ON COLUMN public.profiles.convidado_por IS 'Profile ID de quem convidou este usuário';
COMMENT ON COLUMN public.profiles.convidado_em IS 'Quando o convite foi enviado';
COMMENT ON COLUMN public.profiles.ultimo_acesso IS 'Último login do usuário';
COMMENT ON COLUMN public.profiles.motivo_inativacao IS 'Motivo se o usuário foi desativado';

-- Role templates table
CREATE TABLE IF NOT EXISTS public.role_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL UNIQUE,
  nome_display text NOT NULL,
  descricao text,
  modulos_padrao text[] NOT NULL DEFAULT '{}',
  cor text DEFAULT 'gray',
  ordem int DEFAULT 0
);

-- Populate role templates
INSERT INTO public.role_templates (role, nome_display, descricao, modulos_padrao, cor, ordem) VALUES
  ('master', 'Master', 'Acesso total ao sistema. Configura usuários e permissões.', 
   ARRAY['dashboard','cadastro_rapido','processos','clientes','orcamentos','financeiro','contas_pagar','colaboradores','relatorios_dre','fluxo_caixa','documentos','intel_geografica','catalogo','configuracoes'], 
   'red', 1),
  ('gerente', 'Gerente', 'Opera o sistema com autonomia. Não configura usuários.',
   ARRAY['dashboard','cadastro_rapido','processos','clientes','orcamentos','financeiro','contas_pagar','relatorios_dre','fluxo_caixa','documentos','intel_geografica','catalogo'],
   'purple', 2),
  ('financeiro', 'Financeiro', 'Cobranças, extratos, contas a pagar e relatórios.',
   ARRAY['processos','clientes','financeiro','contas_pagar','relatorios_dre','fluxo_caixa','colaboradores'],
   'blue', 3),
  ('operacional', 'Operacional', 'Processos, clientes, cadastro rápido e documentos.',
   ARRAY['cadastro_rapido','processos','clientes','documentos','intel_geografica','catalogo'],
   'green', 4),
  ('visualizador', 'Visualizador', 'Somente leitura nos módulos autorizados.',
   ARRAY['processos','clientes'],
   'gray', 5)
ON CONFLICT (role) DO NOTHING;

-- RLS for role_templates
ALTER TABLE public.role_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "role_templates_select"
ON public.role_templates FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "role_templates_write_master"
ON public.role_templates FOR INSERT
TO authenticated
WITH CHECK (get_user_role() = 'master');

CREATE POLICY "role_templates_update_master"
ON public.role_templates FOR UPDATE
TO authenticated
USING (get_user_role() = 'master')
WITH CHECK (get_user_role() = 'master');

CREATE POLICY "role_templates_delete_master"
ON public.role_templates FOR DELETE
TO authenticated
USING (get_user_role() = 'master');
