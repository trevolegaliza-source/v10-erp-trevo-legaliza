import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Cliente, ClienteInsert, ClienteUpdate } from '@/types/supabase';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

const CLIENTE_SELECT_FIELDS =
  'id,codigo_identificador,nome,tipo,email,telefone,nome_contador,apelido,dia_vencimento_mensal,created_at,updated_at';

const normalizeNullableText = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalNullableText = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return normalizeNullableText(value);
};

const sanitizeSearch = (value: string) => value.replace(/[,%]/g, '').trim();

const formatClienteSchemaCacheError = (error: Error) => {
  const message = error.message || '';
  const lowered = message.toLowerCase();

  if (lowered.includes('schema cache') && (lowered.includes('apelido') || lowered.includes('nome_contador'))) {
    return "Schema cache da API desatualizado para 'clientes'. Execute no Supabase SQL Editor: NOTIFY pgrst, 'reload schema';";
  }

  return message;
};

const normalizeClienteInsert = (cliente: ClienteInsert): ClienteInsert => ({
  ...cliente,
  codigo_identificador: cliente.codigo_identificador.trim(),
  nome: cliente.nome.trim(),
  email: normalizeNullableText(cliente.email),
  telefone: normalizeNullableText(cliente.telefone),
  nome_contador: normalizeNullableText(cliente.nome_contador),
  apelido: normalizeNullableText(cliente.apelido),
});

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
    mutationFn: async (cliente: Omit<ClienteDB, 'id' | 'created_at' | 'updated_at'>) => {
      const payload = normalizeClienteInsert(cliente as ClienteInsert);
      const { data, error } = await supabase.from('clientes').insert(payload).select('*').single();
      if (error) throw error;
      return data as ClienteDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente criado com sucesso!');
    },
    onError: (e: Error) => toast.error(formatClienteSchemaCacheError(e)),
  });
}

export function useUpdateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ClienteDB> & { id: string }) => {
      const payload: Partial<ClienteUpdate> = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      if (updates.codigo_identificador !== undefined) payload.codigo_identificador = updates.codigo_identificador.trim();
      if (updates.nome !== undefined) payload.nome = updates.nome.trim();

      const email = normalizeOptionalNullableText(updates.email);
      if (email !== undefined) payload.email = email;

      const telefone = normalizeOptionalNullableText(updates.telefone);
      if (telefone !== undefined) payload.telefone = telefone;

      const nomeContador = normalizeOptionalNullableText(updates.nome_contador);
      if (nomeContador !== undefined) payload.nome_contador = nomeContador;

      const apelido = normalizeOptionalNullableText(updates.apelido);
      if (apelido !== undefined) payload.apelido = apelido;

      const { data, error } = await supabase.from('clientes').update(payload).eq('id', id).select('*').single();
      if (error) throw error;
      return data as Cliente;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente atualizado!');
    },
    onError: (e: Error) => toast.error(formatClienteSchemaCacheError(e)),
  });
}

export function useDeleteCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clientes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] });
      toast.success('Cliente excluído!');
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
      valor_manual?: number; // for avulso/orcamento
    }) => {
      let preco = input.valor_manual || 0;
      const isManualPrice = input.tipo === 'avulso' || input.tipo === 'orcamento';

      // Calculate price via tiered pricing (only for standard types)
      if (!isManualPrice) {
        const { data: precoCalc } = await supabase.rpc('calcular_preco_processo', {
          p_cliente_id: input.cliente_id,
          p_tipo: input.tipo,
        });
        preco = precoCalc || 0;
      }

      // Priority surcharge: Valor_Final = Valor_Base × 1.5
      const isUrgente = input.prioridade === 'urgente';
      const valorFinal = isUrgente ? preco * 1.5 : preco;

      // Calculate due date
      const { data: vencimento } = await supabase.rpc('calcular_vencimento', {
        p_cliente_id: input.cliente_id,
      });

      // Create process
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

      // Create financial entry (contas a receber)
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

      return processo as ProcessoDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast.success('Processo criado e lançamento financeiro gerado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ---- LANÇAMENTOS ----
export function useLancamentos(tipo?: 'receber' | 'pagar') {
  return useQuery({
    queryKey: ['lancamentos', tipo],
    queryFn: async () => {
      let query = supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*)')
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
