import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function FluxoProximos15Dias() {
  const { data } = useQuery({
    queryKey: ['fluxo_proximos_15dias'],
    queryFn: async () => {
      const hoje = new Date();
      const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
      const em15 = new Date(hoje); em15.setDate(em15.getDate() + 15);
      const hojeStr = hoje.toISOString().split('T')[0];
      const em7Str = em7.toISOString().split('T')[0];
      const em15Str = em15.toISOString().split('T')[0];

      const { data: rows } = await supabase
        .from('lancamentos')
        .select('valor, data_vencimento')
        .eq('tipo', 'pagar')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', em15Str);

      const items = rows || [];
      const total_despesas = items.length;
      const total_valor = items.reduce((s, r) => s + Number(r.valor), 0);
      const criticos = items.filter(r => r.data_vencimento <= em7Str);
      return {
        total_despesas,
        total_valor,
        criticos_7dias: criticos.length,
        valor_critico_7dias: criticos.reduce((s, r) => s + Number(r.valor), 0),
      };
    },
    refetchInterval: 30000,
  });

  if (!data || data.total_despesas === 0) return null;

  const hoje = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="bg-card rounded-lg border border-border border-l-4 border-l-primary p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Fluxo · Próximos 15 dias
        </span>
        <span className="text-xs text-muted-foreground">hoje: {hoje}</span>
      </div>

      <div className="flex items-baseline gap-4">
        <span className="text-2xl font-bold text-foreground">{fmt(data.total_valor)}</span>
        <span className="text-sm text-muted-foreground">{data.total_despesas} despesa{data.total_despesas !== 1 ? 's' : ''}</span>
      </div>

      {data.criticos_7dias > 0 && (
        <div className="flex items-center gap-1.5 mt-2 text-sm" style={{ color: '#F59E0B' }}>
          <AlertTriangle className="h-4 w-4" />
          <span>
            {data.criticos_7dias} vence{data.criticos_7dias !== 1 ? 'm' : ''} em até 7 dias · {fmt(data.valor_critico_7dias)}
          </span>
        </div>
      )}
    </div>
  );
}
