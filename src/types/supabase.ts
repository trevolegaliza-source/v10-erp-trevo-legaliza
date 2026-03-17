export type ClienteTipoDB = 'MENSALISTA' | 'AVULSO_4D';
export type MomentoFaturamento = 'na_solicitacao' | 'no_deferimento';

export interface Cliente {
  id: string;
  codigo_identificador: string;
  nome: string;
  tipo: ClienteTipoDB;
  email: string | null;
  telefone: string | null;
  nome_contador: string;
  apelido: string;
  dia_vencimento_mensal: number;
  momento_faturamento: MomentoFaturamento;
  valor_base: number | null;
  desconto_progressivo: number | null;
  dia_cobranca: number | null;
  valor_limite_desconto: number | null;
  mensalidade: number | null;
  vencimento: number | null;
  qtd_processos: number | null;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'valor_base' | 'desconto_progressivo' | 'dia_cobranca' | 'valor_limite_desconto' | 'mensalidade' | 'vencimento' | 'qtd_processos'> & {
  valor_base?: number | null;
  desconto_progressivo?: number | null;
  dia_cobranca?: number | null;
  valor_limite_desconto?: number | null;
  mensalidade?: number | null;
  vencimento?: number | null;
  qtd_processos?: number | null;
};
export type ClienteUpdate = Partial<ClienteInsert> & { updated_at?: string };
