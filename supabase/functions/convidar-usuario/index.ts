import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is authenticated
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is master
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, empresa_id")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || callerProfile.role !== "master") {
      return new Response(
        JSON.stringify({ error: "Apenas masters podem convidar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { email, role, convidado_por } = await req.json();

    if (!email || !role) {
      return new Response(
        JSON.stringify({ error: "Email e role são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Don't allow inviting as master
    if (role === "master") {
      return new Response(
        JSON.stringify({ error: "Não é permitido convidar como master" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already exists
    const { data: existingProfiles } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .eq("empresa_id", callerProfile.empresa_id);

    if (existingProfiles && existingProfiles.length > 0) {
      return new Response(
        JSON.stringify({ error: "Este email já possui uma conta no sistema" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invite user via admin API
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          role_inicial: role,
          empresa_id: callerProfile.empresa_id,
          convidado_por: convidado_por || caller.id,
        },
      });

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update the profile with invite metadata (trigger may have already created it)
    if (inviteData?.user) {
      await adminClient
        .from("profiles")
        .update({
          role: role,
          convidado_por: convidado_por || caller.id,
          convidado_em: new Date().toISOString(),
          empresa_id: callerProfile.empresa_id,
          ativo: false,
        })
        .eq("id", inviteData.user.id);
    }

    // Create notification for admins
    await adminClient.from("notificacoes").insert({
      tipo: "convite",
      titulo: "📧 Convite enviado",
      mensagem: `Convite enviado para ${email} com perfil ${role}.`,
      empresa_id: callerProfile.empresa_id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: inviteData?.user?.id, email },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
