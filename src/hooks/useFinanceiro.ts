import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, ClienteInsert, ClienteUpdate } from '@/types/supabase';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

const normalizeNullableText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeRequiredText = (value: string | null | undefined) => value?.trim() || '';

const normalizeOptionalNullableText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return normalizeNullableText(value);
};

const sanitizeSearch = (value: string) => value.replace(/[,%]/g, '').trim();

const normalizeClienteInsert = (cliente: Record<string, any>): Record<string, any> => {
  const normalized: Record<string, any> = { ...cliente };
  if (normalized.codigo_identificador) normalized.codigo_identificador = normalized.codigo_identificador.trim();
  if (normalized.nome) normalized.nome = normalized.nome.trim();
  normalized.email = normalizeNullableText(normalized.email);
  normalized.telefone = normalizeNullableText(normalized.telefone);
  normalized.nome_contador = normalizeRequiredText(normalized.nome_contador);
  normalized.apelido = normalizeRequiredText(normalized.apelido);
  return normalized;
};

// ---- CLIENTES ----
export function useClientes(searchTerm?: string) {
  return useQuery({
    queryKey: ['clientes', searchTerm ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('*').order('nome');
      if (error) throw error;

      const clientes = (data || []) as ClienteDB[];
      const normalizedSearch = searchTerm ? sanitizeSearch(searchTerm).toLowerCase() : '';
      if (!normalizedSearch) return clientes;

      return clientes.filter((cliente) => {
        const searchable = [
          cliente.nome,
          cliente.codigo_identificador,
          cliente.nome_contador || '',
          cliente.apelido || '',
        ]
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      });
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cliente: Record<string, any>) => {
      const payload = normalizeClienteInsert(cliente);
      const { data, error } = await supabase.from('clientes').insert(payload as any).select('*').single();
      if (error) throw error;
      return data as ClienteDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['mapa_clientes_estado'] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClienteDB> & { id: string }) => {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (updates.codigo_identificador !== undefined) payload.codigo_identificador = updates.codigo_identificador?.trim();
      if (updates.nome !== undefined) payload.nome = updates.nome?.trim();

      const email = normalizeOptionalNullableText(updates.email);
      if (email !== undefined) payload.email = email;

      const telefone = normalizeOptionalNullableText(updates.telefone);
      if (telefone !== undefined) payload.telefone = telefone;

      if (updates.nome_contador !== undefined) payload.nome_contador = normalizeRequiredText(updates.nome_contador);
      if (updates.apelido !== undefined) payload.apelido = normalizeRequiredText(updates.apelido);

      // Financial columns
      const numericFields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'dia_vencimento_mensal', 'franquia_processos', 'saldo_prepago', 'saldo_ultima_recarga'] as const;
      for (const field of numericFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }
      if (updates.momento_faturamento !== undefined) payload.momento_faturamento = updates.momento_faturamento;
      if ((updates as any).observacoes !== undefined) payload.observacoes = (updates as any).observacoes;
      if ((updates as any).cnpj !== undefined) payload.cnpj = (updates as any).cnpj;
      if ((updates as any).tipo !== undefined) payload.tipo = (updates as any).tipo;
      if ((updates as any).desconto_boas_vindas_aplicado !== undefined) payload.desconto_boas_vindas_aplicado = (updates as any).desconto_boas_vindas_aplicado;
      if ((updates as any).data_ultima_recarga !== undefined) payload.data_ultima_recarga = (updates as any).data_ultima_recarga;
      const textFields = ['estado', 'cidade', 'cep', 'logradouro', 'numero', 'complemento', 'bairro'] as const;
      for (const field of textFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }
      const coordFields = ['latitude', 'longitude'] as const;
      for (const field of coordFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }

      const { data, error } = await supabase.from('clientes').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['mapa_clientes_estado'] });
      toast.success('Cliente atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete lancamentos referencing this client's processes first
      const { data: procs } = await supabase.from('processos').select('id').eq('cliente_id', id);
      if (procs && procs.length > 0) {
        const procIds = procs.map(p => p.id);
        const { error: lErr } = await supabase.from('lancamentos').delete().in('processo_id', procIds);
        if (lErr) throw lErr;
      }
      // Delete lancamentos referencing client directly
      const { error: lcErr } = await supabase.from('lancamentos').delete().eq('cliente_id', id);
      if (lcErr) throw lcErr;
      // Delete documentos for processes
      if (procs && procs.length > 0) {
        const procIds = procs.map(p => p.id);
        await supabase.from('documentos').delete().in('processo_id', procIds);
      }
      // Now delete client (processos cascade)
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Cliente e processos excluídos!');
    },
    onError: (e: Error) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useArchiveCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: cErr } = await supabase.from('clientes').update({ is_archived: true, updated_at: new Date().toISOString() } as any).eq('id', id);
      if (cErr) throw cErr;
      const { error: pErr } = await supabase.from('processos').update({ is_archived: true, updated_at: new Date().toISOString() } as any).eq('cliente_id', id);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      toast.success('Cliente arquivado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUnarchiveCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: cErr } = await supabase.from('clientes').update({ is_archived: false, updated_at: new Date().toISOString() } as any).eq('id', id);
      if (cErr) throw cErr;
      const { error: pErr } = await supabase.from('processos').update({ is_archived: false, updated_at: new Date().toISOString() } as any).eq('cliente_id', id);
      if (pErr) throw pErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      toast.success('Cliente desarquivado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- PROCESSOS ----
export function useProcessos() {
  return useQuery({
    queryKey: ['processos_db'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProcessoDB[];
    },
  });
}

/** Calculate compounding progressive discount */
export function calcularDescontoProgressivo(
  valorBase: number,
  descontoPercent: number,
  processosNoMes: number,
  valorLimite: number | null,
): { valorFinal: number; descontoAcumulado: number; processoNumero: number } {
  let valor = valorBase;
  const processoNumero = processosNoMes + 1; // this will be the Nth process
  for (let i = 0; i < processosNoMes; i++) {
    valor = valor * (1 - descontoPercent / 100);
  }
  if (valorLimite != null && valor < valorLimite) {
    valor = valorLimite;
  }
  valor = Math.max(valor, 0);
  const descontoAcumulado = valorBase - valor;
  return { valorFinal: Math.round(valor * 100) / 100, descontoAcumulado: Math.round(descontoAcumulado * 100) / 100, processoNumero };
}

export function useCreateProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      cliente_id: string;
      razao_social: string;
      tipo: TipoProcesso;
      prioridade?: string;
      responsavel?: string;
      valor_manual?: number;
      notas?: string | null;
      ja_pago?: boolean;
      descricao_avulso?: string;
      desconto_boas_vindas?: number; // percentage, e.g. 10
      mudanca_uf?: boolean; // doubles the process for billing
      data_entrada?: string; // YYYY-MM-DD, defaults to today
    }) => {
      const isAvulso = input.tipo === 'avulso';
      const isManualPrice = !!input.valor_manual && input.valor_manual > 0;
      const isUrgente = input.prioridade === 'urgente';

      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id, tipo, valor_base, momento_faturamento, desconto_progressivo, valor_limite_desconto, franquia_processos, saldo_prepago')
        .eq('id', input.cliente_id)
        .single();
      if (clienteError) throw clienteError;

      const cliente = clienteData as any;
      const isPrePago = cliente.tipo === 'PRE_PAGO';
      const isMensalista = cliente.tipo === 'MENSALISTA';
      const valorBaseCliente = isMensalista ? Number(cliente.valor_base ?? 0) : Number(cliente.valor_base ?? 0);
      const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
      const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;

      // Count same-month processes for this client based on data_entrada (or today)
      const refDate = input.data_entrada ? new Date(input.data_entrada + 'T12:00:00') : new Date();
      const startOfMonth = new Date(refDate.getFullYear(), refDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1).toISOString();
      const { count: processosNoMes } = await supabase
        .from('processos')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', input.cliente_id)
        .gte('created_at', startOfMonth)
        .lt('created_at', endOfMonth);

      const monthCount = processosNoMes ?? 0;

      // How many "slots" this process consumes (mudança de UF = 2)
      const slots = input.mudanca_uf ? 2 : 1;

      let valorFinal: number;
      let discountInfo = '';

      if (isAvulso) {
        valorFinal = isManualPrice ? Number(input.valor_manual) : 0;
      } else if (isManualPrice) {
        valorFinal = Number(input.valor_manual);
      } else if (isPrePago) {
        // For pre-paid, value should come from valor_manual (set by service negotiation)
        valorFinal = isManualPrice ? Number(input.valor_manual) : 0;
      } else if (isMensalista) {
        const franquia = Number(cliente.franquia_processos ?? 0);
        if (franquia > 0 && monthCount < franquia) {
          // Within franchise
          valorFinal = 0;
          discountInfo = `Dentro da franquia (${monthCount + 1}/${franquia})`;
        } else {
          // Exceeded franchise
          const excedenteCount = franquia > 0 ? monthCount - franquia : monthCount;
          if (isUrgente) {
            // URGÊNCIA: valor fixo = base × 1.5, SEM desconto progressivo
            // O slot é ocupado (monthCount já conta) mas o valor não muda
            valorFinal = valorBaseCliente * 1.5;
            discountInfo = `Método Trevo / Urgência | Base: R$ ${valorBaseCliente.toFixed(2)} × 1.5 = R$ ${valorFinal.toFixed(2)}`;
          } else if (descontoPercent > 0) {
            const calc = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, excedenteCount, valorLimite);
            valorFinal = calc.valorFinal;
            discountInfo = `Excedente nº ${excedenteCount + 1} | Base: R$ ${valorBaseCliente.toFixed(2)} | Desc: R$ ${calc.descontoAcumulado.toFixed(2)}`;
          } else {
            valorFinal = valorBaseCliente;
          }
        }
      } else if (cliente.tipo !== 'MENSALISTA') {
        if (isUrgente) {
          // URGÊNCIA: valor fixo = base × 1.5, SEM desconto progressivo
          // O slot é ocupado mas o valor é fixo
          valorFinal = valorBaseCliente * 1.5;
          discountInfo = `Método Trevo / Urgência | Base: R$ ${valorBaseCliente.toFixed(2)} × 1.5 = R$ ${valorFinal.toFixed(2)}`;
        } else if (slots === 2 && descontoPercent > 0) {
          const calc1 = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount, valorLimite);
          const calc2 = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount + 1, valorLimite);
          valorFinal = calc1.valorFinal + calc2.valorFinal;
          discountInfo = `Mudança de UF (2 Processos) | Proc ${calc1.processoNumero}: R$ ${calc1.valorFinal.toFixed(2)} + Proc ${calc2.processoNumero}: R$ ${calc2.valorFinal.toFixed(2)}`;
        } else if (slots === 2) {
          valorFinal = valorBaseCliente * 2;
          discountInfo = `Mudança de UF (2 Processos) | 2 × R$ ${valorBaseCliente.toFixed(2)}`;
        } else if (descontoPercent > 0) {
          const calc = calcularDescontoProgressivo(valorBaseCliente, descontoPercent, monthCount, valorLimite);
          valorFinal = calc.valorFinal;
          if (calc.descontoAcumulado > 0) {
            discountInfo = `Desconto Progressivo: ${descontoPercent}% (Processo nº ${calc.processoNumero} do mês) | Base: R$ ${valorBaseCliente.toFixed(2)} | Desconto: R$ ${calc.descontoAcumulado.toFixed(2)}`;
          }
        } else {
          valorFinal = valorBaseCliente;
        }
      } else {
        valorFinal = isUrgente ? valorBaseCliente * 1.5 : valorBaseCliente;
      }

      // Apply welcome discount (before anything else is added)
      let welcomeDiscountInfo = '';
      if (input.desconto_boas_vindas && input.desconto_boas_vindas > 0) {
        const discountAmt = valorFinal * (input.desconto_boas_vindas / 100);
        valorFinal = Math.round((valorFinal - discountAmt) * 100) / 100;
        welcomeDiscountInfo = `Desconto de Boas-vindas aplicado: ${input.desconto_boas_vindas}% (-R$ ${discountAmt.toFixed(2)})`;
      }

      const { data: vencimento } = await supabase.rpc('calcular_vencimento', {
        p_cliente_id: input.cliente_id,
      });

      // Append discount info to notas
      let notasFinal = input.notas || '';
      if (welcomeDiscountInfo) {
        notasFinal = notasFinal ? `${notasFinal}\n${welcomeDiscountInfo}` : welcomeDiscountInfo;
      }
      if (discountInfo) {
        notasFinal = notasFinal ? `${notasFinal}\n${discountInfo}` : discountInfo;
      }

      const createdAt = input.data_entrada
        ? new Date(input.data_entrada + 'T12:00:00').toISOString()
        : new Date().toISOString();

      const { data: processo, error } = await supabase
        .from('processos')
        .insert({
          cliente_id: input.cliente_id,
          razao_social: input.razao_social,
          tipo: input.tipo,
          prioridade: input.prioridade || 'normal',
          responsavel: input.responsavel || null,
          valor: valorFinal,
          notas: notasFinal || null,
          created_at: createdAt,
        })
        .select('*, cliente:clientes(*)')
        .single();
      if (error) throw error;

      // Determine lancamento description
      const serviceName = isAvulso && input.descricao_avulso
        ? input.descricao_avulso
        : `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)}`;
      const descParts = [input.mudanca_uf ? `${serviceName} (Mudança de UF - 2 Processos)` : `${serviceName}`];
      descParts[0] += ` - ${input.razao_social}`;
      if (isUrgente && !isManualPrice && !isAvulso) descParts.push('(+50% Urgência)');
      if (isManualPrice && !isAvulso) descParts.push('(Valor Manual)');
      if (discountInfo && !input.mudanca_uf) descParts.push(`(${descontoPercent}% desc.)`);
      if (welcomeDiscountInfo) descParts.push(`(Boas-vindas ${input.desconto_boas_vindas}%)`);

      const momentoFat = cliente.momento_faturamento || 'na_solicitacao';
      const shouldCreateLancamento = input.ja_pago || momentoFat === 'na_solicitacao';

      if (shouldCreateLancamento) {
        const lancDate = input.data_entrada || new Date().toISOString().split('T')[0];
        const { error: lancError } = await supabase.from('lancamentos').insert({
          tipo: 'receber',
          cliente_id: input.cliente_id,
          processo_id: processo.id,
          descricao: descParts.join(' '),
          valor: valorFinal,
          status: input.ja_pago ? 'pago' : 'pendente',
          data_vencimento: input.ja_pago ? lancDate : (vencimento || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0]),
          data_pagamento: input.ja_pago ? lancDate : null,
          created_at: createdAt,
          etapa_financeiro: input.ja_pago ? 'honorario_pago' : 'solicitacao_criada',
        });
        if (lancError) throw lancError;
      }

      // If ja_pago, also mark processo as concluido
      if (input.ja_pago) {
        await supabase
          .from('processos')
          .update({ etapa: 'finalizados', updated_at: new Date().toISOString() })
          .eq('id', processo.id);
      }

      // Debit prepaid balance if PRE_PAGO
      if (isPrePago && valorFinal > 0) {
        const saldoAtual = Number(cliente.saldo_prepago ?? 0);
        const novoSaldo = saldoAtual - valorFinal;
        await supabase
          .from('clientes')
          .update({ saldo_prepago: novoSaldo, updated_at: new Date().toISOString() } as any)
          .eq('id', input.cliente_id);
        await supabase
          .from('prepago_movimentacoes')
          .insert({
            cliente_id: input.cliente_id,
            tipo: 'consumo',
            valor: valorFinal,
            saldo_anterior: saldoAtual,
            saldo_posterior: novoSaldo,
            descricao: `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)} - ${input.razao_social}`,
            processo_id: processo.id,
          } as any);
      }

      // Mark boas-vindas as applied
      if (input.desconto_boas_vindas && input.desconto_boas_vindas > 0) {
        await supabase
          .from('clientes')
          .update({ desconto_boas_vindas_aplicado: true, updated_at: new Date().toISOString() } as any)
          .eq('id', input.cliente_id);
      }

      return processo as ProcessoDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      toast.success('Processo criado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Generate billing when process is deferred (for 'no_deferimento' clients)
export async function gerarFaturamentoDeferimento(processo: ProcessoDB) {
  const clienteId = processo.cliente_id;
  // Fetch client to get momento_faturamento
  const { data: cliente } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
  if (!cliente) return;
  const momentoFat = (cliente as any)?.momento_faturamento || 'na_solicitacao';
  if (momentoFat !== 'no_deferimento') return;

  // Check if billing already exists for this process
  const { data: existing } = await supabase.from('lancamentos').select('id').eq('processo_id', processo.id).eq('tipo', 'receber');
  if (existing && existing.length > 0) return; // Already billed

  const { data: vencimento } = await supabase.rpc('calcular_vencimento', { p_cliente_id: clienteId });
  const valorFinal = Number(processo.valor) || 0;
  const desc = `${processo.tipo.charAt(0).toUpperCase() + processo.tipo.slice(1)} - ${processo.razao_social} (Deferido)`;

  const { error } = await supabase.from('lancamentos').insert({
    tipo: 'receber',
    cliente_id: clienteId,
    processo_id: processo.id,
    descricao: desc,
    valor: valorFinal,
    status: 'pendente',
    data_vencimento: vencimento || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
  });
  if (error) toast.error('Erro ao gerar faturamento: ' + error.message);
  else toast.success('Faturamento gerado automaticamente (Deferimento)!');
}

// ---- LANÇAMENTOS ----
export function useLancamentos(tipo?: 'receber' | 'pagar') {
  return useQuery({
    queryKey: ['lancamentos', tipo],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*), processo:processos(*)')
        .order('data_vencimento', { ascending: true });
      if (tipo) query = query.eq('tipo', tipo);
      const { data, error } = await query;
      if (error) throw error;
      return data as Lancamento[];
    },
  });
}

export function useCreateLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (lancamento: Partial<Lancamento>) => {
      const { data, error } = await supabase.from('lancamentos').insert(lancamento as any).select().single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento criado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Lancamento> & { id: string }) => {
      const { data, error } = await supabase
        .from('lancamentos')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Lancamento;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento atualizado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteLancamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success('Lançamento excluído!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- DASHBOARD STATS ----
export function useFinanceiroDashboard() {
  return useQuery({
    queryKey: ['financeiro_dashboard'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const in7days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];

      const { data: receitaMes } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('data_vencimento', startOfMonth)
        .in('status', ['pendente', 'pago']);

      const { data: receber7d } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .gte('data_vencimento', today)
        .lte('data_vencimento', in7days);

      // Taxas a Reembolsar: sum of valores_adicionais without comprovante_url
      const { data: taxasReemb } = await supabase
        .from('valores_adicionais')
        .select('valor, comprovante_url')
        .is('comprovante_url', null);

      const sum = (arr: any[] | null) => (arr || []).reduce((s, r) => s + Number(r.valor), 0);

      return {
        receitaPrevistaMes: sum(receitaMes),
        aReceber7dias: sum(receber7d),
        taxasReembolsar: sum(taxasReemb),
      };
    },
  });
}
