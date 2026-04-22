// =============================================
// Edge Function: trello-label-lembrete
// =============================================
// Recebe webhook do Trello. Se o evento for addLabelToCard COM
// etiqueta "DOCUMENTO PENDENTE" ou "RESPOSTA DE COMENTÁRIO PENDENTE",
// chama o Web App do Apps Script pra disparar email IMEDIATO.
// =============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "POST, OPTIONS, HEAD, GET",
};

const APPS_SCRIPT_WEBAPP_URL = Deno.env.get("APPS_SCRIPT_WEBAPP_URL") ?? "";
const APPS_SCRIPT_WEBAPP_TOKEN = Deno.env.get("APPS_SCRIPT_WEBAPP_TOKEN") ?? "";

const ETIQUETAS_LEMBRETE = new Set([
  "DOCUMENTO PENDENTE",
  "RESPOSTA DE COMENTÁRIO PENDENTE",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // HEAD/GET: Trello valida a URL quando registra o webhook
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: true, skipped: "invalid JSON" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const action = payload?.action;
  if (!action) {
    return new Response(JSON.stringify({ ok: true, skipped: "no action" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const actionType = action.type as string;
  if (actionType !== "addLabelToCard") {
    return new Response(JSON.stringify({ ok: true, skipped: "not addLabelToCard" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const labelName = (action.data?.label?.name || "").trim();
  const cardId = action.data?.card?.id;
  if (!labelName || !cardId) {
    return new Response(JSON.stringify({ ok: true, skipped: "missing label/card" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ETIQUETAS_LEMBRETE.has(labelName)) {
    return new Response(JSON.stringify({ ok: true, skipped: "label não dispara lembrete" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!APPS_SCRIPT_WEBAPP_URL) {
    console.error("[trello-label-lembrete] APPS_SCRIPT_WEBAPP_URL não configurado");
    return new Response(JSON.stringify({ ok: false, error: "webhook destination not configured" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Chama o Web App do Apps Script (async — Trello não precisa esperar)
  const body = {
    card_id: cardId,
    label_name: labelName,
    token: APPS_SCRIPT_WEBAPP_TOKEN,
  };

  try {
    const resp = await fetch(APPS_SCRIPT_WEBAPP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await resp.text();
    console.log("[trello-label-lembrete] Apps Script respondeu:", resp.status, text.substring(0, 300));
  } catch (e) {
    console.error("[trello-label-lembrete] erro chamando Apps Script:", e);
  }

  // Sempre 200 pro Trello (evita retries desnecessários)
  return new Response(JSON.stringify({ ok: true, forwarded: true, card_id: cardId, label: labelName }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
