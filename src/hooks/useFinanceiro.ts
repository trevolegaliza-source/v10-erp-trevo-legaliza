import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ClienteDB, ProcessoDB, Lancamento, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

// ---- CLIENTES ----
export function useClientes() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data as ClienteDB[];
    },
  });
}

export function useCreateCliente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cliente: Omit<ClienteDB, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase.from('clientes').insert(cliente).select().single();
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
    }) => {
      // 1. Calculate price via tiered pricing
      const { data: preco } = await supabase.rpc('calcular_preco_processo', {
        p_cliente_id: input.cliente_id,
        p_tipo: input.tipo,
      });

      // 2. Calculate due date
      const { data: vencimento } = await supabase.rpc('calcular_vencimento', {
        p_cliente_id: input.cliente_id,
      });

      // 3. Create process
      const { data: processo, error } = await supabase
        .from('processos')
        .insert({
          cliente_id: input.cliente_id,
          razao_social: input.razao_social,
          tipo: input.tipo,
          prioridade: input.prioridade || 'normal',
          responsavel: input.responsavel || null,
          valor: preco || 0,
        })
        .select('*, cliente:clientes(*)')
        .single();
      if (error) throw error;

      // 4. Create financial entry (contas a receber)
      const clienteNome = (processo as any).cliente?.nome || 'Cliente';
      const { error: lancError } = await supabase.from('lancamentos').insert({
        tipo: 'receber',
        cliente_id: input.cliente_id,
        processo_id: processo.id,
        descricao: `${input.tipo.charAt(0).toUpperCase() + input.tipo.slice(1)} - ${input.razao_social}`,
        valor: preco || 0,
        status: 'pendente',
        data_vencimento: vencimento || new Date(Date.now() + 4 * 86400000).toISOString().split('T')[0],
      });
      if (lancError) throw lancError;

      return processo as ProcessoDB;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['lancamentos'] });
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

      // Receita prevista do mês
      const { data: receitaMes } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('data_vencimento', startOfMonth)
        .in('status', ['pendente', 'pago']);

      // A receber nos próximos 7 dias
      const { data: receber7d } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .gte('data_vencimento', today)
        .lte('data_vencimento', in7days);

      // Taxas reembolsáveis
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
