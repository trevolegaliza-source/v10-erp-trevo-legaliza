import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ClienteFinanceiro {
  cliente_id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  cliente_cnpj: string | null;
  cliente_tipo: string;
  cliente_momento_faturamento: string;
  cliente_dia_cobranca: number | null;
  cliente_dia_vencimento_mensal: number | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_nome_contador: string | null;
  cliente_valor_base: number | null;
  cliente_desconto_progressivo: number | null;
  cliente_valor_limite_desconto: number | null;
  lancamentos: LancamentoFinanceiro[];
  total_faturado: number;
  total_pendente: number;
  qtd_processos: number;
  qtd_sem_extrato: number;
  qtd_aguardando_deferimento: number;
  etapa_predominante: string;
  extrato_mais_recente: { id: string; pdf_url: string; filename: string; created_at: string } | null;
}

export interface LancamentoFinanceiro {
  id: string;
  processo_id: string;
  processo_razao_social: string;
  processo_tipo: string;
  processo_etapa: string;
  processo_notas: string | null;
  processo_valor: number;
  processo_created_at: string;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  etapa_financeiro: string;
  extrato_id: string | null;
  descricao: string;
  confirmado_recebimento: boolean;
  total_valores_adicionais: number;
  tem_etiqueta_metodo_trevo: boolean;
  tem_etiqueta_prioridade: boolean;
  observacoes_financeiro: string | null;
}

const ETAPAS_PRE_DEFERIMENTO = [
  'recebidos', 'analise_documental', 'contrato', 'viabilidade',
  'dbe', 'vre', 'aguardando_pagamento', 'taxa_paga',
  'assinaturas', 'assinado', 'em_analise',
];

const ETAPAS_POS_DEFERIMENTO = [
  'registro', 'mat', 'inscricao_me', 'alvaras', 'conselho', 'finalizados', 'arquivo',
];

const ETAPA_ORDER: Record<string, number> = {
  solicitacao_criada: 0,
  cobranca_gerada: 1,
  cobranca_enviada: 2,
  honorario_vencido: 3,
  honorario_pago: 4,
};

/**
 * Determines if a client should appear in the "Cobrar" tab based on billing rules.
 * Returns { show: boolean, isFutura: boolean } — isFutura means it belongs in "Próximas faturas".
 */
export function clienteDeveAparecerEmCobrar(cliente: ClienteFinanceiro): { show: boolean; isFutura: boolean } {
  if (cliente.qtd_sem_extrato === 0) return { show: false, isFutura: false };

  const hoje = new Date();
  const diaHoje = hoje.getDate();

  // No deferimento: sempre mostrar se tem lançamentos sem extrato.
  // O controle de deferimento é feito no DeferimentoModal ao gerar o extrato.
  if (cliente.cliente_momento_faturamento === 'no_deferimento') {
    return { show: true, isFutura: false };
  }

  // Fatura mensal dia X (somente quando NÃO há dia_cobranca): show 5 days before
  if (cliente.cliente_dia_vencimento_mensal && cliente.cliente_dia_vencimento_mensal > 0 && !cliente.cliente_dia_cobranca) {
    const diaFatura = cliente.cliente_dia_vencimento_mensal;
    // Within 5-day window before billing day → show in main list
    if (diaHoje >= diaFatura - 5 && diaHoje <= diaFatura) return { show: true, isFutura: false };
    // Outside window (before or after billing day) → future billing for next cycle
    return { show: false, isFutura: true };
  }

  // Avulso D+X ou padrão: mostrar imediatamente
  return { show: true, isFutura: false };
}

/**
 * A lancamento is "vencido" only if it was SENT to the client (cobranca_enviada)
 * and the due date has passed.
 */
export function isLancamentoVencidoReal(l: LancamentoFinanceiro): boolean {
  if (l.etapa_financeiro !== 'cobranca_enviada') return false;
  if (l.status === 'pago') return false;
  if (!l.data_vencimento) return false;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = new Date(l.data_vencimento + 'T00:00:00');
  return venc < hoje;
}

