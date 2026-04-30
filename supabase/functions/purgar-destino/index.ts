// =============================================
// purgar-destino — apaga TODOS os objetos dos buckets
// ['contratos', 'documentos', 'contestacoes'] no projeto Supabase
// de destino informado por header.
//
// Headers obrigatórios:
//   x-target-supabase-url: https://<ref>.supabase.co
//   x-target-service-role: <service_role do projeto destino>
//
// NUNCA loga, ecoa ou retorna a service_role do destino.
// Idempotente: rodar 2x → segunda vez retorna totalApagados: 0.
// =============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-target-supabase-url, x-target-service-role",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKETS = ["contratos", "documentos", "contestacoes"];
const LIST_LIMIT = 1000;
const DELETE_BATCH = 1000;
const SOFT_DEADLINE_MS = 140_000;

interface Falha {
  bucket: string;
  paths?: string[];
  erro: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function purgarBucket(
  client: ReturnType<typeof createClient>,
  bucket: string,
  startedAt: number,
  falhas: Falha[],
): Promise<{ apagados: number; parcial: boolean }> {
  let apagados = 0;
  let buffer: string[] = [];
  let parcial = false;

  const flush = async (): Promise<boolean> => {
    if (buffer.length === 0) return true;
    const lote = buffer;
    buffer = [];
    const { error } = await client.storage.from(bucket).remove(lote);
    if (error) {
      falhas.push({ bucket, paths: lote.slice(0, 5), erro: `remove: ${error.message}` });
      return false;
    }
    apagados += lote.length;
    console.log(`[purga] ${bucket}: ${apagados} apagados`);
    return true;
  };

  const walk = async (prefix = ""): Promise<void> => {
    if (parcial) return;
    let offset = 0;
    while (true) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        parcial = true;
        return;
      }
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: LIST_LIMIT,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        falhas.push({ bucket, erro: `list ${prefix}: ${error.message}` });
        return;
      }
      if (!data || data.length === 0) break;

      const subdirs: string[] = [];
      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id === null) {
          subdirs.push(fullPath);
        } else {
          buffer.push(fullPath);
          if (buffer.length >= DELETE_BATCH) {
            await flush();
          }
        }
      }

      // Recursão nos subdiretórios depois de processar a página atual
      for (const sub of subdirs) {
        await walk(sub);
        if (parcial) return;
      }

      if (data.length < LIST_LIMIT) break;
      offset += LIST_LIMIT;
    }
  };

  try {
    await walk("");
    await flush();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    falhas.push({ bucket, erro: msg });
  }

  return { apagados, parcial };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, erro: "method not allowed" }, 405);
  }

  const targetUrl = (req.headers.get("x-target-supabase-url") ?? "").trim().replace(/\/+$/, "");
  const targetKey = (req.headers.get("x-target-service-role") ?? "").trim();

  if (!targetUrl || !targetKey) {
    return jsonResponse(
      { ok: false, erro: "headers x-target-supabase-url e x-target-service-role são obrigatórios" },
      400,
    );
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(targetUrl)) {
    return jsonResponse({ ok: false, erro: "x-target-supabase-url inválida" }, 400);
  }

  console.log(`[purgar-destino] início → destino ${targetUrl}`);
  const startedAt = Date.now();
  const target = createClient(targetUrl, targetKey);

  let totalApagados = 0;
  const falhas: Falha[] = [];
  let parcial = false;

  try {
    for (const bucket of BUCKETS) {
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        parcial = true;
        break;
      }
      const r = await purgarBucket(target, bucket, startedAt, falhas);
      totalApagados += r.apagados;
      if (r.parcial) {
        parcial = true;
        break;
      }
    }

    const ok = falhas.length === 0 && !parcial;
    console.log(
      `[purgar-destino] fim ok=${ok} parcial=${parcial} totalApagados=${totalApagados} falhas=${falhas.length}`,
    );
    return jsonResponse({ ok, parcial, totalApagados, falhas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[purgar-destino] erro fatal: ${msg}`);
    return jsonResponse({ ok: false, erro: msg, totalApagados, falhas }, 500);
  }
});
