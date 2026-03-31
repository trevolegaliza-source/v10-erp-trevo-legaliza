import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DespesaRecorrente {
  id: string;
  descricao: string;
  categoria: string;
  subcategoria: string | null;
  valor: number;
  dia_vencimento: number;
  fornecedor: string | null;
  colaborador_id: string | null;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useLancamentosPagar(mes: number, ano: number) {
  return useQuery({
    queryKey: ['lancamentos_pagar', mes, ano],
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('tipo', 'pagar')
        .eq('competencia_mes', mes)
        .eq('competencia_ano', ano)
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// Fallback query: fetch by date range when competencia fields are null (legacy data)
export function useLancamentosPagarByDate(mes: number, ano: number) {
  const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const endDate = mes === 12
    ? `${ano + 1}-01-01`
    : `${ano}-${String(mes + 1).padStart(2, '0')}-01`;

  return useQuery({
    queryKey: ['lancamentos_pagar_date', mes, ano],
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('tipo', 'pagar')
        .gte('data_vencimento', startDate)
        .lt('data_vencimento', endDate)
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useDespesasRecorrentes() {
  return useQuery({
    queryKey: ['despesas_recorrentes'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('despesas_recorrentes')
        .select('*')
        .order('categoria', { ascending: true });
      if (error) throw error;
      return (data || []) as DespesaRecorrente[];
    },
  });
}

export function useCreateDespesa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from('lancamentos').insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Despesa criada com sucesso!');
    },
    onError: (e: any) => toast.error('Erro ao criar despesa: ' + e.message),
  });
}

export function useUpdateDespesa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Record<string, any>) => {
      const { error } = await supabase.from('lancamentos').update(values as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Despesa atualizada!');
    },
    onError: (e: any) => toast.error('Erro ao atualizar: ' + e.message),
  });
}

export function useDeleteDespesa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lancamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Despesa excluída!');
    },
    onError: (e: any) => toast.error('Erro ao excluir: ' + e.message),
  });
}

export function useMarcarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data_pagamento, comprovante_url }: { id: string; data_pagamento: string; comprovante_url?: string }) => {
      // First, mark the target lancamento
      const { data: target, error: fetchError } = await supabase
        .from('lancamentos')
        .select('id, colaborador_id, competencia_mes, competencia_ano, subcategoria')
        .eq('id', id)
        .single();
      if (fetchError) throw fetchError;

      const sub = (target.subcategoria || '').toLowerCase();
      const isVtVr = sub.includes('vt') || sub.includes('vr') || sub.includes('vale transporte') || sub.includes('vale refeição') || sub.includes('transporte') || sub.includes('refeição');

      if (isVtVr && target.colaborador_id && target.competencia_mes && target.competencia_ano) {
        // Mark both VT and VR for the same collaborator/month
        // First get all VT/VR ids for this collaborator/month
        const { data: vtVrItems, error: fetchVtVrError } = await supabase
          .from('lancamentos')
          .select('id, subcategoria')
          .eq('colaborador_id', target.colaborador_id)
          .eq('competencia_mes', target.competencia_mes)
          .eq('competencia_ano', target.competencia_ano);
        if (fetchVtVrError) throw fetchVtVrError;

        const vtVrIds = (vtVrItems || [])
          .filter((item: any) => {
            const s = (item.subcategoria || '').toLowerCase();
            return s.includes('vt') || s.includes('vr') || s.includes('vale transporte') || s.includes('vale refeição') || s.includes('transporte') || s.includes('refeição');
          })
          .map((item: any) => item.id);

        if (vtVrIds.length > 0) {
          const { error } = await supabase.from('lancamentos').update({
            status: 'pago' as any,
            data_pagamento,
            comprovante_url: comprovante_url || null,
            updated_at: new Date().toISOString(),
          }).in('id', vtVrIds);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('lancamentos').update({
          status: 'pago' as any,
          data_pagamento,
          comprovante_url: comprovante_url || null,
          updated_at: new Date().toISOString(),
        }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
      qc.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
      toast.success('Pagamento confirmado!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useCreateRecorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Record<string, any>) => {
      const { error } = await supabase.from('despesas_recorrentes').insert(values as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas_recorrentes'] });
      toast.success('Despesa recorrente criada!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateRecorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Record<string, any>) => {
      const { error } = await supabase.from('despesas_recorrentes').update(values as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas_recorrentes'] });
      toast.success('Recorrente atualizada!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useToggleRecorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from('despesas_recorrentes').update({ ativo } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas_recorrentes'] });
      toast.success('Status atualizado!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useDeleteRecorrente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('despesas_recorrentes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['despesas_recorrentes'] });
      toast.success('Recorrente excluída!');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export async function gerarLancamentosRecorrentes(mes: number, ano: number) {
  const lastDay = new Date(ano, mes, 0).getDate();
  const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`;
  const endOfMonth = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`;

  const { data: recorrentes } = await supabase
    .from('despesas_recorrentes')
    .select('*')
    .eq('ativo', true)
    .lte('data_inicio', endOfMonth)
    .or(`data_fim.is.null,data_fim.gte.${startOfMonth}`);

  if (!recorrentes || recorrentes.length === 0) return 0;

  const { data: existentes } = await supabase
    .from('lancamentos')
    .select('despesa_recorrente_id')
    .eq('tipo', 'pagar')
    .eq('competencia_mes', mes)
    .eq('competencia_ano', ano)
    .not('despesa_recorrente_id', 'is', null);

  const jaGerados = new Set((existentes || []).map((e: any) => e.despesa_recorrente_id));

  const novos = recorrentes
    .filter(r => !jaGerados.has(r.id))
    .map(r => {
      const dia = Math.min(r.dia_vencimento, lastDay);
      return {
        tipo: 'pagar' as const,
        descricao: r.descricao,
        valor: r.valor,
        data_vencimento: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
        status: 'pendente' as const,
        categoria: r.categoria,
        subcategoria: r.subcategoria,
        fornecedor: r.fornecedor,
        colaborador_id: r.colaborador_id,
        despesa_recorrente_id: r.id,
        competencia_mes: mes,
        competencia_ano: ano,
        etapa_financeiro: 'solicitacao_criada',
      };
    });

  if (novos.length > 0) {
    const { error } = await supabase.from('lancamentos').insert(novos as any);
    if (error) throw error;
  }

  return novos.length;
}
