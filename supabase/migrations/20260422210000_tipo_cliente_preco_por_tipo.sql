-- =============================================
-- Novo tipo de cliente "PRECO_POR_TIPO" + tabela de preços por tipo
-- =============================================
-- Thales quer uma nova metodologia de precificação: cliente recebe
-- preço fixo X pra abertura e preço fixo Y pra alteração /
-- transformação / encerramento. Sem desconto progressivo, sem
-- franquia — só o preço do tipo do processo.
--
-- Estrutura:
--   1. ENUM tipo_cliente ganha valor 'PRECO_POR_TIPO'
--   2. Nova tabela cliente_precos_por_tipo (cliente_id, tipo, valor)
--      1 linha por combinação cliente × tipo_processo. Simples, tipado.
--   3. Helper get_preco_por_tipo(cliente_id, tipo) → NUMERIC que
--      retorna o preço configurado (NULL se não configurado).
--   4. RLS isolada por empresa via JOIN em clientes.empresa_id.
-- =============================================

-- 1) Novo valor no ENUM
ALTER TYPE public.tipo_cliente ADD VALUE IF NOT EXISTS 'PRECO_POR_TIPO';

-- 2) Tabela de preços por tipo
CREATE TABLE IF NOT EXISTS public.cliente_precos_por_tipo (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id  UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo        public.tipo_processo NOT NULL,
  valor       NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cliente_id, tipo)
);

COMMENT ON TABLE public.cliente_precos_por_tipo IS
  'Preços fixos por tipo de processo pra clientes tipo=PRECO_POR_TIPO. Substitui desconto progressivo/franquia: cliente paga valor exato do tipo do processo, sem escala.';

CREATE INDEX IF NOT EXISTS idx_cliente_precos_cliente
  ON public.cliente_precos_por_tipo(cliente_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public._cliente_precos_touch_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_precos_touch_updated ON public.cliente_precos_por_tipo;
CREATE TRIGGER trg_cliente_precos_touch_updated
  BEFORE UPDATE ON public.cliente_precos_por_tipo
  FOR EACH ROW
  EXECUTE FUNCTION public._cliente_precos_touch_updated();

-- 3) RLS por empresa (via JOIN em clientes)
ALTER TABLE public.cliente_precos_por_tipo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cliente_precos_select" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_select" ON public.cliente_precos_por_tipo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_precos_por_tipo.cliente_id
        AND c.empresa_id = public.get_empresa_id()
    )
  );

DROP POLICY IF EXISTS "cliente_precos_insert" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_insert" ON public.cliente_precos_por_tipo
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_precos_por_tipo.cliente_id
        AND c.empresa_id = public.get_empresa_id()
    )
    AND public.get_user_role() IN ('master', 'gerente', 'financeiro')
  );

DROP POLICY IF EXISTS "cliente_precos_update" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_update" ON public.cliente_precos_por_tipo
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_precos_por_tipo.cliente_id
        AND c.empresa_id = public.get_empresa_id()
    )
    AND public.get_user_role() IN ('master', 'gerente', 'financeiro')
  );

DROP POLICY IF EXISTS "cliente_precos_delete" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_delete" ON public.cliente_precos_por_tipo
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clientes c
      WHERE c.id = cliente_precos_por_tipo.cliente_id
        AND c.empresa_id = public.get_empresa_id()
    )
    AND public.get_user_role() = 'master'
  );

-- 4) Helper pra consultar preço configurado
-- Retorna NUMERIC (valor) ou NULL se não tem preço configurado.
CREATE OR REPLACE FUNCTION public.get_preco_por_tipo(
  p_cliente_id UUID,
  p_tipo       public.tipo_processo
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT valor
    FROM public.cliente_precos_por_tipo
   WHERE cliente_id = p_cliente_id
     AND tipo = p_tipo
   LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_preco_por_tipo(UUID, public.tipo_processo) TO authenticated;
