
-- Adicionar colunas de rastreamento de status
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS enviado_em timestamptz;
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS aprovado_em timestamptz;

-- Tabela de contratos
CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES orcamentos(id) ON DELETE CASCADE,
  empresa_id uuid DEFAULT get_empresa_id(),
  numero_contrato text NOT NULL,
  
  contratante_tipo text DEFAULT 'juridica' CHECK (contratante_tipo IN ('juridica', 'fisica')),
  contratante_nome text NOT NULL,
  contratante_cnpj_cpf text NOT NULL,
  contratante_endereco text NOT NULL,
  contratante_representante text NOT NULL,
  contratante_representante_cpf text NOT NULL,
  contratante_representante_qualificacao text,
  
  contratada_nome text DEFAULT 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  contratada_cnpj text DEFAULT '39.969.412/0001-70',
  contratada_endereco text DEFAULT 'Rua Brasil, nº 1170, Rudge Ramos, São Bernardo do Campo/SP',
  contratada_representante text DEFAULT 'Dr. Thales Felipe Burger',
  contratada_representante_cpf text DEFAULT '447.821.658-46',
  contratada_representante_qualificacao text DEFAULT 'empresário e advogado, brasileiro, solteiro',
  
  cidade_contrato text DEFAULT 'São Bernardo do Campo/SP',
  data_contrato date DEFAULT CURRENT_DATE,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contratos_select" ON public.contratos
  FOR SELECT TO authenticated
  USING (empresa_id = get_empresa_id());

CREATE POLICY "contratos_insert" ON public.contratos
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "contratos_update" ON public.contratos
  FOR UPDATE TO authenticated
  USING (empresa_id = get_empresa_id())
  WITH CHECK (empresa_id = get_empresa_id());

CREATE POLICY "contratos_delete" ON public.contratos
  FOR DELETE TO authenticated
  USING (empresa_id = get_empresa_id());
