export function gerarMensagemCobranca(params: {
  tipo: string;
  razao_social: string;
  valor: number;
  data_vencimento: string;
  diasAtraso: number;
}) {
  const valorFmt = params.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const dataFmt = new Date(params.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR');

  return `Olá! Aqui é da Trevo Legaliza 🍀.

Identificamos que o pagamento referente ao processo de ${params.tipo} - ${params.razao_social} no valor de ${valorFmt} com vencimento em ${dataFmt} encontra-se em aberto há ${params.diasAtraso} dias.

Chave PIX (CNPJ): 39.969.412/0001-70
Banco: C6 Bank

Caso já tenha realizado o pagamento, por favor desconsidere esta mensagem e nos envie o comprovante.

Atenciosamente,
Trevo Legaliza 🍀
(11) 93492-7001`;
}
