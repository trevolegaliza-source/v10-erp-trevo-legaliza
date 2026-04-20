import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trello-webhook",
  "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
};

const ADMINS = new Set([
  "trevolegaliza",
  "abnermaliqdossantosjimoh",
  "amandacristovao1",
  "arthurlegalizacao",
  "carolinaguirado7",
  "leticiatonelli3",
]);
const LABEL_CREATOR = "trevolegaliza";

const TRELLO_KEY = Deno.env.get("TRELLO_API_KEY") ?? Deno.env.get("TRELLO_KEY") ?? "";
const TRELLO_TOKEN = Deno.env.get("TRELLO_TOKEN") ?? "";
const TRELLO_SECRET = Deno.env.get("TRELLO_SECRET") ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function trelloCall(method: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.trello.com${path}`);
  url.searchParams.set("key", TRELLO_KEY);
  url.searchParams.set("token", TRELLO_TOKEN);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return fetch(url.toString(), { method });
}

async function commentCard(cardId: string, text: string) {
  return trelloCall("POST", `/1/cards/${cardId}/actions/comments`, { text });
}

async function logAction(entry: {
  action_type: string;
  board_id?: string;
  board_name?: string;
  card_id?: string;
  card_name?: string;
  member_username?: string;
  was_reverted: boolean;
  revert_detail?: string;
  raw_action: unknown;
}) {
  try {
    await supabase.from("trello_guard_logs").insert(entry);
  } catch (e) {
    console.error("Failed to log:", e);
  }
}

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!TRELLO_SECRET) return true; // skip if no secret configured
  const signature = req.headers.get("x-trello-webhook");
  if (!signature) return false;
  const callbackUrl = `${SUPABASE_URL}/functions/v1/trello-guard`;
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

async function processAction(payload: any) {
  const action = payload?.action;
  if (!action) return;

  const type: string = action.type;
  const username: string = action.memberCreator?.username ?? "";
  const board = action.data?.board ?? {};
  const card = action.data?.card ?? {};

  const baseLog = {
    action_type: type,
    board_id: board.id,
    board_name: board.name,
    card_id: card.id,
    card_name: card.name,
    member_username: username,
    raw_action: action,
  };

  try {
    // 1. createCard — somente admins
    if (type === "createCard" && !ADMINS.has(username)) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/closed`, { value: "true" });
      await commentCard(
        card.id,
        `⚠️ Cartão arquivado — Somente o admin pode criar cartões (@${username})`,
      );
      await logAction({ ...baseLog, was_reverted: r.ok, revert_detail: `archived (status ${r.status})` });
      return;
    }

    // 2. updateCard — movimento entre listas
    if (type === "updateCard" && action.data?.listBefore && action.data?.listAfter && !ADMINS.has(username)) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/idList`, {
        value: action.data.listBefore.id,
      });
      await commentCard(
        card.id,
        `⚠️ Movimento revertido — Somente o admin pode mover cartões (@${username})`,
      );
      await logAction({
        ...baseLog,
        was_reverted: r.ok,
        revert_detail: `moved back to ${action.data.listBefore.name} (status ${r.status})`,
      });
      return;
    }

    // 3. updateCard — arquivamento (closed: false → true)
    if (
      type === "updateCard" &&
      action.data?.old?.closed === false &&
      action.data?.card?.closed === true &&
      !ADMINS.has(username)
    ) {
      const r = await trelloCall("PUT", `/1/cards/${card.id}/closed`, { value: "false" });
      await commentCard(card.id, `Somente o admim pode arquivar cartões (@${username})`);
      await logAction({ ...baseLog, was_reverted: r.ok, revert_detail: `unarchived (status ${r.status})` });
      return;
    }

    // 4. createLabel — somente LABEL_CREATOR
    if (type === "createLabel" && username !== LABEL_CREATOR) {
      const labelId = action.data?.label?.id;
      if (labelId) {
        const r = await trelloCall("DELETE", `/1/labels/${labelId}`);
        await logAction({
          ...baseLog,
          was_reverted: r.ok,
          revert_detail: `label deleted ${labelId} (status ${r.status})`,
        });
      }
      return;
    }

    // 5. deleteAttachmentFromCard — não-admin
    if (type === "deleteAttachmentFromCard" && !ADMINS.has(username)) {
      await commentCard(
        card.id,
        `⚠️ @${username} deletou um anexo sem permissão.`,
      );
      await logAction({
        ...baseLog,
        was_reverted: false,
        revert_detail: "attachment cannot be recovered, only commented",
      });
      return;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("processAction error:", msg);
    await logAction({ ...baseLog, was_reverted: false, revert_detail: `ERROR: ${msg}` });
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Trello validates URL via HEAD before registering webhook
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

  // Validate HMAC signature (skipped if TRELLO_SECRET not set)
  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    console.warn("Invalid Trello webhook signature");
    // Still return 200 to avoid Trello disabling the webhook
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Process async — return 200 immediately
  processAction(payload).catch((e) => console.error("async processAction:", e));

  return new Response("ok", { status: 200, headers: corsHeaders });
});
