interface ProcessoCobranca {
  tipo: string;
  razao_social: string;
  valor: number;
}

function formatarRazaoSocialWhatsapp(razaoSocial: string) {
  const limpa = razaoSocial.trim().replace(/^\*+|\*+$/g, '');
  return `*${limpa}*`;
}

export function gerarMensagemCobranca(params: {
  tipo: string;
  razao_social: string;
  valor: number;
  data_vencimento: string;
  diasAtraso: number;
  /** Additional processes to include in the same message */
  processosAdicionais?: ProcessoCobranca[];
}) {
  const valorTotal = params.processosAdicionais?.length
    ? params.valor + params.processosAdicionais.reduce((s, p) => s + p.valor, 0)
    : params.valor;
  const valorFmt = valorTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataFmt = new Date(params.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR');

  // Build process list
  const allProcessos: ProcessoCobranca[] = [
    { tipo: params.tipo, razao_social: params.razao_social, valor: params.valor },
    ...(params.processosAdicionais || []),
  ];

  const processoLines = allProcessos.length > 1
    ? allProcessos.map(p => {
        const v = p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        return `• ${p.tipo} - ${formatarRazaoSocialWhatsapp(p.razao_social)} (${v})`;
      }).join('\n')
    : null;

  const processoDesc = processoLines
    ? `referente aos seguintes processos:\n${processoLines}\n\nValor total: ${valorFmt}`
    : `referente ao processo de ${params.tipo} - ${formatarRazaoSocialWhatsapp(params.razao_social)} no valor de ${valorFmt}`;

  return `Olá! Aqui é da Trevo Legaliza 🍀.

Identificamos que o pagamento ${processoDesc} com vencimento em ${dataFmt} encontra-se em aberto há ${params.diasAtraso} dias.

Chave PIX (CNPJ): 39.969.412/0001-70
Banco: C6 Bank

Caso já tenha realizado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

Atenciosamente,
Trevo Legaliza 🍀
(11) 93492-7001`;
}
