-- =============================================
-- Lock anti-race-condition na geração de cobrança Asaas
-- =============================================
-- Evita que duas chamadas simultâneas à edge function
-- `asaas-gerar-cobranca` criem dois Payments no Asaas
-- para a mesma cobrança.
--
-- Mecânica: UPDATE compare-and-swap com timeout.
--   - Se asaas_gerando_lock_ate está no passado (ou NULL),
--     o próximo worker adquire o lock por 60s.
--   - Workers concorrentes falham silenciosamente no UPDATE
--     (0 rows) e recebem resposta "in_progress".
--   - Se o worker que tem o lock morrer, o timeout expira
--     e outro pode retentar.
-- =============================================

ALTER TABLE public.cobrancas
  ADD COLUMN IF NOT EXISTS asaas_gerando_lock_ate TIMESTAMPTZ;

COMMENT ON COLUMN public.cobrancas.asaas_gerando_lock_ate IS
  'Timestamp até quando a cobrança está "bloqueada" por uma edge function gerando Asaas. Se NULL ou no passado, o lock está livre.';

-- =============================================
-- RPC atômica: tenta adquirir o lock OU devolve estado atual
-- =============================================
-- Retorna JSONB com:
--   { acquired: true }                              → pode chamar Asaas
--   { acquired: false, reason: 'not_found' }        → cobrança inexistente
--   { acquired: false, reason: 'already_generated',
--     asaas_payment_id: '...' }                     → já foi gerada antes
--   { acquired: false, reason: 'in_progress',
--     locked_until: '...' }                         → outro worker processando
--   { acquired: false, reason: 'wrong_status',
--     status: 'paga' }                              → cobrança paga/cancelada
-- =============================================

CREATE OR REPLACE FUNCTION public.asaas_tentar_lock_cobranca(
  p_cobranca_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row            RECORD;
  v_now            TIMESTAMPTZ := NOW();
  v_lock_duration  INTERVAL    := '60 seconds';
  v_updated_count  INTEGER;
BEGIN
  -- UPDATE CAS: só consegue gravar quem encontra lock livre
  UPDATE public.cobrancas
     SET asaas_gerando_lock_ate = v_now + v_lock_duration
   WHERE id = p_cobranca_id
     AND asaas_payment_id IS NULL
     AND status NOT IN ('paga', 'cancelada')
     AND (asaas_gerando_lock_ate IS NULL OR asaas_gerando_lock_ate < v_now);

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 1 THEN
    RETURN jsonb_build_object('acquired', true);
  END IF;

  -- Não adquiriu. Descobre por quê.
  SELECT asaas_payment_id, asaas_gerando_lock_ate, status
    INTO v_row
    FROM public.cobrancas
   WHERE id = p_cobranca_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('acquired', false, 'reason', 'not_found');
  END IF;

  IF v_row.status IN ('paga', 'cancelada') THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'wrong_status',
      'status', v_row.status
    );
  END IF;

  IF v_row.asaas_payment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'acquired', false,
      'reason', 'already_generated',
      'asaas_payment_id', v_row.asaas_payment_id
    );
  END IF;

  -- Só pode ser lock ativo de outro worker
  RETURN jsonb_build_object(
    'acquired', false,
    'reason', 'in_progress',
    'locked_until', v_row.asaas_gerando_lock_ate
  );
END;
$$;

-- Service role já tem acesso; autenticados também podem (mas a edge usa service).
GRANT EXECUTE ON FUNCTION public.asaas_tentar_lock_cobranca(UUID) TO authenticated, service_role;
