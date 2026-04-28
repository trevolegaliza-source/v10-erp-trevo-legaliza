// =============================================
// CORS helper compartilhado — audit fix #21
// =============================================
// Antes: TODAS edge functions tinham `Access-Control-Allow-Origin: *`
// fixo. Qualquer site malicioso podia chamar nossas edges com cookies
// de sessão do usuário (CSRF facilitada via fetch credentials:include).
//
// Agora: allowlist de domínios. Origin desconhecido NÃO recebe header
// Allow-Origin → browser bloqueia. Defesa em profundidade junto com
// auth tokens.
//
// IMPORTANTE: Este helper é só pra edges chamadas por BROWSER. Webhooks
// servidor-pra-servidor (asaas-webhook, trello-guard, trello-provisioner,
// trello-label-lembrete, trello-reconciliacao, dani-webhook-proxy) NÃO
// usam CORS — Origin nem é enviado. Não precisam deste helper.
//
// Domínios permitidos (configuráveis via env ALLOWED_ORIGINS_EXTRA):
//   - *.lovableproject.com (preview Lovable)
//   - *.lovable.dev / *.lovable.app (publishing Lovable)
//   - localhost (dev local)
//   - + lista extra via env var (ex.: domínio custom Trevo)
// =============================================

const STATIC_ALLOWED_PATTERNS: Array<RegExp> = [
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/[a-z0-9-]+\.lovable\.dev$/i,
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https?:\/\/localhost(:\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/i,
];

function loadExtraAllowedOrigins(): Array<string> {
  const raw = Deno.env.get("ALLOWED_ORIGINS_EXTRA") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const EXTRA_ALLOWED = loadExtraAllowedOrigins();

// Modo emergência: se Thales descobrir que o domínio dele tá bloqueado
// e precisar liberar TUDO temporariamente, basta setar env
// CORS_FALLBACK_OPEN=true no Supabase. Default OFF (seguro).
// USAR APENAS pra debug/migração — depois adicionar domínio em
// ALLOWED_ORIGINS_EXTRA e desligar o fallback.
const FALLBACK_OPEN =
  (Deno.env.get("CORS_FALLBACK_OPEN") ?? "").toLowerCase() === "true";

export function isAllowedOrigin(origin: string | null): boolean {
  if (FALLBACK_OPEN) return true;
  if (!origin) return false;
  if (EXTRA_ALLOWED.includes(origin)) return true;
  return STATIC_ALLOWED_PATTERNS.some((re) => re.test(origin));
}

/**
 * Devolve headers CORS pra esta requisição.
 * Se Origin não está na allowlist, NÃO inclui Allow-Origin (browser bloqueia
 * fetch com credentials). Headers de método/header continuam pra preflight
 * legítimo de origem permitida funcionar.
 *
 * @param origin Header `Origin` da request (pode ser null se chamada não-browser)
 * @param allowedHeaders Headers permitidos no request (default: comum)
 */
export function buildCorsHeaders(
  origin: string | null,
  allowedHeaders =
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": allowedHeaders,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
  if (isAllowedOrigin(origin)) {
    // FALLBACK_OPEN sem Origin (ex.: chamada via curl) → devolve "*"
    // Allowlist normal → ecoa o Origin específico (mais seguro)
    headers["Access-Control-Allow-Origin"] = origin ?? "*";
  }
  return headers;
}

/**
 * Resposta padrão pra OPTIONS preflight.
 * Devolve 204 sem body se origem permitida; 403 sem CORS se bloqueada
 * (browser não vai prosseguir com a request real).
 */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const origin = req.headers.get("Origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}
