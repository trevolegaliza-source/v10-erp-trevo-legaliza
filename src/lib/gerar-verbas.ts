import { supabase } from '@/integrations/supabase/client';
import type { Colaborador } from '@/hooks/useColaboradores';
import { getBusinessDaysInMonth, getLastBusinessDay, calcularAdiantamento } from '@/lib/business-days';
import { toast } from 'sonner';

const fmt = (d: Date) => d.toISOString().split('T')[0];

/** Clamp day to the last day of the month to avoid rollover */
function safeDate(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

interface VerbaEntry {
  descricao: string;
  valor: number;
  data_vencimento: string;
  categoria: string;
  subcategoria: string;
}

function buildVerbas(colab: Colaborador, year: number, month: number, diasUteisOverride?: number): VerbaEntry[] {
  const diasUteis = diasUteisOverride ?? getBusinessDaysInMonth(year, month);
  const sal = Number(colab.salario_base);
  const vt = Number(colab.vt_diario);
  const vr = Number(colab.vr_diario);
  const das = Number(colab.valor_das) || 0;
  const diaSalario = colab.dia_salario || colab.dia_pagamento_integral || 5;
  const diaAdiantamento = colab.dia_adiantamento || 20;
  const diaVtVr = colab.dia_vt_vr || 0;
  const diaDas = colab.dia_das || 20;
  const ultimoDia = new Date(year, month + 1, 0);
  const lastBizDay = getLastBusinessDay(year, month);

  // VT/VR: if custom day set, use it; otherwise 1st of NEXT month
  const vencVtVr = diaVtVr > 0 ? fmt(safeDate(year, month, diaVtVr)) : fmt(new Date(year, month + 1, 1));

  const entries: VerbaEntry[] = [];

  // 1. ADIANTAMENTO
  if (colab.possui_adiantamento && sal > 0) {
    const valorAdiant = calcularAdiantamento(sal, colab.adiantamento_tipo, Number(colab.adiantamento_valor) || 0);
    if (valorAdiant > 0) {
      entries.push({
        descricao: `Adiantamento - ${colab.nome}`,
        valor: valorAdiant,
        data_vencimento: fmt(safeDate(year, month, diaAdiantamento)),
        categoria: 'folha',
        subcategoria: 'Adiantamento',
      });
    }
  }

  // 2. SALÁRIO
  if (sal > 0) {
    let valorSalario = sal;
    let label = `Salário - ${colab.nome}`;
    if (colab.possui_adiantamento) {
      const adiant = calcularAdiantamento(sal, colab.adiantamento_tipo, Number(colab.adiantamento_valor) || 0);
      valorSalario = sal - adiant;
      label = `Salário (Restante) - ${colab.nome}`;
    }
    if (valorSalario > 0) {
      entries.push({
        descricao: label,
        valor: valorSalario,
        data_vencimento: fmt(new Date(year, month, diaSalario)),
        categoria: 'folha',
        subcategoria: 'Salário',
      });
    }
  }

  // 3. VT or Auxílio Combustível
  const tipoTransporte = (colab as any).tipo_transporte || 'vt';
  const auxilioCombustivelValor = Number((colab as any).auxilio_combustivel_valor) || 0;

  if (tipoTransporte === 'auxilio_combustivel' && auxilioCombustivelValor > 0) {
    entries.push({
      descricao: `Auxílio Combustível - ${colab.nome}`,
      valor: auxilioCombustivelValor,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Transporte (VT)',
    });
  } else if (vt > 0) {
    entries.push({
      descricao: `VT (${diasUteis}d) - ${colab.nome}`,
      valor: vt * diasUteis,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Transporte (VT)',
    });
  }

  // 4. VR
  if (vr > 0) {
    entries.push({
      descricao: `VR (${diasUteis}d) - ${colab.nome}`,
      valor: vr * diasUteis,
      data_vencimento: vencVtVr,
      categoria: 'folha',
      subcategoria: 'Vale Refeição (VR)',
    });
  }

  // 5. DAS
  if (das > 0 && colab.regime !== 'INDEFINIDO') {
    entries.push({
      descricao: `DAS - ${colab.nome}`,
      valor: das,
      data_vencimento: fmt(new Date(year, month, diaDas)),
      categoria: 'folha',
      subcategoria: 'DAS Colaborador',
    });
  }

  // --- CLT only ---
  if (colab.regime === 'CLT') {
    const fgtsPct = Number(colab.fgts_percentual) || 8;
    const inssPct = Number(colab.inss_patronal_percentual) || 20;

    // 6. FGTS — due 7th of NEXT month
    if (sal > 0) {
      const nextMonth = month + 1;
      const fgtsYear = nextMonth > 11 ? year + 1 : year;
      const fgtsMonth = nextMonth > 11 ? 0 : nextMonth;
      entries.push({
        descricao: `FGTS - ${colab.nome}`,
        valor: sal * (fgtsPct / 100),
        data_vencimento: fmt(new Date(fgtsYear, fgtsMonth, 7)),
        categoria: 'folha',
        subcategoria: 'FGTS',
      });
    }

    // 7. INSS Patronal — due 20th of NEXT month
    if (sal > 0) {
      const nextMonth = month + 1;
      const inssYear = nextMonth > 11 ? year + 1 : year;
      const inssMonth = nextMonth > 11 ? 0 : nextMonth;
      entries.push({
        descricao: `INSS Patronal - ${colab.nome}`,
        valor: sal * (inssPct / 100),
        data_vencimento: fmt(new Date(inssYear, inssMonth, 20)),
        categoria: 'impostos',
        subcategoria: 'INSS',
      });
    }

    // 8. Provisão 13º
    if (colab.provisionar_13 && sal > 0) {
      entries.push({
        descricao: `Provisão 13º - ${colab.nome}`,
        valor: sal / 12,
        data_vencimento: fmt(ultimoDia),
        categoria: 'folha',
        subcategoria: '13º Salário (Provisão)',
      });
    }

    // 9. Provisão Férias
    if (colab.provisionar_ferias && sal > 0) {
      entries.push({
        descricao: `Provisão Férias - ${colab.nome}`,
        valor: (sal + sal / 3) / 12,
        data_vencimento: fmt(ultimoDia),
        categoria: 'folha',
        subcategoria: 'Férias (Provisão)',
      });
    }
  }

  return entries;
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
 * Estimate total monthly cost for a single collaborator (used in previews).
 */
export function estimarCustoTotal(colab: Colaborador, diasUteis?: number): number {
  const du = diasUteis ?? 22;
  const sal = Number(colab.salario_base);
  const tipoTransporte = (colab as any).tipo_transporte || 'vt';
  const vt = tipoTransporte === 'auxilio_combustivel' 
    ? (Number((colab as any).auxilio_combustivel_valor) || 0) 
    : Number(colab.vt_diario) * du;
  const vr = Number(colab.vr_diario) * du;
  const das = colab.regime !== 'INDEFINIDO' ? (Number(colab.valor_das) || 0) : 0;
  let total = sal + vt + vr + das;
  if (colab.regime === 'CLT') {
    total += sal * ((Number(colab.fgts_percentual) || 8) / 100);
    total += sal * ((Number(colab.inss_patronal_percentual) || 20) / 100);
    if (colab.provisionar_13) total += sal / 12;
    if (colab.provisionar_ferias) total += (sal + sal / 3) / 12;
  }
  return total;
}

/**
 * Generate all financial entries for a collaborator for a given month/year.
 * Uses upsert logic: update existing pending, skip paid, insert new.
 * Returns count of created/updated entries.
 */
export async function gerarVerbasColaborador(colab: Colaborador, year: number, month: number, diasUteisOverride?: number): Promise<number> {
  const entries = buildVerbas(colab, year, month, diasUteisOverride);
  if (entries.length === 0) return 0;

  // Fetch existing entries for this collaborator/month
  const { data: existing } = await (supabase as any)
    .from('lancamentos')
    .select('id, subcategoria, status')
    .eq('tipo', 'pagar')
    .eq('colaborador_id', colab.id)
    .eq('competencia_mes', month + 1)
    .eq('competencia_ano', year);

  const existingMap = new Map<string, { id: string; status: string }>();
  (existing || []).forEach((e: any) => {
    existingMap.set(e.subcategoria || '', e);
  });

  let count = 0;

  for (const e of entries) {
    const found = existingMap.get(e.subcategoria);

    if (found) {
      if (found.status === 'pago') {
        // Already paid — skip
        continue;
      }
      // Update existing pending entry
      await (supabase as any)
        .from('lancamentos')
        .update({
          descricao: e.descricao,
          valor: e.valor,
          data_vencimento: e.data_vencimento,
          categoria: e.categoria,
          fornecedor: colab.nome,
          updated_at: new Date().toISOString(),
        })
        .eq('id', found.id);
      count++;
    } else {
      // Insert new
      const { error } = await (supabase as any).from('lancamentos').insert({
        tipo: 'pagar' as const,
        descricao: e.descricao,
        valor: e.valor,
        categoria: e.categoria,
        subcategoria: e.subcategoria,
        status: 'pendente' as const,
        data_vencimento: e.data_vencimento,
        colaborador_id: colab.id,
        fornecedor: colab.nome,
        competencia_mes: month + 1,
        competencia_ano: year,
        etapa_financeiro: 'solicitacao_criada',
      });
      if (error) {
        toast.error(`Erro ao gerar verbas de ${colab.nome}: ${error.message}`);
        throw error;
      }
      count++;
    }
  }

  return count;
}

/**
 * Generate all verbas for all active collaborators for a given month.
 */
export async function gerarVerbasDoMes(colaboradores: Colaborador[], year: number, month: number, diasUteisOverride?: number) {
  const ativos = colaboradores.filter(c => c.status === 'ativo');
  await aplicarAumentos(ativos, year, month);
  let total = 0;
  for (const colab of ativos) {
    const count = await gerarVerbasColaborador(colab, year, month, diasUteisOverride);
    total += count;
  }
  return total;
}

export { buildVerbas };
