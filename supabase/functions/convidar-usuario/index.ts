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

    // Check if user already exists in auth.users
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingAuthUser = existingUsers?.users?.find(
      (u: any) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (existingAuthUser) {
      // User exists in auth — check profile
      const { data: existingProfile } = await adminClient
        .from("profiles")
        .select("id, ativo, motivo_inativacao, empresa_id")
        .eq("id", existingAuthUser.id)
        .single();

      if (existingProfile) {
        if (existingProfile.ativo === true) {
          return new Response(
            JSON.stringify({ error: "Este usuário já está ativo no sistema." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // User exists with ativo=false — inform admin
        return new Response(
          JSON.stringify({
            error: "Usuário já cadastrado e aguardando aprovação. Vá em Gestão de Usuários para ativar.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Auth user exists but no profile — create profile
        await adminClient.from("profiles").insert({
          id: existingAuthUser.id,
          email: email,
          nome: existingAuthUser.user_metadata?.full_name || email.split("@")[0],
          role: role,
          ativo: false,
          empresa_id: callerProfile.empresa_id,
          convidado_por: convidado_por || caller.id,
          convidado_em: new Date().toISOString(),
        });

        // Create notification
        await adminClient.from("notificacoes").insert({
          tipo: "convite",
          titulo: "📧 Convite enviado",
          mensagem: `Perfil criado para ${email} com role ${role}. Aguardando aprovação.`,
          empresa_id: callerProfile.empresa_id,
        });

        return new Response(
          JSON.stringify({
            success: true,
            user: { id: existingAuthUser.id, email },
            message: "Perfil criado. O usuário já possui conta e aguarda aprovação.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // User does NOT exist — invite normally
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
        JSON.stringify({ error: "Não foi possível enviar o convite. Tente novamente." }),
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
      JSON.stringify({ error: "Erro interno. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
