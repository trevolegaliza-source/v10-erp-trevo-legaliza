import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing environment variables:', { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Validar token — buscar empresa_id associada
    const { data: empresa, error: empError } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('empresa_id', token)
      .limit(1)
      .single();

    if (empError || !empresa) {
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const empresaId = empresa.empresa_id;

    // Buscar serviços ativos
    const { data: servicos } = await supabase
      .from('catalogo_servicos')
      .select('id, nome, categoria, descricao, prazo_estimado')
      .eq('empresa_id', empresaId)
      .eq('ativo', true)
      .order('categoria')
      .order('nome');

    // Buscar preços
    const { data: precos } = await supabase
      .from('catalogo_precos_uf')
      .select('servico_id, uf, honorario_trevo, taxa_orgao, observacoes')
      .eq('empresa_id', empresaId);

    return new Response(
      JSON.stringify({ servicos: servicos || [], precos: precos || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
