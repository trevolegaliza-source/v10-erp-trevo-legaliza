import { supabase } from '@/integrations/supabase/client';
import type { Colaborador } from '@/hooks/useColaboradores';
import {
  getBusinessDaysInMonth,
  getFifthBusinessDay,
} from '@/lib/business-days';
import { toast } from 'sonner';

const fmt = (d: Date) => d.toISOString().split('T')[0];

/**
 * Check if a verba already exists for this collaborator/month/type.
 */
async function findExistingVerba(
  colaboradorId: string,
  tipoVerba: string,
  mesRef: number,
  anoRef: number,
): Promise<string | null> {
  const monthLabel = new Date(anoRef, mesRef).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const { data } = await (supabase as any)
    .from('lancamentos')
    .select('id')
    .eq('colaborador_id', colaboradorId)
    .eq('tipo', 'pagar')
    .ilike('descricao', `%${monthLabel}%`)
    .ilike('descricao', `%${tipoVerba}%`)
    .limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

interface VerbaEntry {
  tipoVerba: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria: string;
}

/**
 * Build entries for collaborator WITHOUT adiantamento (e.g. Michele).
 * 2 entries: full salary on configured day + benefits on last day of month.
 */
function buildEntriesSemAdiantamento(colab: Colaborador, year: number, month: number, diasUteis: number): VerbaEntry[] {
  const sal = Number(colab.salario_base);
  const vt = Number(colab.vt_diario);
  const vr = Number(colab.vr_diario);
  const beneficios = (vt + vr) * diasUteis;
  const das = Number(colab.valor_das) || 0;
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const diaPagamento = colab.dia_pagamento_integral || 5;
  const diaPag = new Date(year, month, diaPagamento);
  // Last day of month for benefits
  const ultimoDia = new Date(year, month + 1, 0);

  const entries: VerbaEntry[] = [];

  if (sal > 0) {
    entries.push({
      tipoVerba: 'Salário Integral',
      descricao: `Salário Integral - ${colab.nome} (${monthLabel})`,
      valor: sal,
      data_vencimento: fmt(diaPag),
      categoria: 'colaborador',
    });
  }

  if (beneficios > 0) {
    entries.push({
      tipoVerba: 'Benefícios',
      descricao: `Benefícios (VT+VR) - ${colab.nome} (${monthLabel})`,
      valor: beneficios,
      data_vencimento: fmt(ultimoDia),
      categoria: 'colaborador',
    });
  }

  if (das > 0) {
    entries.push({
      tipoVerba: 'Guia DAS',
      descricao: `Guia DAS - ${colab.nome} (${monthLabel})`,
      valor: das,
      data_vencimento: fmt(new Date(year, month, 20)),
      categoria: 'imposto',
    });
  }

  return entries;
}

/**
 * Build entries for collaborator WITH adiantamento (default).
 * 4 entries: benefits day 1, 50% on 5th biz day, 50% on day 20, DAS day 20.
 */
function buildEntriesComAdiantamento(colab: Colaborador, year: number, month: number, diasUteis: number): VerbaEntry[] {
  const sal = Number(colab.salario_base);
  const vt = Number(colab.vt_diario);
  const vr = Number(colab.vr_diario);
  const beneficios = (vt + vr) * diasUteis;
  const das = Number(colab.valor_das) || 0;
  const metadeSalario = sal / 2;
  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const dia01 = new Date(year, month, 1);
  const dia20 = new Date(year, month, 20);
  const quintoDiaUtil = getFifthBusinessDay(year, month);

  const entries: VerbaEntry[] = [];

  if (beneficios > 0) {
    entries.push({
      tipoVerba: 'Benefícios',
      descricao: `Benefícios (VT+VR) - ${colab.nome} (${monthLabel})`,
      valor: beneficios,
      data_vencimento: fmt(dia01),
      categoria: 'colaborador',
    });
  }

  if (metadeSalario > 0) {
    entries.push({
      tipoVerba: '50% Salário',
      descricao: `50% Salário - ${colab.nome} (${monthLabel})`,
      valor: metadeSalario,
      data_vencimento: fmt(quintoDiaUtil),
      categoria: 'colaborador',
    });
  }

  if (metadeSalario > 0) {
    entries.push({
      tipoVerba: '50% Salário (2ª parcela)',
      descricao: `50% Salário (2ª parcela) - ${colab.nome} (${monthLabel})`,
      valor: metadeSalario,
      data_vencimento: fmt(dia20),
      categoria: 'colaborador',
    });
  }

  if (das > 0) {
    entries.push({
      tipoVerba: 'Guia DAS',
      descricao: `Guia DAS - ${colab.nome} (${monthLabel})`,
      valor: das,
      data_vencimento: fmt(dia20),
      categoria: 'imposto',
    });
  }

  return entries;
}

/**
 * Generate all financial entries for a collaborator for a given month/year.
 * IDEMPOTENT: checks for existing records before inserting, updates if salary changed.
 */
export async function gerarVerbasColaborador(
  colab: Colaborador,
  year: number,
  month: number,
) {
  const diasUteis = getBusinessDaysInMonth(year, month);

  const entries = colab.possui_adiantamento === false
    ? buildEntriesSemAdiantamento(colab, year, month, diasUteis)
    : buildEntriesComAdiantamento(colab, year, month, diasUteis);

  if (entries.length === 0) return 0;

  let created = 0;
  for (const entry of entries) {
    const existingId = await findExistingVerba(colab.id, entry.tipoVerba, month, year);
    if (existingId) {
      await (supabase as any)
        .from('lancamentos')
        .update({ valor: entry.valor, updated_at: new Date().toISOString() })
        .eq('id', existingId);
    } else {
      const { error } = await (supabase as any).from('lancamentos').insert({
        tipo: 'pagar',
        descricao: entry.descricao,
        valor: entry.valor,
        categoria: entry.categoria,
        status: 'pendente',
        data_vencimento: entry.data_vencimento,
        colaborador_id: colab.id,
      });
      if (error) {
        toast.error(`Erro ao gerar verba de ${colab.nome}: ${error.message}`);
        throw error;
      }
      created++;
    }
  }
  return created;
}

/**
 * Check and apply scheduled salary increases before generating verbas.
 */
async function aplicarAumentos(colaboradores: Colaborador[], year: number, month: number) {
  const mesAno = `${year}-${String(month + 1).padStart(2, '0')}`;
  for (const colab of colaboradores) {
    if (colab.aumento_previsto_data && colab.aumento_previsto_valor && Number(colab.aumento_previsto_valor) > 0) {
      if (colab.aumento_previsto_data === mesAno) {
        const novoSalario = Number(colab.aumento_previsto_valor);
        await (supabase as any).from('colaboradores').update({
          salario_base: novoSalario,
          aumento_previsto_valor: 0,
          aumento_previsto_data: null,
          updated_at: new Date().toISOString(),
        }).eq('id', colab.id);
        colab.salario_base = novoSalario;
        toast.info(`Aumento aplicado para ${colab.nome}: R$ ${novoSalario.toFixed(2)}`);
      }
    }
  }
}

/**
 * Generate all verbas for all active collaborators for a given month.
 */
export async function gerarVerbasDoMes(colaboradores: Colaborador[], year: number, month: number) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  await aplicarAumentos(ativos, year, month);
  let total = 0;
  for (const colab of ativos) {
    const count = await gerarVerbasColaborador(colab, year, month);
    total += count;
  }
  return total;
}
