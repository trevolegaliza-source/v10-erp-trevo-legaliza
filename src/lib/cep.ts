export function formatCEP(value: string): string {
  const nums = value.replace(/\D/g, '').slice(0, 8);
  if (nums.length > 5) return `${nums.slice(0, 5)}-${nums.slice(5)}`;
  return nums;
}

export interface CepResult {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export async function buscarCEP(cep: string): Promise<CepResult | null> {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    const data = await response.json();
    if (data.erro) return null;

    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      estado: data.uf || '',
      cep: cepLimpo,
    };
  } catch {
    return null;
  }
}

export async function buscarCoordenadas(
  logradouro: string,
  cidade: string,
  estado: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const query = encodeURIComponent(`${logradouro}, ${cidade}, ${estado}, Brasil`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`,
      { headers: { 'User-Agent': 'TrevoEngine/1.0' } }
    );
    const data = await response.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch {
    return null;
  }
}
