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
  cliente_nome_contato_financeiro: string | null;
  cliente_telefone_financeiro: string | null;
  cliente_valor_base: number | null;
  cliente_desconto_progressivo: number | null;
  cliente_valor_limite_desconto: number | null;
  lancamentos: LancamentoFinanceiro[];
  total_faturado: number;
  total_pendente: number;
  qtd_processos: number;
  qtd_sem_extrato: number;
  qtd_aguardando_deferimento: number;
  qtd_auditados: number;
  qtd_nao_auditados: number;
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
  auditado: boolean;
  auditado_por: string | null;
  auditado_em: string | null;
  valor_original: number | null;
  valor_alterado_por: string | null;
  valor_alterado_em: string | null;
}

const ETAPAS_PRE_DEFERIMENTO = [
  'recebidos', 'analise_documental', 'contrato', 'viabilidade',
  'dbe', 'vre', 'aguardando_pagamento', 'taxa_paga',
  'assinaturas', 'assinado', 'em_analise',
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
 */
export function clienteDeveAparecerEmCobrar(cliente: ClienteFinanceiro): { show: boolean; isFutura: boolean } {
  if (cliente.qtd_sem_extrato === 0) return { show: false, isFutura: false };

  const hoje = new Date();
  const diaHoje = hoje.getDate();

  if (cliente.cliente_momento_faturamento === 'no_deferimento') {
    return { show: true, isFutura: false };
  }

  if (cliente.cliente_dia_vencimento_mensal && cliente.cliente_dia_vencimento_mensal > 0 && !cliente.cliente_dia_cobranca) {
    const diaFatura = cliente.cliente_dia_vencimento_mensal;
    if (diaHoje >= diaFatura - 5 && diaHoje <= diaFatura) return { show: true, isFutura: false };
    return { show: false, isFutura: true };
  }

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

// ── Audit mutations ──

export function useAuditarLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lancamentoId, auditado }: { lancamentoId: string; auditado: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('lancamentos')
        .update({
          auditado,
          auditado_por: auditado ? user?.id : null,
          auditado_em: auditado ? new Date().toISOString() : null,
        } as any)
        .eq('id', lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc),
  });
}

export function useAuditarTodosCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lancamentoIds }: { lancamentoIds: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('lancamentos')
        .update({
          auditado: true,
          auditado_por: user?.id,
          auditado_em: new Date().toISOString(),
        } as any)
        .in('id', lancamentoIds);
      if (error) throw error;
    },
    onSuccess: () => invalidateFinanceiro(qc),
  });
}

export function useAlterarValorLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lancamentoId, novoValor, valorAtual }: { lancamentoId: string; novoValor: number; valorAtual: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('lancamentos')
        .update({
          valor: novoValor,
          valor_original: valorAtual,
          valor_alterado_por: user?.id,
          valor_alterado_em: new Date().toISOString(),
        } as any)
        .eq('id', lancamentoId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateFinanceiro(qc);
      toast.success('Valor alterado com sucesso!');
    },
  });
}

