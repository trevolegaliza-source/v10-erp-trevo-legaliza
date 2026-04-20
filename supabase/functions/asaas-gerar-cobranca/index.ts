// =============================================
// Edge Function: asaas-gerar-cobranca
// =============================================
// Recebe { cobranca_id, data_vencimento? } autenticado (usuário master/financeiro/gerente).
// Cria (ou reutiliza) Customer no Asaas, cria Payment (boleto+PIX) e grava
// os IDs + URLs na tabela cobrancas. Retorna dados pra UI mostrar.
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";
const ASAAS_WALLET_ID = Deno.env.get("ASAAS_WALLET_ID") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ── Multa e juros (máximo permitido por lei no Brasil) ──
const FINE_PERCENT = 2;      // multa única 2%
const INTEREST_PERCENT = 1;  // 1% ao mês (0,033%/dia)

type AsaasResponse = { ok: boolean; status: number; data: any };

async function asaasFetch(path: string, init: RequestInit = {}): Promise<AsaasResponse> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "access_token": ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "trevo-legaliza-erp/1.0",
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function ensureCustomer(clienteRow: any): Promise<string> {
  if (clienteRow.asaas_customer_id) return clienteRow.asaas_customer_id;

  const cpfCnpj = onlyDigits(clienteRow.cnpj);
  if (!cpfCnpj || cpfCnpj.length < 11) {
    throw new Error("Cliente sem CNPJ válido cadastrado. Cadastre o CNPJ antes de gerar a cobrança.");
  }

  // 1) tenta localizar por CPF/CNPJ antes de criar
  const search = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}&limit=1`);
  if (search.ok && Array.isArray(search.data?.data) && search.data.data.length > 0) {
    const customerId = search.data.data[0].id;
    await admin.from("clientes").update({ asaas_customer_id: customerId }).eq("id", clienteRow.id);
    return customerId;
  }

  // 2) cria
  const payload: Record<string, any> = {
    name: (clienteRow.apelido || clienteRow.nome || "Cliente").substring(0, 100),
    cpfCnpj,
    email: clienteRow.email || undefined,
    mobilePhone: onlyDigits(clienteRow.telefone_financeiro || clienteRow.telefone) || undefined,
    externalReference: clienteRow.id,
  };

  const created = await asaasFetch("/customers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!created.ok) throw new Error(`Asaas customer ${created.status}: ${JSON.stringify(created.data)}`);

  const customerId = created.data.id;
  await admin.from("clientes").update({ asaas_customer_id: customerId }).eq("id", clienteRow.id);
  return customerId;
}

async function createPayment(params: {
  customerId: string;
  value: number;
  dueDate: string;
  description: string;
  externalReference: string;
}) {
  const payload: Record<string, any> = {
    customer: params.customerId,
    billingType: "UNDEFINED", // permite boleto OU pix
    value: Number(params.value.toFixed(2)),
    dueDate: params.dueDate,
    description: params.description.substring(0, 500),
    externalReference: params.externalReference,
    fine: { value: FINE_PERCENT, type: "PERCENTAGE" },
    interest: { value: INTEREST_PERCENT, type: "PERCENTAGE" },
  };
  if (ASAAS_WALLET_ID) {
    payload.split = undefined; // reservado pra futuro
  }

  const r = await asaasFetch("/payments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Asaas payment ${r.status}: ${JSON.stringify(r.data)}`);
  return r.data;
}

async function fetchPixQrCode(paymentId: string) {
  const r = await asaasFetch(`/payments/${paymentId}/pixQrCode`);
  if (!r.ok) return null;
  return r.data; // { encodedImage, payload, expirationDate }
}

async function fetchIdentificationField(paymentId: string) {
  const r = await asaasFetch(`/payments/${paymentId}/identificationField`);
  if (!r.ok) return null;
  return r.data; // { identificationField, nossoNumero, barCode }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Autenticação obrigatória" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // valida usuário + role
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Sessão inválida" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: profile } = await admin
    .from("profiles")
    .select("role, empresa_id, ativo")
    .eq("id", user.id)
    .single();
  if (!profile || !profile.ativo) {
    return new Response(JSON.stringify({ error: "Usuário inativo" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const role = profile.role;
  if (!["master", "gerente", "financeiro"].includes(role)) {
    return new Response(JSON.stringify({ error: "Sem permissão para gerar cobrança" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ASAAS_API_KEY) {
    return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const cobrancaId = body.cobranca_id as string | undefined;
  const customDueDate = body.data_vencimento as string | undefined;

  if (!cobrancaId) {
    return new Response(JSON.stringify({ error: "cobranca_id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { data: cobranca, error: cobErr } = await admin
      .from("cobrancas")
      .select("id, cliente_id, empresa_id, total_geral, data_vencimento, share_token, asaas_payment_id, status")
      .eq("id", cobrancaId)
      .single();
    if (cobErr || !cobranca) throw new Error("Cobrança não encontrada");

    if (cobranca.empresa_id !== profile.empresa_id) {
      return new Response(JSON.stringify({ error: "Cobrança não pertence a esta empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cobranca.status === "paga" || cobranca.status === "cancelada") {
      return new Response(JSON.stringify({ error: `Cobrança ${cobranca.status} não pode ser reenviada` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cobranca.asaas_payment_id) {
      return new Response(JSON.stringify({
        ok: true,
        reused: true,
        asaas_payment_id: cobranca.asaas_payment_id,
        message: "Cobrança Asaas já existe para este registro.",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cliente, error: clErr } = await admin
      .from("clientes")
      .select("id, nome, apelido, cnpj, email, telefone, telefone_financeiro, asaas_customer_id")
      .eq("id", cobranca.cliente_id)
      .single();
    if (clErr || !cliente) throw new Error("Cliente da cobrança não encontrado");

    const customerId = await ensureCustomer(cliente);

    const dueDate = customDueDate
      || cobranca.data_vencimento
      || addDaysISO(3);

    const payment = await createPayment({
      customerId,
      value: Number(cobranca.total_geral),
      dueDate,
      description: `Cobrança ${cliente.apelido || cliente.nome}`,
      externalReference: cobranca.id,
    });

    const [pix, boleto] = await Promise.all([
      fetchPixQrCode(payment.id),
      fetchIdentificationField(payment.id),
    ]);

    const update = {
      asaas_payment_id: payment.id,
      asaas_status: payment.status,
      asaas_invoice_url: payment.invoiceUrl ?? null,
      asaas_boleto_url: payment.bankSlipUrl ?? null,
      asaas_boleto_barcode: boleto?.identificationField ?? null,
      asaas_pix_qrcode: pix?.encodedImage ?? null,
      asaas_pix_payload: pix?.payload ?? null,
      asaas_gerado_em: new Date().toISOString(),
      data_vencimento: dueDate,
    };
    await admin.from("cobrancas").update(update).eq("id", cobranca.id);

    return new Response(JSON.stringify({
      ok: true,
      reused: false,
      asaas_payment_id: payment.id,
      invoice_url: payment.invoiceUrl,
      boleto_url: payment.bankSlipUrl,
      boleto_barcode: boleto?.identificationField ?? null,
      pix_payload: pix?.payload ?? null,
      due_date: dueDate,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("asaas-gerar-cobranca error:", err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
