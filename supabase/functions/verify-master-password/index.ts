// =============================================
// Edge Function: verify-master-password
// =============================================
// Valida senha master de operação sensível.
//
// Estratégia (audit fix #2 27/04/2026):
//  1. Tenta RPC verify_master_password_hash (bcrypt em pg via pgcrypto)
//  2. Se RPC retorna NULL (= hash não setado ainda no banco),
//     fallback pra MASTER_PASSWORD env var (modo legado/migração)
//  3. Comparação timing-safe em ambos os caminhos
//
// Rate limit: 5 tentativas/hora por user_id (mantido).
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Comparação resistente a timing attacks (mesma forma que asaas-webhook)
function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ valid: false, error: "Not authenticated" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ valid: false, error: "Invalid session" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Rate limiting: count attempts in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("master_password_attempts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("attempted_at", oneHourAgo);

    if ((count ?? 0) > 5) {
      return new Response(
        JSON.stringify({ valid: false, error: "Muitas tentativas. Aguarde 1 hora." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { password } = await req.json();
    if (typeof password !== "string" || password.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: "Senha ausente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Record attempt antes de validar (oráculo de rate limit não vaza success)
    await supabaseAdmin
      .from("master_password_attempts")
      .insert({ user_id: user.id });

    // === Validação ===
    // 1) Tenta RPC com hash bcrypt (audit fix #2)
    let valid = false;
    let usedFallback = false;

    try {
      const { data: hashResult, error: rpcErr } = await supabaseAdmin.rpc(
        "verify_master_password_hash",
        { p_password: password },
      );

      if (rpcErr) {
        // RPC não existe ainda? Migration não rodou? Loga e cai pra fallback.
        console.warn(
          "[verify-master-password] RPC verify_master_password_hash falhou:",
          rpcErr.message,
        );
        usedFallback = true;
      } else if (hashResult === null || hashResult === undefined) {
        // Hash não configurado ainda no banco — fallback pro env var
        usedFallback = true;
      } else {
        valid = hashResult === true;
      }
    } catch (e) {
      console.warn(
        "[verify-master-password] erro chamando RPC:",
        e instanceof Error ? e.message : String(e),
      );
      usedFallback = true;
    }

    // 2) Fallback pra MASTER_PASSWORD env (modo legado/migração)
    if (usedFallback) {
      const masterPassword = Deno.env.get("MASTER_PASSWORD") ?? "";
      if (!masterPassword) {
        // Nem hash no banco nem env — operação impossível
        console.error(
          "[verify-master-password] CRITICAL: nem hash no banco nem MASTER_PASSWORD env",
        );
        return new Response(
          JSON.stringify({
            valid: false,
            error: "Configuração de segurança ausente. Contate o administrador.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      valid = timingSafeEqual(password, masterPassword);
    }

    return new Response(JSON.stringify({ valid }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_error) {
    return new Response(JSON.stringify({ valid: false, error: "Server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
