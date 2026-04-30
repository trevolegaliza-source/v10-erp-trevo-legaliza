// =============================================
// migrar-storage — copia todos os buckets/objetos deste projeto
// para um projeto Supabase de destino.
//
// Acionamento: POST autenticado (verify_jwt padrão = false neste projeto;
// a função exige headers x-target-supabase-url e x-target-service-role
// pra mover qualquer coisa, então sem esses headers nada acontece).
//
// Headers obrigatórios:
//   x-target-supabase-url: https://<ref>.supabase.co
//   x-target-service-role: <service_role do projeto destino>
//
// NUNCA loga, ecoa ou retorna a service_role do destino.
// =============================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-target-supabase-url, x-target-service-role",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SKIP_BUCKETS = new Set<string>(["_migracao_backup_27042026"]);
const PAGE_SIZE = 100;
// Margem de segurança vs limite de 150s da edge function.
// Quando ultrapassar, devolvemos JSON parcial (parcial=true) e o cliente
// re-invoca — idempotente porque todo upload usa x-upsert: true.
const SOFT_DEADLINE_MS = 140_000;

interface Falha {
  bucket: string;
  path: string;
  erro: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Lista recursiva de objetos num bucket (Supabase Storage list é paginado e
// não-recursivo: precisa descer em cada "pasta")
async function listAllObjects(
  client: ReturnType<typeof createClient>,
  bucket: string,
  prefix = "",
): Promise<Array<{ path: string; size: number; contentType: string }>> {
  const results: Array<{ path: string; size: number; contentType: string }> = [];
  let offset = 0;

  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Pasta = id null
      if (item.id === null) {
        const sub = await listAllObjects(client, bucket, fullPath);
        results.push(...sub);
      } else {
        results.push({
          path: fullPath,
          size: Number(item.metadata?.size ?? 0),
          contentType: String(item.metadata?.mimetype ?? "application/octet-stream"),
        });
      }
    }
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return results;
}

async function ensureBucketExists(
  targetUrl: string,
  targetKey: string,
  bucketId: string,
  isPublic: boolean,
): Promise<void> {
  // GET /storage/v1/bucket/{id} → 200 se existe, 404 se não
  const head = await fetch(`${targetUrl}/storage/v1/bucket/${encodeURIComponent(bucketId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${targetKey}`,
      apikey: targetKey,
    },
  });
  if (head.ok) return;
  if (head.status !== 404) {
    const txt = await head.text();
    throw new Error(`bucket check ${bucketId} ${head.status}: ${txt}`);
  }
  const create = await fetch(`${targetUrl}/storage/v1/bucket`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${targetKey}`,
      apikey: targetKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: bucketId, name: bucketId, public: isPublic }),
  });
  if (!create.ok) {
    const txt = await create.text();
    throw new Error(`bucket create ${bucketId} ${create.status}: ${txt}`);
  }
}

// Snapshot do destino: lista todos os objetos via Storage API (supabase-js)
// porque o PostgREST do destino não expõe o schema `storage` (PGRST106).
// Lista recursivamente cada bucket informado e retorna Map "bucket/path" → size.
async function snapshotDestino(
  targetClient: ReturnType<typeof createClient>,
  bucketIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const LIMIT = 1000;

  for (const bucket of bucketIds) {
    const walk = async (prefix = ""): Promise<void> => {
      let offset = 0;
      while (true) {
        const { data, error } = await targetClient.storage.from(bucket).list(prefix, {
          limit: LIMIT,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (error) {
          throw new Error(`snapshot list ${bucket}/${prefix} falhou: ${error.message}`);
        }
        if (!data || data.length === 0) break;

        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id === null) {
            // Pasta — recursão
            await walk(fullPath);
          } else {
            const size = Number(item.metadata?.size ?? 0);
            map.set(`${bucket}/${fullPath}`, size);
          }
        }
        if (data.length < LIMIT) break;
        offset += LIMIT;
      }
    };

    try {
      await walk("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Bucket pode não existir no destino ainda — seguimos sem snapshot dele.
      console.warn(`[snapshot-destino] pulando bucket ${bucket}: ${msg}`);
    }
  }

  console.log(`[snapshot-destino] ${map.size} objetos indexados`);
  return map;
}

async function uploadStreaming(
  targetUrl: string,
  targetKey: string,
  bucket: string,
  path: string,
  body: ReadableStream<Uint8Array> | Blob,
  contentType: string,
): Promise<void> {
  const url =
    `${targetUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${targetKey}`,
      apikey: targetKey,
      "Content-Type": contentType,
      "x-upsert": "true",
      "Cache-Control": "3600",
    },
    body,
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`upload ${r.status}: ${txt.slice(0, 300)}`);
  }
}

async function migrar(
  targetUrl: string,
  targetKey: string,
  startedAt: number,
): Promise<{
  totalArquivos: number;
  migrados: number;
  pulados: number;
  falhas: Falha[];
  parcial: boolean;
}> {
  const local = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: buckets, error: bErr } = await local.storage.listBuckets();
  if (bErr) throw new Error(`listBuckets: ${bErr.message}`);

  const falhas: Falha[] = [];
  let total = 0;
  let migrados = 0;
  let pulados = 0;
  let parcial = false;

  // Snapshot do destino — chave "bucket/path" → size em bytes.
  // Usado pra pular arquivos cujo tamanho já bate com o source.
  const destinoMap = await snapshotDestino(targetUrl, targetKey);

  outer: for (const b of buckets ?? []) {
    if (SKIP_BUCKETS.has(b.id)) {
      console.log(`[skip-bucket] ${b.id}`);
      continue;
    }
    console.log(`[bucket] ${b.id} (public=${b.public})`);

    try {
      await ensureBucketExists(targetUrl, targetKey, b.id, !!b.public);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[bucket-create-fail] ${b.id}: ${msg}`);
      falhas.push({ bucket: b.id, path: "<bucket>", erro: msg });
      continue;
    }

    let objetos: Array<{ path: string; size: number; contentType: string }>;
    try {
      objetos = await listAllObjects(local, b.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[list-fail] ${b.id}: ${msg}`);
      falhas.push({ bucket: b.id, path: "<list>", erro: msg });
      continue;
    }

    console.log(`[bucket] ${b.id} → ${objetos.length} objetos`);
    total += objetos.length;

    for (const obj of objetos) {
      // Deadline soft pra evitar o limite duro de 150s. Próxima invocação
      // retoma de onde parou — upload com x-upsert é idempotente.
      if (Date.now() - startedAt > SOFT_DEADLINE_MS) {
        console.log(`[deadline] tempo esgotado, retornando parcial`);
        parcial = true;
        break outer;
      }

      // Skip por size: se já existe no destino com o mesmo tamanho, pula.
      // Tamanho diferente (ou ausente) → re-upload via upsert.
      const destSize = destinoMap.get(`${b.id}/${obj.path}`);
      if (destSize !== undefined && destSize === obj.size && obj.size > 0) {
        pulados++;
        continue;
      }

      try {
        const { data: blob, error: dErr } = await local.storage.from(b.id).download(obj.path);
        if (dErr || !blob) {
          throw new Error(`download: ${dErr?.message ?? "blob vazio"}`);
        }

        const ct = obj.contentType || blob.type || "application/octet-stream";
        await uploadStreaming(targetUrl, targetKey, b.id, obj.path, blob.stream(), ct);
        migrados++;
        if (migrados % 25 === 0) {
          console.log(`[progress] ${migrados}/${total} migrados`);
        }
      } catch (e) {
        // Inclui erros "Duplicate"/"already exists" — raros com upsert,
        // mas registramos e seguimos sem abortar o loop.
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[fail] ${b.id}/${obj.path}: ${msg}`);
        falhas.push({ bucket: b.id, path: obj.path, erro: msg });
      }
    }
  }

  return { totalArquivos: total, migrados, pulados, falhas, parcial };
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

  console.log(`[migrar-storage] início → destino ${targetUrl}`);

  const startedAt = Date.now();
  try {
    const r = await migrar(targetUrl, targetKey, startedAt);
    const ok = r.falhas.length === 0 && !r.parcial;
    console.log(`[migrar-storage] fim ok=${ok} parcial=${r.parcial} total=${r.totalArquivos} migrados=${r.migrados} pulados=${r.pulados} falhas=${r.falhas.length}`);
    return jsonResponse({
      ok,
      parcial: r.parcial,
      totalArquivos: r.totalArquivos,
      migrados: r.migrados,
      pulados: r.pulados,
      falhas: r.falhas,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[migrar-storage] erro fatal: ${msg}`);
    return jsonResponse({ ok: false, erro: msg }, 500);
  }
});