/** Invalidate all financial queries across screens */
export function invalidateFinanceiro(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
  qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
  qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
  qc.invalidateQueries({ queryKey: ['lancamentos'] });
}

export interface MensalistaSemFatura {
  id: string;
  nome: string;
  apelido: string | null;
  valor_base: number;
  dia_vencimento_mensal: number;
  telefone: string | null;
}

export function useFinanceiroClientes(dataInicio?: string, dataFim?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['financeiro_clientes', dataInicio, dataFim],
    queryFn: async () => {
      // Fetch ALL pending lancamentos (no date filter) + paid ones within period
      // This ensures processes with future vencimento dates (e.g. no_deferimento clients) are never hidden
      const pendingQ = supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, data_pagamento, status, etapa_financeiro, extrato_id, descricao, processo_id, cliente_id, confirmado_recebimento, observacoes_financeiro')
        .eq('tipo', 'receber')
        .neq('status', 'pago')
        .order('created_at', { ascending: false });

      let pagosQ = supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, data_pagamento, status, etapa_financeiro, extrato_id, descricao, processo_id, cliente_id, confirmado_recebimento, observacoes_financeiro')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .order('created_at', { ascending: false });

      if (dataInicio) pagosQ = pagosQ.gte('data_vencimento', dataInicio);
      if (dataFim) pagosQ = pagosQ.lte('data_vencimento', dataFim);

      const [pendingRes, pagosRes] = await Promise.all([pendingQ, pagosQ]);
      if (pendingRes.error) throw pendingRes.error;
      if (pagosRes.error) throw pagosRes.error;

      // Deduplicate by id
      const seenIds = new Set<string>();
      const lancamentos: typeof pendingRes.data = [];
      for (const l of [...(pendingRes.data || []), ...(pagosRes.data || [])]) {
        if (!seenIds.has(l.id)) {
          seenIds.add(l.id);
          lancamentos.push(l);
        }
      }
      if (!lancamentos?.length) return [];

      const processoIds = [...new Set(lancamentos.map(l => l.processo_id).filter(Boolean))] as string[];
      const clienteIds = [...new Set(lancamentos.map(l => l.cliente_id).filter(Boolean))] as string[];

      const [processosRes, clientesRes, valoresAdicionaisRes] = await Promise.all([
        processoIds.length > 0
          ? supabase.from('processos').select('id, razao_social, tipo, etapa, notas, valor, created_at, etiquetas').in('id', processoIds)
          : { data: [], error: null },
        clienteIds.length > 0
          ? supabase.from('clientes').select('id, nome, apelido, cnpj, tipo, momento_faturamento, dia_cobranca, dia_vencimento_mensal, telefone, email, nome_contador, valor_base, desconto_progressivo, valor_limite_desconto').in('id', clienteIds)
          : { data: [], error: null },
        processoIds.length > 0
          ? supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds)
          : { data: [], error: null },
      ]);

      const processoMap = new Map((processosRes.data || []).map((p: any) => [p.id, p]));
      const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

      // Sum valores adicionais per processo
      const vaMap = new Map<string, number>();
      for (const va of (valoresAdicionaisRes.data || [])) {
        vaMap.set(va.processo_id, (vaMap.get(va.processo_id) || 0) + Number(va.valor));
      }

      const result = new Map<string, ClienteFinanceiro>();

      for (const l of lancamentos) {
        const clienteId = l.cliente_id;
        // Handle orphan lancamentos (no client linked)
        const ORPHAN_ID = '__orphan__';
        const effectiveClienteId = clienteId || ORPHAN_ID;
        const cliente = clienteId ? clienteMap.get(clienteId) : null;
        if (clienteId && !cliente) continue;
        const processo = l.processo_id ? processoMap.get(l.processo_id) : null;

        if (!result.has(effectiveClienteId)) {
          result.set(effectiveClienteId, {
            cliente_id: effectiveClienteId,
            cliente_nome: cliente?.nome || '⚠️ SEM CLIENTE VINCULADO',
            cliente_apelido: cliente?.apelido || null,
            cliente_cnpj: cliente?.cnpj || null,
            cliente_tipo: cliente?.tipo || 'AVULSO_4D',
            cliente_momento_faturamento: cliente?.momento_faturamento || 'na_solicitacao',
            cliente_dia_cobranca: cliente?.dia_cobranca || null,
            cliente_dia_vencimento_mensal: cliente?.dia_vencimento_mensal || null,
            cliente_telefone: cliente?.telefone || null,
            cliente_email: cliente?.email || null,
            cliente_nome_contador: cliente?.nome_contador || null,
            cliente_valor_base: cliente?.valor_base || null,
            cliente_desconto_progressivo: cliente?.desconto_progressivo || null,
            cliente_valor_limite_desconto: cliente?.valor_limite_desconto || null,
            lancamentos: [],
            total_faturado: 0,
            total_pendente: 0,
            qtd_processos: 0,
            qtd_sem_extrato: 0,
            qtd_aguardando_deferimento: 0,
            etapa_predominante: 'solicitacao_criada',
            extrato_mais_recente: null,
          });
        }

        const c = result.get(effectiveClienteId)!;

        const etiquetas: string[] = processo?.etiquetas || [];
        const totalVA = l.processo_id ? (vaMap.get(l.processo_id) || 0) : 0;

        c.lancamentos.push({
          id: l.id,
          processo_id: l.processo_id || '',
          processo_razao_social: processo?.razao_social || '',
          processo_tipo: processo?.tipo || '',
          processo_etapa: processo?.etapa || '',
          processo_notas: processo?.notas || null,
          processo_valor: processo?.valor || 0,
          processo_created_at: processo?.created_at || '',
          valor: l.valor,
          data_vencimento: l.data_vencimento,
          data_pagamento: l.data_pagamento,
          status: l.status,
          etapa_financeiro: l.etapa_financeiro,
          extrato_id: l.extrato_id,
          descricao: l.descricao,
          confirmado_recebimento: l.confirmado_recebimento ?? false,
          total_valores_adicionais: totalVA,
          tem_etiqueta_metodo_trevo: etiquetas.includes('metodo_trevo'),
          tem_etiqueta_prioridade: etiquetas.includes('prioridade'),
          observacoes_financeiro: l.observacoes_financeiro || null,
        });

        c.total_faturado += l.valor;
        c.total_pendente += l.status !== 'pago' ? l.valor : 0;
        c.qtd_processos++;
        if (!l.extrato_id && l.etapa_financeiro === 'solicitacao_criada') c.qtd_sem_extrato++;

        if (cliente?.momento_faturamento === 'no_deferimento' && processo) {
          if (ETAPAS_PRE_DEFERIMENTO.includes(processo.etapa || '')) {
            c.qtd_aguardando_deferimento++;
          }
        }
      }

      // Determine predominant stage per client (only non-pago lancamentos)
      for (const c of result.values()) {
        const nonPago = c.lancamentos.filter(l => l.status !== 'pago');
        if (nonPago.length === 0) {
          c.etapa_predominante = 'honorario_pago';
          continue;
        }
        let minOrder = 99;
        for (const l of nonPago) {
          const order = ETAPA_ORDER[l.etapa_financeiro] ?? 99;
          if (order < minOrder) minOrder = order;
        }
        const entry = Object.entries(ETAPA_ORDER).find(([, v]) => v === minOrder);
        c.etapa_predominante = entry ? entry[0] : 'solicitacao_criada';
      }

      // Fetch most recent extrato per client
      const allClienteIds = Array.from(result.keys());
      if (allClienteIds.length > 0) {
        const { data: extratos } = await supabase
          .from('extratos')
          .select('id, cliente_id, pdf_url, filename, created_at')
          .in('cliente_id', allClienteIds)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false });

        if (extratos) {
          for (const ext of extratos) {
            const c = result.get(ext.cliente_id);
            if (c && !c.extrato_mais_recente) {
              c.extrato_mais_recente = {
                id: ext.id,
                pdf_url: ext.pdf_url,
                filename: ext.filename,
                created_at: ext.created_at || '',
              };
            }
          }
        }
      }

      return Array.from(result.values());
    },
    staleTime: 60_000,
  });

  const marcarEnviado = useMutation({
    mutationFn: async ({ lancamentoIds }: { lancamentoIds: string[] }) => {
      const { error } = await supabase
        .from('lancamentos')
        .update({
          etapa_financeiro: 'cobranca_enviada',
          observacoes_financeiro: `Cobrança enviada em ${new Date().toLocaleDateString('pt-BR')}`,
        } as any)
        .in('id', lancamentoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinanceiro(queryClient);
      toast.success('Cobrança marcada como enviada!');
    },
  });

  const marcarPago = useMutation({
    mutationFn: async ({ lancamentoIds, dataPagamento }: { lancamentoIds: string[]; dataPagamento?: string }) => {
      const { error } = await supabase
        .from('lancamentos')
        .update({
          etapa_financeiro: 'honorario_pago',
          status: 'pago' as const,
          data_pagamento: dataPagamento || new Date().toISOString().split('T')[0],
          confirmado_recebimento: true,
        })
        .in('id', lancamentoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinanceiro(queryClient);
      toast.success('Pagamento confirmado!');
    },
  });

  const desfazerPagamento = useMutation({
    mutationFn: async ({ lancamentoIds }: { lancamentoIds: string[] }) => {
      const { error } = await supabase
        .from('lancamentos')
        .update({
          etapa_financeiro: 'cobranca_enviada',
          status: 'pendente' as const,
          data_pagamento: null,
          confirmado_recebimento: false,
        })
        .in('id', lancamentoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinanceiro(queryClient);
      toast.success('Pagamento desfeito! Lançamento voltou para "Aguardando".');
    },
  });

  const clientes = query.data || [];

  // ── Mensalistas without invoice this month ──
  const mensalistaQuery = useQuery({
    queryKey: ['mensalistas_sem_fatura', dataInicio],
    queryFn: async () => {
      const now = new Date();
      const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const fimMes = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data: mensalistas } = await supabase
        .from('clientes')
        .select('id, nome, apelido, valor_base, dia_vencimento_mensal, telefone')
        .eq('tipo', 'MENSALISTA')
        .neq('is_archived', true);

      if (!mensalistas?.length) return [];

      const { data: lancMes } = await supabase
        .from('lancamentos')
        .select('cliente_id')
        .eq('tipo', 'receber')
        .gte('data_vencimento', inicioMes)
        .lte('data_vencimento', fimMes)
        .in('cliente_id', mensalistas.map(m => m.id));

      const clientesComFatura = new Set((lancMes || []).map(l => l.cliente_id));

      return mensalistas
        .filter(m => !clientesComFatura.has(m.id))
        .map(m => ({
          id: m.id,
          nome: m.nome,
          apelido: m.apelido,
          valor_base: Number(m.valor_base || 0),
          dia_vencimento_mensal: m.dia_vencimento_mensal || 10,
          telefone: m.telefone,
        })) as MensalistaSemFatura[];
    },
    staleTime: 60_000,
  });

  const mensalistasSemFatura = mensalistaQuery.data || [];

  // Correct KPI calculations
  const allLanc = clientes.flatMap(c => c.lancamentos);
  const totalFaturado = allLanc.reduce((s, l) => s + l.valor, 0);
  const totalRecebido = allLanc
    .filter(l => l.status === 'pago' && l.confirmado_recebimento === true && l.data_pagamento != null)
    .reduce((s, l) => s + l.valor, 0);
  const totalCobrado = allLanc
    .filter(l => l.extrato_id != null || ['cobranca_gerada', 'cobranca_enviada', 'honorario_pago'].includes(l.etapa_financeiro))
    .reduce((s, l) => s + l.valor, 0);
  const totalPendente = totalFaturado - totalRecebido;
  const taxaRecebimento = totalFaturado > 0 ? Math.round(totalRecebido / totalFaturado * 100) : 0;

  // ── Multi-tab assignment: a client can appear in MULTIPLE tabs ──
  // Each tab gets a "view" of the client with only the relevant lancamentos.
  function buildClienteView(c: ClienteFinanceiro, filteredLancs: LancamentoFinanceiro[]): ClienteFinanceiro {
    return {
      ...c,
      lancamentos: filteredLancs,
      total_faturado: filteredLancs.reduce((s, l) => s + l.valor, 0),
      total_pendente: filteredLancs.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
      qtd_processos: filteredLancs.length,
      qtd_sem_extrato: filteredLancs.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
    };
  }

  function getLancamentoTab(l: LancamentoFinanceiro): string {
    if (l.status === 'pago' || l.etapa_financeiro === 'honorario_pago') return 'pagos';
    if (l.etapa_financeiro === 'cobranca_enviada') return 'aguardando';
    if (l.etapa_financeiro === 'cobranca_gerada' && l.extrato_id) return 'enviados';
    return 'cobrar';
  }

  // Build per-tab client views
  const tabMap: Record<string, Map<string, LancamentoFinanceiro[]>> = {
    cobrar: new Map(), enviados: new Map(), aguardando: new Map(), pagos: new Map(),
  };

  for (const c of clientes) {
    for (const l of c.lancamentos) {
      const tab = getLancamentoTab(l);
      if (!tabMap[tab].has(c.cliente_id)) tabMap[tab].set(c.cliente_id, []);
      tabMap[tab].get(c.cliente_id)!.push(l);
    }
  }

  const clienteById = new Map(clientes.map(c => [c.cliente_id, c]));

  function buildTabClientes(tab: string): ClienteFinanceiro[] {
    const entries = tabMap[tab];
    const result: ClienteFinanceiro[] = [];
    for (const [clienteId, lancs] of entries) {
      const original = clienteById.get(clienteId);
      if (original) result.push(buildClienteView(original, lancs));
    }
    return result;
  }

  const clientesCobrarRaw = buildTabClientes('cobrar');
  const cobrarResult = clientesCobrarRaw.map(c => ({ c, result: clienteDeveAparecerEmCobrar(c) }));
  const clientesCobrar = cobrarResult.filter(x => x.result.show).map(x => x.c);
  const clientesFuturaFatura = cobrarResult.filter(x => x.result.isFutura).map(x => x.c);

  const clientesEnviados = buildTabClientes('enviados');
  const clientesAguardando = buildTabClientes('aguardando');
  const clientesPagos = buildTabClientes('pagos');

  const metricas = {
    totalFaturado,
    totalCobrado,
    totalPendente,
    totalRecebido,
    taxaRecebimento,
    aguardandoExtrato: clientesCobrar.length,
    valorAguardandoExtrato: clientesCobrar.reduce((s, c) => s + c.total_pendente, 0),
    aguardandoEnvio: clientesEnviados.length,
    valorAguardandoEnvio: clientesEnviados.reduce((s, c) => s + c.total_pendente, 0),
    aguardandoPagamento: clientesAguardando.length,
    valorAguardandoPagamento: clientesAguardando.reduce((s, c) => s + c.total_pendente, 0),
    vencidos: clientesAguardando.filter(c => c.lancamentos.some(l => isLancamentoVencidoReal(l))).length,
    valorVencido: clientesAguardando.reduce((s, c) => s + c.lancamentos.filter(l => isLancamentoVencidoReal(l)).reduce((ss, l) => ss + l.valor, 0), 0),
    totalProcessos: allLanc.length,
    clientesCobrados: clientes.filter(c => c.lancamentos.some(l => l.extrato_id != null || ['cobranca_gerada', 'cobranca_enviada', 'honorario_pago'].includes(l.etapa_financeiro))).length,
    clientesPendentes: clientes.filter(c => c.lancamentos.some(l => l.status !== 'pago')).length,
  };

  return {
    clientes,
    clientesCobrar,
    clientesFuturaFatura,
    clientesEnviados,
    clientesAguardando,
    clientesPagos,
    metricas,
    isLoading: query.isLoading,
    isVencido: isLancamentoVencidoReal,
    marcarEnviado,
    marcarPago,
    desfazerPagamento,
    refetch: query.refetch,
  };
}