export function useFinanceiroClientes(dataInicio?: string, dataFim?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['financeiro_clientes', dataInicio, dataFim],
    queryFn: async () => {
      const pendingQ = supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, data_pagamento, status, etapa_financeiro, extrato_id, descricao, processo_id, cliente_id, confirmado_recebimento, observacoes_financeiro, auditado, auditado_por, auditado_em, valor_original, valor_alterado_por, valor_alterado_em')
        .eq('tipo', 'receber')
        .neq('status', 'pago')
        .order('created_at', { ascending: false });

      let pagosQ = supabase
        .from('lancamentos')
        .select('id, valor, data_vencimento, data_pagamento, status, etapa_financeiro, extrato_id, descricao, processo_id, cliente_id, confirmado_recebimento, observacoes_financeiro, auditado, auditado_por, auditado_em, valor_original, valor_alterado_por, valor_alterado_em')
        .eq('tipo', 'receber')
        .eq('status', 'pago')
        .order('created_at', { ascending: false });

      if (dataInicio) pagosQ = pagosQ.gte('data_vencimento', dataInicio);
      if (dataFim) pagosQ = pagosQ.lte('data_vencimento', dataFim);

      const [pendingRes, pagosRes] = await Promise.all([pendingQ, pagosQ]);
      if (pendingRes.error) throw pendingRes.error;
      if (pagosRes.error) throw pagosRes.error;

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
          ? supabase.from('clientes').select('id, nome, apelido, cnpj, tipo, momento_faturamento, dia_cobranca, dia_vencimento_mensal, telefone, email, nome_contador, valor_base, desconto_progressivo, valor_limite_desconto, nome_contato_financeiro, telefone_financeiro').in('id', clienteIds)
          : { data: [], error: null },
        processoIds.length > 0
          ? supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds)
          : { data: [], error: null },
      ]);

      const processoMap = new Map((processosRes.data || []).map((p: any) => [p.id, p]));
      const clienteMap = new Map((clientesRes.data || []).map((c: any) => [c.id, c]));

      const vaMap = new Map<string, number>();
      for (const va of (valoresAdicionaisRes.data || [])) {
        vaMap.set(va.processo_id, (vaMap.get(va.processo_id) || 0) + Number(va.valor));
      }

      const result = new Map<string, ClienteFinanceiro>();

      for (const l of lancamentos) {
        const clienteId = l.cliente_id;
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
            cliente_nome_contato_financeiro: cliente?.nome_contato_financeiro || null,
            cliente_telefone_financeiro: cliente?.telefone_financeiro || null,
            cliente_valor_base: cliente?.valor_base || null,
            cliente_desconto_progressivo: cliente?.desconto_progressivo || null,
            cliente_valor_limite_desconto: cliente?.valor_limite_desconto || null,
            lancamentos: [],
            total_faturado: 0,
            total_pendente: 0,
            qtd_processos: 0,
            qtd_sem_extrato: 0,
            qtd_aguardando_deferimento: 0,
            qtd_auditados: 0,
            qtd_nao_auditados: 0,
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
          auditado: (l as any).auditado ?? false,
          auditado_por: (l as any).auditado_por || null,
          auditado_em: (l as any).auditado_em || null,
          valor_original: (l as any).valor_original || null,
          valor_alterado_por: (l as any).valor_alterado_por || null,
          valor_alterado_em: (l as any).valor_alterado_em || null,
        });

        c.total_faturado += l.valor;
        c.total_pendente += l.status !== 'pago' ? l.valor : 0;
        c.qtd_processos++;
        if (!l.extrato_id && l.etapa_financeiro === 'solicitacao_criada') c.qtd_sem_extrato++;

        // Audit counts (only pending)
        if (l.status !== 'pago') {
          if ((l as any).auditado) c.qtd_auditados++;
          else c.qtd_nao_auditados++;
        }

        if (cliente?.momento_faturamento === 'no_deferimento' && processo) {
          if (ETAPAS_PRE_DEFERIMENTO.includes(processo.etapa || '')) {
            c.qtd_aguardando_deferimento++;
          }
        }
      }

      // Determine predominant stage per client
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
    staleTime: 300_000,
    refetchOnMount: false,
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
    staleTime: 300_000,
    refetchOnMount: false,
  });

  const mensalistasSemFatura = mensalistaQuery.data || [];

  // KPI calculations
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

  // ── Multi-tab assignment ──
  function buildClienteView(c: ClienteFinanceiro, filteredLancs: LancamentoFinanceiro[]): ClienteFinanceiro {
    return {
      ...c,
      lancamentos: filteredLancs,
      total_faturado: filteredLancs.reduce((s, l) => s + l.valor, 0),
      total_pendente: filteredLancs.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
      qtd_processos: filteredLancs.length,
      qtd_sem_extrato: filteredLancs.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
      qtd_auditados: filteredLancs.filter(l => l.status !== 'pago' && l.auditado).length,
      qtd_nao_auditados: filteredLancs.filter(l => l.status !== 'pago' && !l.auditado).length,
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

  // ── "Cobrar" tab: only AUDITED lancamentos ──
  const clientesCobrarRaw = buildTabClientes('cobrar');
  // Filter each client's lancamentos to only audited ones for the "Cobrar" tab
  const clientesCobrarAuditados: ClienteFinanceiro[] = [];
  for (const c of clientesCobrarRaw) {
    const auditadosLancs = c.lancamentos.filter(l => l.auditado);
    if (auditadosLancs.length > 0) {
      clientesCobrarAuditados.push(buildClienteView(c, auditadosLancs));
    }
  }
  const cobrarResult = clientesCobrarAuditados.map(c => ({ c, result: clienteDeveAparecerEmCobrar(c) }));
  const clientesCobrar = cobrarResult.filter(x => x.result.show).map(x => x.c);
  const clientesFuturaFatura = cobrarResult.filter(x => x.result.isFutura).map(x => x.c);

  // ── "Aguardando Auditoria" tab: non-audited pending lancamentos ──
  const clientesAguardandoAuditoriaMap = new Map<string, LancamentoFinanceiro[]>();
  for (const c of clientesCobrarRaw) {
    const naoAuditados = c.lancamentos.filter(l => !l.auditado && l.status !== 'pago' && l.etapa_financeiro === 'solicitacao_criada');
    if (naoAuditados.length > 0) {
      clientesAguardandoAuditoriaMap.set(c.cliente_id, naoAuditados);
    }
  }
  const clientesAguardandoAuditoria: ClienteFinanceiro[] = [];
  for (const [clienteId, lancs] of clientesAguardandoAuditoriaMap) {
    const original = clienteById.get(clienteId);
    if (original) clientesAguardandoAuditoria.push(buildClienteView(original, lancs));
  }

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
    clientesAguardandoAuditoria,
    clientesEnviados,
    clientesAguardando,
    clientesPagos,
    mensalistasSemFatura,
    metricas,
    isLoading: query.isLoading,
    isVencido: isLancamentoVencidoReal,
    marcarEnviado,
    marcarPago,
    desfazerPagamento,
    refetch: query.refetch,
  };
}
