/**
 * Motor Financeiro — Client-side calculation engine
 * Formula: (Base − Desconto Progressivo) × (1 + 50% se urgente) + Σ Valores Adicionais
 */

export interface ClienteFinanceiro {
  tipo: string;
  valor_base: number | null;
  desconto_progressivo: number | null;
  valor_limite_desconto: number | null;
  mensalidade: number | null;
  qtd_processos: number | null;
}

export interface CalculoPrecificacao {
  valorBase: number;
  descontoPercent: number;
  descontoValor: number;
  valorComDesconto: number;
  urgencia: number;
  valorServico: number;
  somaAdicionais: number;
  totalFinal: number;
  isMensalista: boolean;
  franquiaIncluida: boolean;
}

/**
 * Calcula preço final com desconto progressivo, urgência e adicionais
 */
export function calcularPrecoProcesso(params: {
  cliente: ClienteFinanceiro | null;
  baseOverride?: number;
  processosNoMes: number;
  isUrgente: boolean;
  somaAdicionais: number;
  isRetrabalho?: boolean;
  isTransferenciaUF?: boolean;
}): CalculoPrecificacao {
  const { cliente, baseOverride, processosNoMes, isUrgente, somaAdicionais, isRetrabalho, isTransferenciaUF } = params;

  const isMensalista = cliente?.tipo === 'MENSALISTA' && (cliente.mensalidade ?? 0) > 0;
  const franquia = cliente?.qtd_processos ?? 0;

  // Mensalista with franchise
  if (isMensalista) {
    // Retrabalho = 1 extra process from franchise
    // Transferência UF = 2 processes from franchise
    const extraProcessos = (isRetrabalho ? 1 : 0) + (isTransferenciaUF ? 2 : 0);

    return {
      valorBase: cliente?.mensalidade ?? 0,
      descontoPercent: 0,
      descontoValor: 0,
      valorComDesconto: 0,
      urgencia: 0,
      valorServico: 0,
      somaAdicionais,
      totalFinal: somaAdicionais, // Service included, only adicionais charged separately
      isMensalista: true,
      franquiaIncluida: processosNoMes <= franquia,
    };
  }

  // AVULSO: calculate with discounts
  const valorBase = baseOverride ?? (cliente?.valor_base ?? 0);
  const descontoPercent = cliente?.desconto_progressivo ?? 0;
  const limiteDesconto = cliente?.valor_limite_desconto ?? 0;

  // Progressive discount: N% per process already done this month
  let descontoValor = 0;
  if (processosNoMes > 0 && descontoPercent > 0) {
    descontoValor = valorBase * (descontoPercent / 100) * processosNoMes;
    const valorComDesconto = valorBase - descontoValor;
    if (limiteDesconto > 0 && valorComDesconto < limiteDesconto) {
      descontoValor = valorBase - limiteDesconto;
    }
  }

  let valorComDesconto = Math.max(valorBase - descontoValor, 0);

  // Retrabalho: +50% over base
  if (isRetrabalho) {
    valorComDesconto = valorComDesconto * 1.5;
  }

  // Urgência (Fast Track < 24h): +50%
  const urgencia = isUrgente ? valorComDesconto * 0.5 : 0;
  const valorServico = valorComDesconto + urgencia;

  return {
    valorBase,
    descontoPercent,
    descontoValor,
    valorComDesconto,
    urgencia,
    valorServico,
    somaAdicionais,
    totalFinal: valorServico + somaAdicionais,
    isMensalista: false,
    franquiaIncluida: false,
  };
}

export function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
