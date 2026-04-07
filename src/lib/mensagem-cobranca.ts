interface ProcessoCobranca {
  tipo: string;
  razao_social: string;
  valor: number;
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
}) {
  const allProcessos: ProcessoCobranca[] = [
    { tipo: params.tipo, razao_social: params.razao_social, valor: params.valor },
    ...(params.processosAdicionais || []),
  ];

  const valorTotal = allProcessos.reduce((sum, p) => sum + p.valor, 0);
  const dataFmt = formatarData(params.data_vencimento);

  // Se é recobrança (vencido), usar tom de cobrança
  if (params.diasAtraso > 0) {
    return gerarMensagemRecobranca(allProcessos, valorTotal, dataFmt, params.diasAtraso);
  }

  // Primeiro envio — tom amigável
  if (allProcessos.length === 1) {
    const p = allProcessos[0];
    return `Olá! Aqui é da ${formatarNegrito('Trevo Legaliza')} 🍀

Informamos que o faturamento referente ao processo de ${formatarNegrito(p.tipo)} — ${formatarNegrito(p.razao_social)} já está disponível.

${formatarNegrito('Valor:')} ${formatarValor(p.valor)}
${formatarNegrito('Vencimento:')} ${dataFmt}

${formatarNegrito('Chave PIX (CNPJ):')} 39.969.412/0001-70
${formatarNegrito('Banco:')} C6 Bank

Se preferir realizar o pagamento via ${formatarNegrito('boleto bancário')}, é só solicitar por aqui! 📄

Qualquer dúvida, estamos à disposição.

${formatarNegrito('Trevo Legaliza')} 🍀
Assessoria societária · Atuação nacional
(11) 93492-7001 · trevolegaliza.com.br`;
  }

  // Múltiplos processos
  const linhas = allProcessos
    .map(p => `• ${formatarNegrito(p.tipo)} — ${formatarNegrito(p.razao_social)} (${formatarValor(p.valor)})`)
    .join('\n');

  return `Olá! Aqui é da ${formatarNegrito('Trevo Legaliza')} 🍀

Informamos que o faturamento referente aos processos abaixo já está disponível:

${linhas}

${formatarNegrito('Valor Total:')} ${formatarValor(valorTotal)}
${formatarNegrito('Vencimento:')} ${dataFmt}

${formatarNegrito('Chave PIX (CNPJ):')} 39.969.412/0001-70
${formatarNegrito('Banco:')} C6 Bank

Se preferir realizar o pagamento via ${formatarNegrito('boleto bancário')}, é só solicitar por aqui! 📄

Qualquer dúvida, estamos à disposição.

${formatarNegrito('Trevo Legaliza')} 🍀
(11) 93492-7001`;
}

/**
 * Mensagem de RECOBRANÇA — tom educado mas direto, para vencidos.
 */
function gerarMensagemRecobranca(
  processos: ProcessoCobranca[],
  valorTotal: number,
  dataVencimento: string,
  diasAtraso: number,
) {
  const processoTexto = processos.length === 1
    ? `referente ao processo de ${formatarNegrito(processos[0].tipo)} — ${formatarNegrito(processos[0].razao_social)}`
    : `referente a ${formatarNegrito(String(processos.length) + ' processos')}`;

  return `Olá! Aqui é da ${formatarNegrito('Trevo Legaliza')} 🍀

Gostaríamos de verificar o pagamento ${processoTexto} no valor de ${formatarNegrito(formatarValor(valorTotal))}, com vencimento em ${formatarNegrito(dataVencimento)}.
${processos.length > 1 ? '\n' + processos.map(p => `• ${p.tipo} — ${formatarNegrito(p.razao_social)} (${formatarValor(p.valor)})`).join('\n') + '\n' : ''}
${formatarNegrito('Chave PIX (CNPJ):')} 39.969.412/0001-70
${formatarNegrito('Banco:')} C6 Bank

Se preferir ${formatarNegrito('boleto bancário')}, é só solicitar! 📄

Caso já tenha efetuado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

${formatarNegrito('Trevo Legaliza')} 🍀
(11) 93492-7001`;
}
