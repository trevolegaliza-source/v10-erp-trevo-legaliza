
-- =============================================
-- FIX RLS ON ALL REMAINING AUXILIARY TABLES
-- =============================================

-- 1. DESPESAS_RECORRENTES
ALTER TABLE public.despesas_recorrentes ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.despesas_recorrentes SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "despesas_recorrentes_authenticated_all" ON public.despesas_recorrentes;
DROP POLICY IF EXISTS "despesas_recorrentes_all" ON public.despesas_recorrentes;
CREATE POLICY "despesas_recorrentes_select" ON public.despesas_recorrentes FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "despesas_recorrentes_insert" ON public.despesas_recorrentes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "despesas_recorrentes_update" ON public.despesas_recorrentes FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "despesas_recorrentes_delete" ON public.despesas_recorrentes FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 2. EXTRATOS
ALTER TABLE public.extratos ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.extratos SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "extratos_authenticated_all" ON public.extratos;
DROP POLICY IF EXISTS "extratos_all" ON public.extratos;
CREATE POLICY "extratos_select" ON public.extratos FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "extratos_insert" ON public.extratos FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "extratos_update" ON public.extratos FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "extratos_delete" ON public.extratos FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 3. SERVICE_NEGOTIATIONS
ALTER TABLE public.service_negotiations ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.service_negotiations SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "service_negotiations_authenticated_all" ON public.service_negotiations;
DROP POLICY IF EXISTS "service_negotiations_all" ON public.service_negotiations;
CREATE POLICY "service_negotiations_select" ON public.service_negotiations FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "service_negotiations_insert" ON public.service_negotiations FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "service_negotiations_update" ON public.service_negotiations FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "service_negotiations_delete" ON public.service_negotiations FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 4. PREPAGO_MOVIMENTACOES
ALTER TABLE public.prepago_movimentacoes ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.prepago_movimentacoes SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "prepago_movimentacoes_authenticated_all" ON public.prepago_movimentacoes;
DROP POLICY IF EXISTS "prepago_movimentacoes_all" ON public.prepago_movimentacoes;
CREATE POLICY "prepago_movimentacoes_select" ON public.prepago_movimentacoes FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "prepago_movimentacoes_insert" ON public.prepago_movimentacoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "prepago_movimentacoes_update" ON public.prepago_movimentacoes FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "prepago_movimentacoes_delete" ON public.prepago_movimentacoes FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 5. COLABORADOR_AVALIACOES
ALTER TABLE public.colaborador_avaliacoes ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.colaborador_avaliacoes SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "avaliacoes_authenticated_all" ON public.colaborador_avaliacoes;
DROP POLICY IF EXISTS "colaborador_avaliacoes_all" ON public.colaborador_avaliacoes;
CREATE POLICY "colaborador_avaliacoes_select" ON public.colaborador_avaliacoes FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "colaborador_avaliacoes_insert" ON public.colaborador_avaliacoes FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "colaborador_avaliacoes_update" ON public.colaborador_avaliacoes FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "colaborador_avaliacoes_delete" ON public.colaborador_avaliacoes FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 6. VALORES_ADICIONAIS
ALTER TABLE public.valores_adicionais ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.valores_adicionais SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "valores_adicionais_authenticated_all" ON public.valores_adicionais;
DROP POLICY IF EXISTS "valores_adicionais_all" ON public.valores_adicionais;
CREATE POLICY "valores_adicionais_select" ON public.valores_adicionais FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "valores_adicionais_insert" ON public.valores_adicionais FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "valores_adicionais_update" ON public.valores_adicionais FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "valores_adicionais_delete" ON public.valores_adicionais FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 7. WEBHOOK_CONFIGS
ALTER TABLE public.webhook_configs ADD COLUMN IF NOT EXISTS empresa_id UUID DEFAULT public.get_empresa_id();
UPDATE public.webhook_configs SET empresa_id = '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d' WHERE empresa_id IS NULL;
DROP POLICY IF EXISTS "webhook_configs_authenticated" ON public.webhook_configs;
DROP POLICY IF EXISTS "webhook_configs_all" ON public.webhook_configs;
CREATE POLICY "webhook_configs_select" ON public.webhook_configs FOR SELECT TO authenticated USING (empresa_id = public.get_empresa_id());
CREATE POLICY "webhook_configs_insert" ON public.webhook_configs FOR INSERT TO authenticated WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "webhook_configs_update" ON public.webhook_configs FOR UPDATE TO authenticated USING (empresa_id = public.get_empresa_id()) WITH CHECK (empresa_id = public.get_empresa_id());
CREATE POLICY "webhook_configs_delete" ON public.webhook_configs FOR DELETE TO authenticated USING (empresa_id = public.get_empresa_id());

-- 8. CONTATOS_ESTADO (shared data, keep read-only for all authenticated)
DROP POLICY IF EXISTS "contatos_estado_auth" ON public.contatos_estado;
CREATE POLICY "contatos_estado_select" ON public.contatos_estado FOR SELECT TO authenticated USING (true);
CREATE POLICY "contatos_estado_insert" ON public.contatos_estado FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "contatos_estado_update" ON public.contatos_estado FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "contatos_estado_delete" ON public.contatos_estado FOR DELETE TO authenticated USING (true);

-- 9. NOTAS_ESTADO (shared data)
DROP POLICY IF EXISTS "notas_estado_auth" ON public.notas_estado;
CREATE POLICY "notas_estado_select" ON public.notas_estado FOR SELECT TO authenticated USING (true);
CREATE POLICY "notas_estado_insert" ON public.notas_estado FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notas_estado_update" ON public.notas_estado FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- 10. PRECOS_TIERS (shared pricing data)
DROP POLICY IF EXISTS "precos_tiers_select_public" ON public.precos_tiers;
DROP POLICY IF EXISTS "precos_tiers_write_authenticated" ON public.precos_tiers;
CREATE POLICY "precos_tiers_select" ON public.precos_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "precos_tiers_write" ON public.precos_tiers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "precos_tiers_update" ON public.precos_tiers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
