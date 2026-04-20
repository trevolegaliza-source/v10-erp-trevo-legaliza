// Edge function: serves the extrato PDF for a public cobranca token.
// Bypasses storage RLS via service_role and avoids ad-blockers by streaming
// from our own function URL.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Find cobranca by token
    const { data: cobranca, error: cobErr } = await supabase
      .from('cobrancas')
      .select('id, extrato_id, status')
      .eq('share_token', token)
      .maybeSingle();

    if (cobErr || !cobranca || !['ativa', 'vencida', 'paga'].includes(cobranca.status)) {
      return new Response(JSON.stringify({ error: 'cobranca not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!cobranca.extrato_id) {
      return new Response(JSON.stringify({ error: 'no extrato linked' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Find extrato to get path
    const { data: extrato } = await supabase
      .from('extratos')
      .select('cliente_id, filename, pdf_url, empresa_id')
      .eq('id', cobranca.extrato_id)
      .maybeSingle();

    if (!extrato) {
      return new Response(JSON.stringify({ error: 'extrato not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Build candidate paths
    const candidates: string[] = [];
    if (extrato.pdf_url?.includes('/object/public/documentos/')) {
      candidates.push(decodeURIComponent(extrato.pdf_url.split('/object/public/documentos/')[1]));
    }
    if (extrato.pdf_url?.includes('/object/sign/documentos/')) {
      candidates.push(decodeURIComponent(extrato.pdf_url.split('/object/sign/documentos/')[1].split('?')[0]));
    }
    if (extrato.empresa_id) {
      candidates.push(`${extrato.empresa_id}/extratos/${extrato.cliente_id}/${extrato.filename}`);
    }
    candidates.push(`extratos/${extrato.cliente_id}/${extrato.filename}`);

    // 4. Try downloading
    for (const path of [...new Set(candidates)]) {
      const { data, error } = await supabase.storage.from('documentos').download(path);
      if (!error && data) {
        return new Response(data, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${extrato.filename}"`,
            'Cache-Control': 'private, max-age=300',
          },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'pdf not found in storage' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
