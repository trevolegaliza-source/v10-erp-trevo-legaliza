interface TaxaItem {
  descricao: string;
  valor: number;
}

interface ProcessoCobranca {
  tipo: string;
  razao_social: string;
  valor: number;
  honorarios?: number;
  taxasExtras?: number;
  taxasDetalhadas?: TaxaItem[];
}

function formatarNegrito(text: string) {
  const limpo = text.trim().replace(/^\*+|\*+$/g, '');
  return `*${limpo}*`;
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(dataISO: string) {
  return new Date(dataISO + 'T00:00:00').toLocaleDateString('pt-BR');
}

function tipoUpper(tipo: string) {
  return (tipo || 'PROCESSO').toUpperCase();
}

function renderProcessoBlock(p: ProcessoCobranca): string {
  const linhas: string[] = [];
  linhas.push(`${formatarNegrito(tipoUpper(p.tipo))} — ${formatarNegrito(p.razao_social)}`);
  const honorarios = p.honorarios != null ? p.honorarios : p.valor;
  linhas.push(`Honorários: ${formatarValor(honorarios)}`);
  const taxas = (p.taxasDetalhadas || []).filter(t => t.valor > 0);
  for (const t of taxas) {
    linhas.push(`${t.descricao}: ${formatarValor(t.valor)}`);
  }
  return linhas.join('\n');
}

function temAlgumaTaxa(processos: ProcessoCobranca[]): boolean {
  return processos.some(p =>
    (p.taxasDetalhadas || []).some(t => t.valor > 0) || (p.taxasExtras || 0) > 0,
  );
}

/**
 * Gera mensagem de PRIMEIRO ENVIO — tom amigável, faturamento disponível.
 * Usar quando o extrato acabou de ser gerado (etapa: cobranca_gerada).
 */
export function gerarMensagemCobranca(params: {
  tipo: string;
  razao_social: string;
  valor: number;
  data_vencimento: string;
  diasAtraso: number;
  processosAdicionais?: ProcessoCobranca[];
  /** @deprecated mantido por compatibilidade; não é mais exibido */
  nomeRemetente?: string;
  honorarios?: number;
  taxasExtras?: number;
  taxasDetalhadas?: TaxaItem[];
  observacao?: string;
}) {
  const allProcessos: ProcessoCobranca[] = [
    {
      tipo: params.tipo,
      razao_social: params.razao_social,
      valor: params.valor,
      honorarios: params.honorarios,
      taxasExtras: params.taxasExtras,
      taxasDetalhadas: params.taxasDetalhadas,
    },
    ...(params.processosAdicionais || []),
  ];

  const valorTotal = allProcessos.reduce((sum, p) => sum + p.valor, 0);
  const dataFmt = formatarData(params.data_vencimento);

  if (params.diasAtraso > 0) {
    return gerarMensagemRecobranca(allProcessos, valorTotal, dataFmt, params.diasAtraso);
  }

  const blocos = allProcessos.map(renderProcessoBlock).join('\n\n');
  const obsBlock = params.observacao ? `\n📝 _${params.observacao}_\n` : '';
  const comprovantesBlock = temAlgumaTaxa(allProcessos)
    ? `\nOs comprovantes de pagamento das taxas reembolsáveis estão registrados no processo dentro da nossa plataforma.\n`
    : '';

  return `Olá! Aqui é do departamento financeiro da ${formatarNegrito('Trevo Legaliza')} 🍀

Segue o faturamento referente ao(s) processo(s) do mês:

${blocos}

${formatarNegrito('Total: ' + formatarValor(valorTotal))}
${formatarNegrito('Vencimento: ' + dataFmt)}
${obsBlock}${comprovantesBlock}
${formatarNegrito('Chave PIX (CNPJ):')} 39.969.412/0001-70
${formatarNegrito('Banco:')} C6 Bank

Se preferir pagamento via ${formatarNegrito('boleto bancário')}, é só solicitar por aqui! 📄

Qualquer dúvida, estamos à disposição.

${formatarNegrito('Trevo Legaliza')} 🍀
Assessoria societária · Atuação nacional
(11) 93492-7001 · trevolegaliza.com.br`;
}

/**
 * Mensagem de RECOBRANÇA — tom educado mas direto, para vencidos.
 */
function gerarMensagemRecobranca(
  processos: ProcessoCobranca[],
  valorTotal: number,
  dataVencimento: string,
  _diasAtraso: number,
) {
  const blocos = processos.map(renderProcessoBlock).join('\n\n');
  const comprovantesBlock = temAlgumaTaxa(processos)
    ? `\nOs comprovantes de pagamento das taxas reembolsáveis estão registrados no processo dentro da nossa plataforma.\n`
    : '';

  return `Olá! Aqui é do departamento financeiro da ${formatarNegrito('Trevo Legaliza')} 🍀

Gostaríamos de verificar o pagamento referente ao(s) processo(s) abaixo, com vencimento em ${formatarNegrito(dataVencimento)}:

${blocos}

${formatarNegrito('Total: ' + formatarValor(valorTotal))}
${comprovantesBlock}
${formatarNegrito('Chave PIX (CNPJ):')} 39.969.412/0001-70
${formatarNegrito('Banco:')} C6 Bank

Se preferir ${formatarNegrito('boleto bancário')}, é só solicitar! 📄

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

${formatarNegrito('Trevo Legaliza')} 🍀
Assessoria societária · Atuação nacional
(11) 93492-7001 · trevolegaliza.com.br`;
}
