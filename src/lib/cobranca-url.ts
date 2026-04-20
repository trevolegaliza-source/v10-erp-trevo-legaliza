const PRODUCTION_BASE = 'https://trevolegaliza.lovable.app';

export function getCobrancaPublicUrl(token: string): string {
  return `${PRODUCTION_BASE}/cobranca/${token}`;
}
