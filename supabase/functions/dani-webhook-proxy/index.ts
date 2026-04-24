// ════════════════════════════════════════════════════════════════════════════
// 🤖 DANI — WEBHOOK PROXY (Trello → Apps Script)
// ────────────────────────────────────────────────────────────────────────────
// Por que existe:
//   Apps Script Web App publicado como "Anyone" sempre faz redirect 302 pra
//   googleusercontent.com. Trello rejeita URLs com redirect → cai 403.
//
// Solução:
//   Edge Function que serve como proxy. Trello chama esta URL (sem redirect),
//   ela repassa pro Apps Script com token, segue redirect (Deno fetch faz por
//   padrão), retorna 200 pro Trello.
//
// Env vars (Lovable configura):
//   APPS_SCRIPT_WEBAPP_URL — URL /exec do deploy Apps Script
//   APPS_SCRIPT_TOKEN      — valor do WEBHOOK_TOKEN gerado em setupDaniProperties()
//
// Endpoints:
//   GET/HEAD /  → 200 "Dani webhook proxy online"  (Trello validation)
//   POST /     → repassa body+token pro Apps Script, retorna resposta
//
// Sempre retorna 200 (mesmo em erro interno) pra evitar Trello desabilitar
// o webhook após muitas falhas. Erros são logados.
// ════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Trello faz HEAD (e às vezes GET) pra validar URL ao criar webhook.
  // Apps Script Web App com "Anyone" redireciona — esta function NÃO redireciona.
  if (req.method === "GET" || req.method === "HEAD") {
    return new Response("Dani webhook proxy online", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const APPS_SCRIPT_URL = Deno.env.get("APPS_SCRIPT_WEBAPP_URL");
  const APPS_SCRIPT_TOKEN = Deno.env.get("APPS_SCRIPT_TOKEN");

  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_TOKEN) {
    console.error("Missing env vars: APPS_SCRIPT_WEBAPP_URL or APPS_SCRIPT_TOKEN");
    return new Response(
      JSON.stringify({ ok: false, error: "proxy_misconfigured" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.text();

    // Adiciona token na query string ao chamar Apps Script
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set("token", APPS_SCRIPT_TOKEN);

    // Deno fetch segue redirects por padrão (redirect: "follow"),
    // que é exatamente o que precisamos pro Apps Script Web App.
    const upstream = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      redirect: "follow",
    });

    const text = await upstream.text();
    const upstreamStatus = upstream.status;

    // Loga falhas pra debug (não retorna erro pro Trello)
    if (upstreamStatus < 200 || upstreamStatus >= 300) {
      console.error(
        `Apps Script returned ${upstreamStatus}: ${text.substring(0, 500)}`,
      );
    }

    // Sempre 200 pra Trello — payload contém info do upstream
    return new Response(
      JSON.stringify({ ok: upstreamStatus < 300, upstream_status: upstreamStatus, upstream: text }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("proxy error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
