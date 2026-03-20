import { supabase } from '@/integrations/supabase/client';
import type { Colaborador } from '@/hooks/useColaboradores';
import {
  getBusinessDaysInMonth,
  getFifthBusinessDay,
} from '@/lib/business-days';
import { toast } from 'sonner';

const fmt = (d: Date) => d.toISOString().split('T')[0];

/**
 * Generate all financial entries for a collaborator for a given month/year.
 * Creates up to 4 records in lancamentos:
 *  1. VT + VR (Day 1 of the month)
 *  2. 50% Salário (5th business day)
 *  3. 50% Salário (Day 20)
 *  4. Guia DAS if applicable (Day 20)
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
  const beneficios = (vt + vr) * diasUteis;
  const das = Number(colab.valor_das) || 0;
  const metadeSalario = sal / 2;

  const monthLabel = new Date(year, month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Due dates
  const dia01 = new Date(year, month, 1);
  const dia20 = new Date(year, month, 20);
  const quintoDiaUtil = getFifthBusinessDay(year, month);

  const records: any[] = [];

  // 1. VT + VR (Day 1)
  if (beneficios > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `Benefícios (VT+VR) - ${colab.nome} (${monthLabel})`,
      valor: beneficios,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(dia01),
      colaborador_id: colab.id,
    });
  }

  // 2. 50% Salário (5th business day)
  if (metadeSalario > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `50% Salário - ${colab.nome} (${monthLabel})`,
      valor: metadeSalario,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(quintoDiaUtil),
      colaborador_id: colab.id,
    });
  }

  // 3. 50% Salário (Day 20)
  if (metadeSalario > 0) {
    records.push({
      tipo: 'pagar',
      descricao: `50% Salário (2ª parcela) - ${colab.nome} (${monthLabel})`,
      valor: metadeSalario,
      categoria: 'colaborador',
      status: 'pendente',
      data_vencimento: fmt(dia20),
      colaborador_id: colab.id,
    });
  }

  // 4. Guia DAS
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

  if (records.length === 0) return 0;

  const { error } = await (supabase as any).from('lancamentos').insert(records);
  if (error) {
    toast.error(`Erro ao gerar verbas de ${colab.nome}: ${error.message}`);
    throw error;
  }
  return records.length;
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
