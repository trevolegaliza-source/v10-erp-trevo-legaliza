ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS nome_contato_financeiro text;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS telefone_financeiro text;

COMMENT ON COLUMN public.clientes.nome_contato_financeiro IS 'Nome do responsável financeiro do escritório (se diferente do contador)';
COMMENT ON COLUMN public.clientes.telefone_financeiro IS 'Telefone do financeiro (se diferente do telefone principal)';