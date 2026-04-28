// =============================================
// Edge Function TEMPORÁRIA: exportar-secrets-temp
// =============================================
// USO ÚNICO — migração de secrets pro projeto novo.
// DELETAR imediatamente após uso.
//
// Protegida por:
// 1. JWT do usuário autenticado
// 2. Verificação de role = master
// 3. Senha master (mesma do verify-master-password)
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRETS_TO_EXPORT = [
  "APPS_SCRIPT_WEBAPP_URL",
  "APPS_SCRIPT_TOKEN",
  "ASAAS_WEBHOOK_TOKEN",
  "ASAAS_BASE_URL",
  "ASAAS_WALLET_ID",
  "ASAAS_API_KEY",
  "TRELLO_SECRET",
  "TRELLO_API_KEY",
  "TRELLO_TOKEN",
  "MASTER_PASSWORD",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supaUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authErr } = await supaUser.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supaAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await supaAdmin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    if (!profile || profile.role !== "master") {
      return new Response(JSON.stringify({ error: "Apenas master pode exportar secrets" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const password: string = body?.password ?? "";
    if (!password) {
      return new Response(JSON.stringify({ error: "Senha master obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Valida senha master via RPC (com fallback pro env var)
    let valid = false;
    const { data: hashResult } = await supaAdmin.rpc("verify_master_password_hash", {
      p_password: password,
    });
    if (hashResult === true) {
      valid = true;
    } else if (hashResult === null || hashResult === undefined) {
      const masterEnv = Deno.env.get("MASTER_PASSWORD") ?? "";
      valid = masterEnv !== "" && password === masterEnv;
    }

    if (!valid) {
      return new Response(JSON.stringify({ error: "Senha master incorreta" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lê todas as secrets
    const result: Record<string, string | null> = {};
    for (const name of SECRETS_TO_EXPORT) {
      const v = Deno.env.get(name);
      result[name] = v ?? null;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        secrets: result,
        warning: "DELETAR ESTA FUNÇÃO IMEDIATAMENTE APÓS COPIAR OS VALORES.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
