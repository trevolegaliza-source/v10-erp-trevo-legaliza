import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const TRELLO_SECRET = Deno.env.get("TRELLO_SECRET") ?? "";
const TRELLO_GUARD_URL =
  Deno.env.get("TRELLO_GUARD_URL") ??
  "https://gwyinucaeaayuckvevma.supabase.co/functions/v1/trello-guard";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const TARGET_LABELS: { name: string; color: string }[] = [
  { name: "DOCUMENTO PENDENTE", color: "black" },
  { name: "RESPOSTA DE COMENTÁRIO PENDENTE", color: "black" },
  { name: "ASSINAR MAT", color: "blue_dark" },
  { name: "MÉTODO TREVO 🍀", color: "lime" },
  { name: "REGISTRADO PELO ORGÃO", color: "lime_dark" },
  { name: "AGUARDANDO ASSINATURAS", color: "orange" },
  { name: "ORÇAMENTO EM ANDAMENTO", color: "purple_dark" },
  { name: "EXIGÊNCIA", color: "red" },
  { name: "PRIORIDADE", color: "red" },
  { name: "EM ANDAMENTO", color: "sky" },
  { name: "PRONTO PARA SER FEITO", color: "sky" },
  { name: "EM ANÁLISE NO ORGÃO", color: "yellow" },
  { name: "CHAMADO ABERTO", color: "yellow_dark" },
];

const GREEN_LIST_NAMES = new Set([
  "SOLICITAR PROCESSO",
  "INFORMAÇÕES CONTABILIDADE 🫱🏻‍🫲🏽🍀",
]);
const ARCHIVE_IF_EMPTY_LIST_NAME = "🍀 PROCESSOS AVULSOS";

async function trelloCall(
  method: string,
  path: string,
  params: Record<string, string> = {},
): Promise<Response> {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), { method });
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TRELLO_SECRET) return true;
  const signature = req.headers.get("x-trello-webhook");
  if (!signature) return false;
  const callbackUrl = `${SUPABASE_URL}/functions/v1/trello-provisioner`;
  const content = rawBody + callbackUrl;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(TRELLO_SECRET),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return expected === signature;
}

async function logProvision(entry: {
  board_id?: string;
  board_name?: string;
  trigger_type: string;
  actions_applied: unknown;
  errors: unknown;
  success: boolean;
}) {
  try {
    await supabase.from("trello_provisioner_logs").insert(entry);
  } catch (e) {
    console.error("Failed to log provisioner:", e);
  }
}

async function registerGuardWebhook(
  boardId: string,
  boardName: string,
  applied: string[],
  errors: string[],
) {
  try {
    const r = await trelloCall("POST", "/1/webhooks", {
      callbackURL: TRELLO_GUARD_URL,
      idModel: boardId,
      description: `trello-guard for ${boardName}`,
    });
    if (r.ok) {
      applied.push(`webhook registered (${r.status})`);
    } else {
      const txt = await r.text();
      if (txt.includes("already exists")) {
        applied.push("webhook already exists");
      } else {
        errors.push(`webhook ${r.status}: ${txt}`);
      }
    }
  } catch (e) {
    errors.push(`webhook error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function syncLabels(boardId: string, applied: string[], errors: string[]) {
  try {
    const r = await trelloCall("GET", `/1/boards/${boardId}/labels`, { limit: "1000" });
    if (!r.ok) {
      errors.push(`labels GET ${r.status}: ${await r.text()}`);
      return;
    }
    const current: { id: string; name: string; color: string }[] = await r.json();
    const targetKey = (n: string, c: string) => `${n}|${c}`;
    const targetSet = new Set(TARGET_LABELS.map((l) => targetKey(l.name, l.color)));
    const currentSet = new Set(current.map((l) => targetKey(l.name ?? "", l.color ?? "")));

    let deleted = 0;
    let created = 0;
    for (const l of current) {
      if (!targetSet.has(targetKey(l.name ?? "", l.color ?? ""))) {
        const dr = await trelloCall("DELETE", `/1/labels/${l.id}`);
        if (dr.ok) deleted++;
        else errors.push(`label DELETE ${l.id} ${dr.status}`);
      }
    }
    for (const t of TARGET_LABELS) {
      if (!currentSet.has(targetKey(t.name, t.color))) {
        const cr = await trelloCall("POST", "/1/labels", {
          idBoard: boardId,
          name: t.name,
          color: t.color,
        });
        if (cr.ok) created++;
        else errors.push(`label POST ${t.name} ${cr.status}`);
      }
    }
    applied.push(`labels synced: +${created} / -${deleted}`);
  } catch (e) {
    errors.push(`labels error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function processLists(boardId: string, applied: string[], errors: string[]) {
  try {
    const r = await trelloCall("GET", `/1/boards/${boardId}/lists`, { filter: "all" });
    if (!r.ok) {
      errors.push(`lists GET ${r.status}: ${await r.text()}`);
      return;
    }
    const lists: { id: string; name: string; closed: boolean }[] = await r.json();
    let painted = 0;
    let archived = 0;

    for (const l of lists) {
      const name = (l.name ?? "").trim();
      if (GREEN_LIST_NAMES.has(name) && !l.closed) {
        const pr = await trelloCall("PUT", `/1/lists/${l.id}`, { color: "green" });
        if (pr.ok) painted++;
        else errors.push(`list color ${l.id} ${pr.status}`);
      }
      if (name === ARCHIVE_IF_EMPTY_LIST_NAME && !l.closed) {
        const cr = await trelloCall("GET", `/1/lists/${l.id}/cards`, { limit: "1" });
        if (cr.ok) {
          const cards = await cr.json();
          if (Array.isArray(cards) && cards.length === 0) {
            const ar = await trelloCall("PUT", `/1/lists/${l.id}/closed`, { value: "true" });
            if (ar.ok) archived++;
            else errors.push(`list archive ${l.id} ${ar.status}`);
          } else {
            applied.push(`avulsos list kept (has cards)`);
          }
        } else {
          errors.push(`list cards ${l.id} ${cr.status}`);
        }
      }
    }
    applied.push(`lists painted: ${painted}, archived: ${archived}`);
  } catch (e) {
    errors.push(`lists error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function provisionBoard(boardId: string, boardName: string, triggerType: string) {
  const applied: string[] = [];
  const errors: string[] = [];

  await registerGuardWebhook(boardId, boardName, applied, errors);
  await syncLabels(boardId, applied, errors);
  await processLists(boardId, applied, errors);

  await logProvision({
    board_id: boardId,
    board_name: boardName,
    trigger_type: triggerType,
    actions_applied: applied,
    errors,
    success: errors.length === 0,
  });
}

async function processAction(payload: any) {
  const action = payload?.action;
  if (!action) return;
  const type: string = action.type;
  const board = action.data?.board ?? {};

  let trigger: string | null = null;
  if (type === "createBoard") trigger = "createBoard";
  else if (
    type === "updateBoard" &&
    action.data?.old?.closed === true &&
    action.data?.board?.closed === false
  ) {
    trigger = "unarchiveBoard";
  }

  if (!trigger) return;
  if (!board.id) return;

  await provisionBoard(board.id, board.name ?? "(sem nome)", trigger);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method === "HEAD" || req.method === "GET") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  let rawBody = "";
  let payload: any = null;
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("Invalid Trello webhook signature (provisioner)");
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Process async — return 200 immediately
  // @ts-ignore EdgeRuntime is available in Supabase Edge Functions
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(processAction(payload));
  } else {
    processAction(payload).catch((e) => console.error("async provisioner:", e));
  }

  return new Response("ok", { status: 200, headers: corsHeaders });
});
