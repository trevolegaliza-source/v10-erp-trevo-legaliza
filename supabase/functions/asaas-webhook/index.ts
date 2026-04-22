// =============================================
// Edge Function: asaas-webhook
// =============================================
// Recebe webhooks do Asaas quando pagamentos mudam de estado.
//
// Proteções em camadas:
//  1. FAIL-FAST: se ASAAS_WEBHOOK_TOKEN não estiver configurado, recusa 503
//  2. TOKEN CHECK com comparação timing-safe
//  3. IDEMPOTÊNCIA ATÔMICA via INSERT em asaas_webhook_events(event_id)
//     — conflito em unique index = já processado, retorna 200 duplicate
//  4. CUSTOMER MATCH: valida que payment.customer bate com
//     clientes.asaas_customer_id da cobrança antes de mudar estado
//  5. BODY DE RESPOSTA SANITIZADO: não vaza mensagem de erro crua
//
// Fluxo de estados das cobranças:
//   PAYMENT_CONFIRMED / PAYMENT_RECEIVED → cobranca.status = 'paga',
//     lançamentos: status=pago, etapa=honorario_pago, confirmado_recebimento=true
//   PAYMENT_OVERDUE → cobranca.status = 'vencida' (só se ainda ativa)
//   PAYMENT_DELETED / PAYMENT_RESTORED → cobranca.status = 'cancelada'
//   PAYMENT_REFUNDED / PAYMENT_REFUND_IN_PROGRESS → cobranca.status = 'cancelada'
//     + lançamentos voltam para pendente/cobranca_enviada
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, asaas-access-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function nowISO(): string {
  return new Date().toISOString();
}

// Comparação de strings resistente a timing attacks.
// Sempre percorre o maior tamanho, evitando early-return por length diff.
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

type CobrancaWithCliente = {
  id: string;
  lancamento_ids: string[] | null;
  status: string;
  cliente_id: string;
  clientes: { asaas_customer_id: string | null } | null;
};

async function fetchCobrancaByPaymentId(
  paymentId: string
): Promise<CobrancaWithCliente | null> {
  const { data } = await admin
    .from("cobrancas")
    .select(
      "id, lancamento_ids, status, cliente_id, clientes(asaas_customer_id)"
    )
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  return (data as any) ?? null;
}

/**
 * Garante que o customer informado no payload do Asaas corresponde
 * ao asaas_customer_id registrado no cliente desta cobrança.
 * Defende contra webhook forjado com payment_id válido mas customer divergente.
 */
function assertCustomerMatches(
  cobranca: CobrancaWithCliente,
  payload: any
): void {
  const payloadCustomer: string | undefined = payload?.payment?.customer;
  const clienteCustomer = cobranca.clientes?.asaas_customer_id ?? null;
  if (!payloadCustomer) {
    throw new Error("payload sem payment.customer");
  }
  if (!clienteCustomer) {
    throw new Error(
      `cliente ${cobranca.cliente_id} sem asaas_customer_id registrado`
    );
  }
  if (payloadCustomer !== clienteCustomer) {
    throw new Error(
      `customer mismatch: payload=${payloadCustomer} cobranca=${clienteCustomer}`
    );
  }
}

