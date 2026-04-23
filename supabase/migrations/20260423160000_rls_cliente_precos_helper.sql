-- ════════════════════════════════════════════════════════════════════════════
-- Dívida técnica: 4 RLS policies em cliente_precos_por_tipo com EXISTS duplicado
-- ────────────────────────────────────────────────────────────────────────────
-- Cada uma das 4 policies (select/insert/update/delete) repete a mesma subquery:
--   EXISTS (SELECT 1 FROM clientes c WHERE c.id = ... AND c.empresa_id = get_empresa_id())
--
-- Consolidando num helper STABLE pra:
--   1. Reduzir duplicação (4 lugares → 1 fonte da verdade)
--   2. Permitir que Postgres cache melhor a checagem
--   3. Facilitar auditoria e futuras mudanças de lógica
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: retorna TRUE se o cliente pertence à empresa do usuário atual
CREATE OR REPLACE FUNCTION public.cliente_pertence_empresa(p_cliente_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = p_cliente_id
      AND c.empresa_id = public.get_empresa_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.cliente_pertence_empresa(UUID) TO authenticated;

COMMENT ON FUNCTION public.cliente_pertence_empresa IS
  'Helper RLS: checa se cliente_id pertence à empresa do usuário atual. STABLE para permitir cache do Postgres.';

-- Recriar as 4 policies usando o helper
DROP POLICY IF EXISTS "cliente_precos_select" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_select" ON public.cliente_precos_por_tipo
  FOR SELECT TO authenticated
  USING (public.cliente_pertence_empresa(cliente_id));

DROP POLICY IF EXISTS "cliente_precos_insert" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_insert" ON public.cliente_precos_por_tipo
  FOR INSERT TO authenticated
  WITH CHECK (
    public.cliente_pertence_empresa(cliente_id)
    AND public.get_user_role() IN ('master', 'gerente', 'financeiro')
  );

-- UPDATE: mantém comportamento original — role check no USING (não apenas WITH CHECK),
-- pra garantir que não-roles sequer enxerguem os rows pra tentar update.
DROP POLICY IF EXISTS "cliente_precos_update" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_update" ON public.cliente_precos_por_tipo
  FOR UPDATE TO authenticated
  USING (
    public.cliente_pertence_empresa(cliente_id)
    AND public.get_user_role() IN ('master', 'gerente', 'financeiro')
  )
  WITH CHECK (
    public.cliente_pertence_empresa(cliente_id)
    AND public.get_user_role() IN ('master', 'gerente', 'financeiro')
  );

DROP POLICY IF EXISTS "cliente_precos_delete" ON public.cliente_precos_por_tipo;
CREATE POLICY "cliente_precos_delete" ON public.cliente_precos_por_tipo
  FOR DELETE TO authenticated
  USING (
    public.cliente_pertence_empresa(cliente_id)
    AND public.get_user_role() = 'master'
  );

COMMENT ON POLICY "cliente_precos_select" ON public.cliente_precos_por_tipo IS
  'Usa helper cliente_pertence_empresa (STABLE). Substituiu EXISTS inline duplicado.';
