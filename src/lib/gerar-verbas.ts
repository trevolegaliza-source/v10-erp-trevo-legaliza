import { supabase } from '@/integrations/supabase/client';
import type { Colaborador } from '@/hooks/useColaboradores';
import {
  getBusinessDaysInMonth,
  getFifthBusinessDay,
  getLastBusinessDay,
  calcularAdiantamento,
} from '@/lib/business-days';
import { toast } from 'sonner';

const fmt = (d: Date) => d.toISOString().split('T')[0];

/**
 * Generate all financial entries for a collaborator for a given month/year.
 * Creates up to 4 records in lancamentos:
 *  1. Adiantamento (day 20 or next business day)
 *  2. Benefícios VT+VR (last business day)
 *  3. Guia DAS if applicable (day 20)
 *  4. Saldo restante (5th business day of next month)
 */
export async function gerarVerbasColaborador(
  colab: Colaborador,
  year: number,
  month: number, // 0-indexed
) {
  const diasUteis = getBusinessDaysInMonth(year, month);
  const sal = Number(colab.salario_base);
  const vt = Number(colab.vt_diario);
  const vr = Number(colab.vr_diario);
  const adiantamentoValor = calcularAdiantamento(sal, colab.adiantamento_tipo, Number(colab.adiantamento_valor));
  const beneficios = (vt + vr) * diasUteis;
  const das = Number(colab.valor_das) || 0;
  const saldo = sal - adiantamentoValor;

  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Due dates
  const dia20 = new Date(year, month, 20);
  const ultimoDiaUtil = getLastBusinessDay(year, month);
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const quintoDiaUtil = getFifthBusinessDay(nextYear, nextMonth);

  const records: any[] = [];

  // 1. Adiantamento
  if (adiantamentoValor > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `Adiantamento - ${colab.nome} (${monthLabel})`,
      valor: adiantamentoValor,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(dia20),
      colaborador_id: colab.id,
    });
  }

  // 2. Benefícios
  if (beneficios > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `Benefícios (VT+VR) - ${colab.nome} (${monthLabel})`,
      valor: beneficios,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(ultimoDiaUtil),
      colaborador_id: colab.id,
    });
  }

  // 3. Guia DAS
  if (das > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `Guia DAS - ${colab.nome} (${monthLabel})`,
      valor: das,
      categoria: 'imposto',
      status: 'pendente',
      data_vencimento: fmt(dia20),
      colaborador_id: colab.id,
    });
  }

  // 4. Saldo
  if (saldo > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `Saldo Salário - ${colab.nome} (${monthLabel})`,
      valor: saldo,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(quintoDiaUtil),
      colaborador_id: colab.id,
    });
  }

  if (records.length === 0) return 0;

  const { error } = await (supabase as any).from('lancamentos').insert(records);
  if (error) {
    toast.error(`Erro ao gerar verbas de ${colab.nome}: ${error.message}`);
    throw error;
  }
  return records.length;
}

/**
 * Generate all verbas for all active collaborators for a given month.
 */
export async function gerarVerbasDoMes(colaboradores: Colaborador[], year: number, month: number) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  let total = 0;
  for (const colab of ativos) {
    const count = await gerarVerbasColaborador(colab, year, month);
    total += count;
  }
  return total;
}
