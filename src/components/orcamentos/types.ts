export interface OrcamentoItem {
  id: string;
  secao: string;        // "obrigatorios" | "opcionais" | "geral" | custom
  ordem: number;
  descricao: string;
  detalhes: string;
  honorario: number;    // detailed mode
  honorario_contador: number; // valor sugerido para o contador cobrar do cliente final
  taxa_min: number;
  taxa_max: number;
  prazo: string;
  docs_necessarios: string;
  quantidade: number;
  // legacy compat
  valor?: number;
}

export interface OrcamentoPacote {
  id: string;
  nome: string;
  itens_ids: string[];
  desconto_pct: number;
  descricao: string;
}

export interface OrcamentoSecao {
  key: string;
  label: string;
  descricao: string;
}

export type OrcamentoModo = 'simples' | 'detalhado';

export interface OrcamentoForm {
  prospect_nome: string;
  prospect_cnpj: string;
  prospect_email: string;
  prospect_telefone: string;
  prospect_contato: string;
  cliente_id: string | null;
  modo: OrcamentoModo;
  contexto: string;
  ordem_execucao: string;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  desconto_pct: number;
  validade_dias: number;
  prazo_execucao: string;
  pagamento: string;
  observacoes: string;
}

export const DEFAULT_SECOES: OrcamentoSecao[] = [
  { key: 'geral', label: 'Geral', descricao: '' },
  { key: 'obrigatorios', label: 'Itens Obrigatórios', descricao: 'Serviços necessários para regularização' },
  { key: 'opcionais', label: 'Itens Opcionais', descricao: 'Serviços complementares recomendados' },
];

export function createItem(overrides?: Partial<OrcamentoItem>): OrcamentoItem {
  return {
    id: crypto.randomUUID(),
    secao: 'geral',
    ordem: 0,
    descricao: '',
    detalhes: '',
    honorario: 0,
  honorario_contador: 0,
    taxa_min: 0,
    taxa_max: 0,
    prazo: '',
    docs_necessarios: '',
    quantidade: 1,
    ...overrides,
  };
}

export function createPacote(): OrcamentoPacote {
  return {
    id: crypto.randomUUID(),
    nome: '',
    itens_ids: [],
    desconto_pct: 0,
    descricao: '',
  };
}

/** Get item value: uses honorario for new format, falls back to valor for legacy */
export function getItemValor(item: OrcamentoItem): number {
  return item.honorario || item.valor || 0;
}

/** Normalize legacy items (old format) to new format */
export function normalizeItem(raw: any): OrcamentoItem {
  return {
    id: raw.id || crypto.randomUUID(),
    secao: raw.secao || 'geral',
    ordem: raw.ordem || 0,
    descricao: raw.descricao || '',
    detalhes: raw.detalhes || '',
    honorario: Number(raw.honorario) || Number(raw.valor) || 0,
    honorario_contador: Number(raw.honorario_contador) || 0,
    taxa_min: Number(raw.taxa_min) || 0,
    taxa_max: Number(raw.taxa_max) || 0,
    prazo: raw.prazo || '',
    docs_necessarios: raw.docs_necessarios || '',
    quantidade: Number(raw.quantidade) || 1,
    valor: Number(raw.valor) || undefined,
  };
}
