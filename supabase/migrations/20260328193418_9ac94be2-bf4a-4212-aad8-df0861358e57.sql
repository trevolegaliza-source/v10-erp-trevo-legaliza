CREATE TABLE IF NOT EXISTS public.orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero serial,
  prospect_nome text NOT NULL,
  prospect_cnpj text,
  prospect_email text,
  prospect_telefone text,
  prospect_contato text,
  tipo_contrato text NOT NULL DEFAULT 'avulso',
  servicos jsonb NOT NULL DEFAULT '[]',
  naturezas jsonb NOT NULL DEFAULT '[]',
  escopo jsonb NOT NULL DEFAULT '[]',
  valor_base numeric(12,2) NOT NULL DEFAULT 880,
  qtd_processos integer DEFAULT 1,
  desconto_pct numeric(5,2) DEFAULT 0,
  valor_final numeric(12,2) NOT NULL DEFAULT 880,
  desconto_progressivo_ativo boolean DEFAULT false,
  desconto_progressivo_pct numeric(5,2) DEFAULT 5,
  desconto_progressivo_limite numeric(12,2) DEFAULT 600,
  validade_dias integer DEFAULT 15,
  pagamento text,
  sla text DEFAULT 'Prazo para início: até 5 dias úteis após recebimento COMPLETO da documentação. SLA de atendimento: 48 horas úteis.',
  observacoes text,
  status text DEFAULT 'rascunho',
  share_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  cliente_id uuid REFERENCES public.clientes(id),
  convertido_em timestamptz,
  pdf_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text
);

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orcamentos_authenticated_all" ON public.orcamentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX idx_orcamentos_share ON public.orcamentos(share_token);