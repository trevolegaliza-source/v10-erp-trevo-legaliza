export function getCobrancaPublicUrl(token: string): string {
  const base =
    typeof window !== 'undefined' && window.location.hostname.includes('lovable.app')
      ? window.location.origin
      : 'https://trevolegaliza.lovable.app';
  return `${base}/cobranca/${token}`;
}
