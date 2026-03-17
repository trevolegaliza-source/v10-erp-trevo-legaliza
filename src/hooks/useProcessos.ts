import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KanbanStage, ProcessType } from '@/types/process';
import { toast } from 'sonner';

export interface ProcessoDB {
  id: string;
  cliente_id: string;
  razao_social: string;
  tipo: ProcessType;
  etapa: KanbanStage;
  prioridade: string;
  responsavel: string | null;
  valor: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  cliente?: {
    id: string;
    nome: string;
    codigo_identificador: string;
    tipo: string;
    nome_contador: string | null;
    apelido: string | null;
  };
}

export function useProcessosDB() {
  return useQuery({
    queryKey: ['processos_db'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ProcessoDB[];
    },
  });
}

export function useUpdateProcessoEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: KanbanStage }) => {
      const { error } = await supabase
        .from('processos')
        .update({ etapa, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related lancamentos first to avoid FK constraint
      const { error: lancError } = await supabase
        .from('lancamentos')
        .delete()
        .eq('processo_id', id);
      if (lancError) throw lancError;

      const { error } = await supabase
        .from('processos')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['processos_db'] });
      qc.invalidateQueries({ queryKey: ['dashboard_stats'] });
      toast.success('Processo excluído com sucesso');
    },
    onError: (e: Error) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useClientesDB() {
  return useQuery({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome');
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard_stats'],
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count: processosAtivos } = await supabase
        .from('processos')
        .select('*', { count: 'exact', head: true })
        .not('etapa', 'in', '("finalizados","arquivo")');

      const { count: totalClientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      const { data: faturamento } = await supabase
        .from('lancamentos')
        .select('valor')
        .eq('tipo', 'receber')
        .gte('created_at', startOfMonth);

      const faturamentoMes = (faturamento || []).reduce((s, r) => s + Number(r.valor), 0);

      const { data: urgentes } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .eq('prioridade', 'urgente')
        .not('etapa', 'in', '("finalizados","arquivo")');

      const { data: recentes } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .order('created_at', { ascending: false })
        .limit(6);

      const { data: allProcessos } = await supabase
        .from('processos')
        .select('cliente_id, cliente:clientes(nome)');

      const clientCounts: Record<string, { nome: string; count: number }> = {};
      (allProcessos || []).forEach((p: any) => {
        const nome = p.cliente?.nome || 'Desconhecido';
        if (!clientCounts[p.cliente_id]) clientCounts[p.cliente_id] = { nome, count: 0 };
        clientCounts[p.cliente_id].count++;
      });
      const topClientes = Object.entries(clientCounts)
        .map(([id, v]) => ({ id, nome: v.nome, total: v.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      return {
        processosAtivos: processosAtivos || 0,
        totalClientes: totalClientes || 0,
        faturamentoMes,
        urgentes: (urgentes || []) as ProcessoDB[],
        recentes: (recentes || []) as ProcessoDB[],
        topClientes,
      };
    },
  });
}
