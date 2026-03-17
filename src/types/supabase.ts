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
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;
export type ClienteUpdate = Partial<ClienteInsert> & { updated_at?: string };
