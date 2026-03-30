CREATE TABLE IF NOT EXISTS public.contatos_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf char(2) NOT NULL,
  tipo text NOT NULL,
  nome text NOT NULL,
  municipio text,
  site_url text,
  telefone text,
  email text,
  contato_interno text,
  endereco text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.contatos_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contatos_estado_auth" ON public.contatos_estado FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_contatos_estado_uf ON public.contatos_estado(uf);
CREATE INDEX idx_contatos_estado_tipo ON public.contatos_estado(tipo);
CREATE INDEX idx_contatos_estado_municipio ON public.contatos_estado(municipio);

CREATE TABLE IF NOT EXISTS public.notas_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf char(2) NOT NULL UNIQUE,
  conteudo text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.notas_estado ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_estado_auth" ON public.notas_estado FOR ALL TO authenticated USING (true) WITH CHECK (true);