async function handlePaidEvent(paymentId: string, event: any) {
  const cobranca = await fetchCobrancaByPaymentId(paymentId);
  if (!cobranca) {
    throw new Error(`cobrança não encontrada para payment_id=${paymentId}`);
  }
  assertCustomerMatches(cobranca, event);

  const confirmedAt =
    event?.payment?.confirmedDate ||
    event?.payment?.creditDate ||
    event?.payment?.paymentDate ||
    nowISO();

  await admin
    .from("cobrancas")
    .update({
      status: "paga",
      asaas_status: event?.payment?.status ?? "RECEIVED",
      asaas_pago_em: confirmedAt,
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", cobranca.id);

  const lancamentoIds = cobranca.lancamento_ids;
  if (Array.isArray(lancamentoIds) && lancamentoIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({
        status: "pago",
        etapa_financeiro: "honorario_pago",
        data_pagamento:
          (confirmedAt && String(confirmedAt).split("T")[0]) || todayISO(),
        confirmado_recebimento: true,
      } as any)
      .in("id", lancamentoIds);
  }
}

async function handleOverdueEvent(paymentId: string, event: any) {
  const cobranca = await fetchCobrancaByPaymentId(paymentId);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);
  if (cobranca.status !== "ativa") return; // já paga/cancelada

  await admin
    .from("cobrancas")
    .update({
      status: "vencida",
      asaas_status: event?.payment?.status ?? "OVERDUE",
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", cobranca.id);
}

async function handleCanceledEvent(paymentId: string, event: any) {
  const cobranca = await fetchCobrancaByPaymentId(paymentId);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);
  if (cobranca.status === "paga") return; // conservador: não cancela o que já foi pago

  await admin
    .from("cobrancas")
    .update({
      status: "cancelada",
      asaas_status: event?.payment?.status ?? "CANCELED",
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", cobranca.id);
  // Conservador: não mexe em lançamentos aqui; Thales/Carolina reagem manualmente.
}

async function handleRefundedEvent(paymentId: string, event: any) {
  const cobranca = await fetchCobrancaByPaymentId(paymentId);
  if (!cobranca) return;
  assertCustomerMatches(cobranca, event);

  await admin
    .from("cobrancas")
    .update({
      status: "cancelada",
      asaas_status: event?.payment?.status ?? "REFUNDED",
      asaas_pago_em: null,
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", cobranca.id);

  const lancamentoIds = cobranca.lancamento_ids;
  if (Array.isArray(lancamentoIds) && lancamentoIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({
        status: "pendente",
        etapa_financeiro: "cobranca_enviada",
        data_pagamento: null,
        confirmado_recebimento: false,
      } as any)
      .in("id", lancamentoIds);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // === FAIL-FAST ===
  // Sem token configurado, o webhook ficaria completamente aberto.
  // Retornamos 503 e logamos em CRITICAL — Asaas vai retentar,
  // dando tempo pro Thales configurar o secret sem perder eventos.
  if (!WEBHOOK_TOKEN || WEBHOOK_TOKEN.trim().length === 0) {
    console.error(
      "[asaas-webhook] CRITICAL: ASAAS_WEBHOOK_TOKEN não configurado; rejeitando todas as chamadas"
    );
    return new Response(
      JSON.stringify({ error: "webhook token not configured" }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // Validação de origem — comparação timing-safe
  const headerToken = req.headers.get("asaas-access-token") ?? "";
  if (!timingSafeEqual(headerToken, WEBHOOK_TOKEN)) {
    console.warn("[asaas-webhook] invalid access-token header");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = null;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventId: string | undefined = payload?.id ?? payload?.event_id;
  const eventType: string = payload?.event ?? payload?.type ?? "UNKNOWN";
  const paymentId: string | undefined = payload?.payment?.id;

  // === IDEMPOTÊNCIA ATÔMICA ===
  // Tentamos INSERT já; o unique index parcial em event_id (WHERE event_id IS NOT NULL)
  // garante que só um worker consegue inserir. Conflito (23505) = já processado/processando,
  // respondemos 200 duplicate sem reexecutar efeito.
  // Eventos sem event_id passam sem dedupe (raro, melhor processar do que perder).
  let logId: string | null = null;
  if (eventId) {
    const { data: inserted, error: insertErr } = await admin
      .from("asaas_webhook_events")
      .insert({
        event_id: eventId,
        event_type: eventType,
        asaas_payment_id: paymentId ?? null,
        processed: false,
        payload,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      if ((insertErr as any).code === "23505") {
        // unique_violation → já existe esse event_id
        return new Response(JSON.stringify({ ok: true, duplicate: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("[asaas-webhook] erro ao registrar evento:", insertErr);
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    logId = (inserted as any)?.id ?? null;
  } else {
    const { data: inserted } = await admin
      .from("asaas_webhook_events")
      .insert({
        event_id: null,
        event_type: eventType,
        asaas_payment_id: paymentId ?? null,
        processed: false,
        payload,
      })
      .select("id")
      .maybeSingle();
    logId = (inserted as any)?.id ?? null;
  }

  let processError: string | null = null;
  try {
    if (!paymentId) {
      console.log("[asaas-webhook] evento sem payment.id:", eventType);
    } else {
      switch (eventType) {
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
          await handlePaidEvent(paymentId, payload);
          break;
        case "PAYMENT_OVERDUE":
          await handleOverdueEvent(paymentId, payload);
          break;
        case "PAYMENT_DELETED":
        case "PAYMENT_RESTORED":
          await handleCanceledEvent(paymentId, payload);
          break;
        case "PAYMENT_REFUNDED":
        case "PAYMENT_REFUND_IN_PROGRESS":
          await handleRefundedEvent(paymentId, payload);
          break;
        case "PAYMENT_CREATED":
        case "PAYMENT_UPDATED":
        case "PAYMENT_AWAITING_RISK_ANALYSIS":
        case "PAYMENT_APPROVED_BY_RISK_ANALYSIS":
        case "PAYMENT_REPROVED_BY_RISK_ANALYSIS":
        case "PAYMENT_DUNNING_RECEIVED":
        case "PAYMENT_DUNNING_REQUESTED":
        case "PAYMENT_BANK_SLIP_VIEWED":
        case "PAYMENT_CHECKOUT_VIEWED":
        case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED":
          // informacional — só registramos
          break;
        default:
          console.log("[asaas-webhook] evento não tratado:", eventType);
      }
    }
  } catch (e) {
    processError = e instanceof Error ? e.message : String(e);
    console.error("[asaas-webhook] erro ao processar:", processError);
  }

  if (logId) {
    await admin
      .from("asaas_webhook_events")
      .update({
        processed: processError === null,
        error: processError,
      })
      .eq("id", logId);
  }

  // Sempre 200 pro Asaas não retentar; erros ficam registrados no DB.
  // Body enxuto — mensagem de erro crua fica só no log + asaas_webhook_events.error.
  return new Response(
    JSON.stringify({
      ok: processError === null,
      event_type: eventType,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
