-- =============================================
-- Blindar empresa_id — fechar o bug "RLS falha aberta"
-- =============================================
-- Problema: hoje profiles.empresa_id é nullable. Se algum user tiver
-- empresa_id = NULL (signup quebrado, import manual, seed legacy), a
-- RPC get_empresa_id() retorna NULL. Aí toda policy que usa
-- `empresa_id = get_empresa_id()` vira `empresa_id = NULL`, que em
-- Postgres dá NULL (não FALSE). NULL em contexto booleano de RLS é
-- tratado como "indeterminado" → a policy NÃO filtra nada → o user
-- vê TUDO de todas as empresas.
--
-- Correção em 3 camadas:
--   1. Preencher empresa_id NULL em profiles existentes com empresa
--      nova (cada profile órfão ganha um empresa_id único via
--      gen_random_uuid, isolando cada um em tenant próprio — mais
--      seguro do que mesclar todos numa empresa sem critério).
--   2. ALTER TABLE profiles ALTER COLUMN empresa_id SET NOT NULL.
--   3. Reescrever get_empresa_id() pra RAISE EXCEPTION se NULL
--      (defesa em profundidade — se de alguma forma um profile
--      perder empresa_id no futuro, queries falham em vez de vazar).
-- =============================================

-- 1) Backfill de empresa_id NULL (cada órfão vira sua própria empresa)
UPDATE public.profiles
   SET empresa_id = gen_random_uuid()
 WHERE empresa_id IS NULL;

-- 2) NOT NULL constraint
ALTER TABLE public.profiles
  ALTER COLUMN empresa_id SET NOT NULL;

-- 3) get_empresa_id() com validação hard
-- Vira LANGUAGE plpgsql pra permitir RAISE EXCEPTION.
-- Mantém STABLE + SECURITY DEFINER + search_path = public.
CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  -- Sem usuário autenticado: devolve NULL (caller típico é anon em RPC
  -- pública tipo get_cobranca_por_token, que não precisa de empresa_id).
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT empresa_id INTO v_empresa_id
    FROM public.profiles
   WHERE id = v_uid;

  -- Usuário autenticado mas sem profile: tentativa explícita de
  -- acessar dados protegidos sem pertencer a empresa alguma.
  -- Falhar explicitamente é mais seguro que retornar NULL.
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Usuário % sem empresa_id no profile. Contate o administrador.', v_uid
      USING ERRCODE = 'insufficient_privilege',
            HINT = 'Verifique se o profile existe e tem empresa_id preenchido.';
  END IF;

  RETURN v_empresa_id;
END;
$$;

COMMENT ON FUNCTION public.get_empresa_id() IS
  'Retorna empresa_id do usuário autenticado. Raise exception se authenticated mas sem empresa_id (blindagem anti-RLS-aberto). Retorna NULL apenas em contextos anon (RPC pública).';
