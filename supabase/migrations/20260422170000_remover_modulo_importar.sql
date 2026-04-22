-- =============================================
-- Remover módulo "importar" (Importar Planilha)
-- =============================================
-- Funcionalidade obsoleta: foi criada antes do ERP integrar com a
-- API do Trello. Removida do frontend (rota, página, lib, sidebar,
-- constants/roles). Esta migration:
--   1. Apaga linhas em user_permissions que referenciam 'importar'
--   2. Recria o CHECK constraint sem 'importar'
-- =============================================

-- 1) Limpa permissões existentes pra esse módulo
DELETE FROM public.user_permissions WHERE modulo = 'importar';

-- 2) Recria o CHECK constraint sem 'importar'
ALTER TABLE public.user_permissions DROP CONSTRAINT IF EXISTS user_permissions_modulo_check;

-- Lista idêntica à original (migration 20260412215401) com 'importar' removido.
ALTER TABLE public.user_permissions ADD CONSTRAINT user_permissions_modulo_check CHECK (
  modulo = ANY (ARRAY[
    'dashboard'::text,
    'processos'::text,
    'clientes'::text,
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
