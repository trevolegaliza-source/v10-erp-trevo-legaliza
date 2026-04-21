// =============================================
// Edge Function: asaas-webhook
// =============================================
// Recebe webhooks do Asaas quando pagamentos mudam de estado.
// Valida origem via header `asaas-access-token` (configurado no painel Asaas).
// Garante idempotência via tabela asaas_webhook_events.
// Quando PAYMENT_CONFIRMED / PAYMENT_RECEIVED:
//   - Marca cobranca.status = 'paga', asaas_pago_em = now()
//   - Marca todos os lancamentos vinculados: status=pago,
//     etapa_financeiro=honorario_pago, data_pagamento, confirmado_recebimento=true
// Quando PAYMENT_OVERDUE → cobranca.status = 'vencida'
// Quando PAYMENT_REFUNDED / PAYMENT_DELETED → cobranca.status = 'cancelada'
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

async function handlePaidEvent(paymentId: string, event: any) {
  // Atualiza cobrança
  const { data: cobrancaRow, error: selErr } = await admin
    .from("cobrancas")
    .select("id, lancamento_ids, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();

  if (selErr || !cobrancaRow) {
    throw new Error(`cobrança não encontrada para payment_id=${paymentId}`);
  }

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
    .eq("id", cobrancaRow.id);

  // Atualiza os lançamentos vinculados
  const lancamentoIds = (cobrancaRow as any).lancamento_ids as string[] | null;
  if (Array.isArray(lancamentoIds) && lancamentoIds.length > 0) {
    await admin
      .from("lancamentos")
      .update({
        status: "pago",
        etapa_financeiro: "honorario_pago",
        data_pagamento:
          (confirmedAt && confirmedAt.split("T")[0]) || todayISO(),
        confirmado_recebimento: true,
      } as any)
      .in("id", lancamentoIds);
  }
}

async function handleOverdueEvent(paymentId: string, event: any) {
  const { data: cobrancaRow } = await admin
    .from("cobrancas")
    .select("id, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  if (!cobrancaRow) return;
  // Só muda se ainda não foi paga/cancelada
  if ((cobrancaRow as any).status === "ativa") {
    await admin
      .from("cobrancas")
      .update({
        status: "vencida",
        asaas_status: event?.payment?.status ?? "OVERDUE",
        asaas_last_event: event,
        asaas_webhook_recebido_em: nowISO(),
      })
      .eq("id", (cobrancaRow as any).id);
  }
}

async function handleCanceledEvent(paymentId: string, event: any) {
  const { data: cobrancaRow } = await admin
    .from("cobrancas")
    .select("id, lancamento_ids, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  if (!cobrancaRow) return;
  if ((cobrancaRow as any).status === "paga") return; // já paga, não cancela

  await admin
    .from("cobrancas")
    .update({
      status: "cancelada",
      asaas_status: event?.payment?.status ?? "CANCELED",
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", (cobrancaRow as any).id);

  // Lançamentos vinculados voltam para solicitacao_criada (remove extrato_id?)
  // Conservador: só marca como cancelados no Asaas, NÃO mexe nos lançamentos
  // pra não quebrar lógica do Financeiro. Thales pode reagir manualmente.
}

async function handleRefundedEvent(paymentId: string, event: any) {
  // Igual a cancelada, mas reverte lançamentos que estavam pagos
  const { data: cobrancaRow } = await admin
    .from("cobrancas")
    .select("id, lancamento_ids, status")
    .eq("asaas_payment_id", paymentId)
    .maybeSingle();
  if (!cobrancaRow) return;

  await admin
    .from("cobrancas")
    .update({
      status: "cancelada",
      asaas_status: event?.payment?.status ?? "REFUNDED",
      asaas_pago_em: null,
      asaas_last_event: event,
      asaas_webhook_recebido_em: nowISO(),
    })
    .eq("id", (cobrancaRow as any).id);

  const lancamentoIds = (cobrancaRow as any).lancamento_ids as string[] | null;
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

  // Validação de origem via token (configurado no painel Asaas)
  if (WEBHOOK_TOKEN) {
    const headerToken = req.headers.get("asaas-access-token") ?? "";
    if (headerToken !== WEBHOOK_TOKEN) {
      console.warn("[asaas-webhook] invalid access-token header");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
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

  // Idempotência — se já processamos esse event_id, retorna 200 sem fazer nada
  if (eventId) {
    const { data: existing } = await admin
      .from("asaas_webhook_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .maybeSingle();
    if (existing && (existing as any).processed) {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Registra o evento ANTES de processar (garante rastro mesmo se falhar)
  const { data: inserted } = await admin
    .from("asaas_webhook_events")
    .insert({
      event_id: eventId ?? null,
      event_type: eventType,
      asaas_payment_id: paymentId ?? null,
      processed: false,
      payload,
    })
    .select("id")
    .single();
  const logId = (inserted as any)?.id ?? null;

  let processError: string | null = null;
  try {
    if (!paymentId) {
      // Eventos sem payment.id (ex: customer events) — só logamos
      console.log("[asaas-webhook] evento sem payment.id:", eventType);
    } else {
      switch (eventType) {
        // Pagamento confirmado ou dinheiro caiu na conta
        case "PAYMENT_CONFIRMED":
        case "PAYMENT_RECEIVED":
        case "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED": // no-op mas registra
          if (
            eventType === "PAYMENT_CONFIRMED" ||
            eventType === "PAYMENT_RECEIVED"
          ) {
            await handlePaidEvent(paymentId, payload);
          }
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
          // Eventos informacionais — só registramos no log, não mudam status
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

  // Sempre retorna 200 pro Asaas (evita retries desnecessários em erros nossos)
  return new Response(
    JSON.stringify({
      ok: processError === null,
      event_type: eventType,
      error: processError,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
