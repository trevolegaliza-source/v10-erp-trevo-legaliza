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
      const { data, error } = await supabase.from('clientes').insert(payload).select('*').single();
      if (error) throw error;
      return data as ClienteDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
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
      const numericFields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'dia_vencimento_mensal'] as const;
      for (const field of numericFields) {
        if ((updates as any)[field] !== undefined) payload[field] = (updates as any)[field];
      }
      if (updates.momento_faturamento !== undefined) payload.momento_faturamento = updates.momento_faturamento;

      const { data, error } = await supabase.from('clientes').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
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
    }) => {
      let preco = input.valor_manual || 0;
      const isManualPrice = input.tipo === 'avulso' || input.tipo === 'orcamento';

      if (!isManualPrice) {
        const { data: precoCalc } = await supabase.rpc('calcular_preco_processo', {
          p_cliente_id: input.cliente_id,
          p_tipo: input.tipo,
        });
        preco = precoCalc || 0;
      }

      const isUrgente = input.prioridade === 'urgente';
      const valorFinal = isUrgente ? preco * 1.5 : preco;

      const { data: vencimento } = await supabase.rpc('calcular_vencimento', {
        p_cliente_id: input.cliente_id,
      });

      const { data: processo, error } = await supabase
        .from('processos')
        .insert({
          cliente_id: input.cliente_id,
          razao_social: input.razao_social,
          tipo: input.tipo,
          prioridade: input.prioridade || 'normal',
          responsavel: input.responsavel || null,
          valor: valorFinal,
        })
        .select('*, cliente:clientes(*)')
        .single();
      if (error) throw error;

      // Check momento_faturamento from client
      const cliente = processo.cliente as ClienteDB | null;
      const momentoFat = (cliente as any)?.momento_faturamento || 'na_solicitacao';

      if (momentoFat === 'na_solicitacao') {
        // Generate billing immediately
        const descParts = [
          `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)} - ${input.razao_social}`,
        ];
        if (isUrgente) descParts.push('(+50% Prioridade)');

        const { error: lancError } = await supabase.from('lancamentos').insert({
          tipo: 'receber',
          cliente_id: input.cliente_id,
          processo_id: processo.id,
          descricao: descParts.join(' '),
          valor: valorFinal,
          status: 'pendente',
          data_vencimento: vencimento || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
        });
        if (lancError) throw lancError;
      }
      // If 'no_deferimento', no billing created now — will be triggered on stage change

      return processo as ProcessoDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
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
      const { data, error } = await supabase.from('lancamentos').insert(lancamento).select().single();
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

      const { data: taxasReemb } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('is_taxa_reembolsavel', true)
        .eq('status', 'pendente');

      const sum = (arr: any[] | null) => (arr || []).reduce((s, r) => s + Number(r.valor), 0);

      return {
        receitaPrevistaMes: sum(receitaMes),
        aReceber7dias: sum(receber7d),
        taxasReembolsar: sum(taxasReemb),
      };
    },
  });
}
