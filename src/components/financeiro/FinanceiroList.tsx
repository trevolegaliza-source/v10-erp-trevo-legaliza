import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { cn } from '@/lib/utils';

interface FinanceiroListProps {
  processos: ProcessoFinanceiro[];
}

export default function FinanceiroList({ processos }: FinanceiroListProps) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Cliente</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Razão Social</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Valor</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Vencimento</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Etapa</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Status</th>
          </tr>
        </thead>
        <tbody>
          {processos.map((p) => {
            const isOverdue = p.etapa_financeiro === 'honorario_vencido';
            const lanc = p.lancamento;
            const total = Number(lanc?.valor ?? p.valor ?? 0) + Number(lanc?.honorario_extra || 0);
            const status = (lanc?.status || 'pendente') as StatusFinanceiro;
            return (
              <tr key={p.id} className={cn('border-t border-border/30', isOverdue && 'bg-destructive/5')}>
                <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                  {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  {(p.cliente as any)?.apelido || (p.cliente as any)?.nome || '-'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{p.razao_social}</td>
                <td className="px-4 py-2.5 font-semibold">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-2.5">
                  {lanc?.data_vencimento ? new Date(lanc.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px]">
                    {ETAPA_FINANCEIRO_LABELS[p.etapa_financeiro]}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={cn(STATUS_STYLES[status], 'border-0 text-[10px]')}>
                    {STATUS_LABELS[status]}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {processos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum processo encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
