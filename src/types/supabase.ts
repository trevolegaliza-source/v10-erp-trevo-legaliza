export type ClienteTipoDB = 'MENSALISTA' | 'AVULSO_4D';

export interface Cliente {
  id: string;
  codigo_identificador: string;
  nome: string;
  tipo: ClienteTipoDB;
  email: string | null;
  telefone: string | null;
  nome_contador: string | null;
  apelido: string | null;
  dia_vencimento_mensal: number;
  created_at: string;
  updated_at: string;
}

export type ClienteInsert = Omit<Cliente, 'id' | 'created_at' | 'updated_at'>;
export type ClienteUpdate = Partial<ClienteInsert> & { updated_at?: string };
