ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_modulo_check;

ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_modulo_check CHECK (
  modulo = ANY (ARRAY[
    'dashboard'::text,
    'processos'::text,
    'clientes'::text,
    'importar'::text,
    'orcamentos'::text,
    'catalogo'::text,
    'financeiro'::text,
    'contas_pagar'::text,
    'relatorios_dre'::text,
    'fluxo_caixa'::text,
    'colaboradores'::text,
    'documentos'::text,
    'intel_geografica'::text,
    'configuracoes'::text
  ])
);