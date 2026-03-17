import type { Cliente as SupabaseCliente } from '@/types/supabase';

export type TipoCliente = 'MENSALISTA' | 'AVULSO_4D';
export type TipoProcesso = 'abertura' | 'alteracao' | 'transformacao' | 'baixa' | 'avulso' | 'orcamento';
export type StatusFinanceiro = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
export type TipoLancamento = 'receber' | 'pagar';

export interface ClienteDB extends SupabaseCliente {}

export interface ProcessoDB {
  id: string;
  cliente_id: string;
  razao_social: string;
  tipo: TipoProcesso;
  etapa: string;
  prioridade: string;
  responsavel: string | null;
  valor: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB;
}

export type EtapaFinanceiro = 'solicitacao_criada' | 'gerar_cobranca' | 'cobranca_gerada' | 'honorario_pago' | 'honorario_vencido';

export const ETAPA_FINANCEIRO_LABELS: Record<EtapaFinanceiro, string> = {
  solicitacao_criada: 'Solicitação Criada',
  gerar_cobranca: 'Gerar Cobrança',
  cobranca_gerada: 'Cobrança Gerada',
  honorario_pago: 'Honorário Pago',
  honorario_vencido: 'Honorário Vencido',
};

export const ETAPA_FINANCEIRO_COLORS: Record<EtapaFinanceiro, string> = {
  solicitacao_criada: 'border-muted-foreground/40',
  gerar_cobranca: 'border-warning',
  cobranca_gerada: 'border-info',
  honorario_pago: 'border-success',
  honorario_vencido: 'border-destructive',
};

export const ETAPA_FINANCEIRO_ORDER: EtapaFinanceiro[] = [
  'solicitacao_criada',
  'gerar_cobranca',
  'cobranca_gerada',
  'honorario_pago',
  'honorario_vencido',
];

export interface Lancamento {
  id: string;
  tipo: TipoLancamento;
  cliente_id: string | null;
  processo_id: string | null;
  descricao: string;
  valor: number;
  status: StatusFinanceiro;
  data_vencimento: string;
  data_pagamento: string | null;
  is_taxa_reembolsavel: boolean;
  comprovante_url: string | null;
  categoria: string | null;
  etapa_financeiro: EtapaFinanceiro;
  honorario_extra: number;
  cobranca_encaminhada: boolean;
  confirmado_recebimento: boolean;
  observacoes_financeiro: string | null;
  boleto_url: string | null;
  created_at: string;
  updated_at: string;
  cliente?: ClienteDB;
  processo?: ProcessoDB;
}

export interface PrecoTier {
  id: string;
  tipo_processo: TipoProcesso;
  tier: number;
  valor: number;
  descricao: string | null;
}

export const TIPO_PROCESSO_LABELS: Record<TipoProcesso, string> = {
  abertura: 'Abertura',
  alteracao: 'Alteração',
  transformacao: 'Transformação',
  baixa: 'Baixa',
  avulso: 'Avulso',
  orcamento: 'Orçamento',
};

export const STATUS_LABELS: Record<StatusFinanceiro, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};

export const STATUS_STYLES: Record<StatusFinanceiro, string> = {
  pago: 'bg-success/10 text-success',
  pendente: 'bg-warning/10 text-warning',
  atrasado: 'bg-destructive/10 text-destructive',
  cancelado: 'bg-muted text-muted-foreground',
};
