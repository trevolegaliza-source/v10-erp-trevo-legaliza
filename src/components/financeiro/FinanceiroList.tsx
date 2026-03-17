import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import type { Lancamento, EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import { cn } from '@/lib/utils';

interface FinanceiroListProps {
  lancamentos: Lancamento[];
}

export default function FinanceiroList({ lancamentos }: FinanceiroListProps) {
  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Cliente</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Descrição</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Valor</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Vencimento</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Etapa</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {lancamentos.map((l) => {
            const isOverdue = l.etapa_financeiro === 'honorario_vencido';
            const total = Number(l.valor) + Number(l.honorario_extra || 0);
            return (
              <tr key={l.id} className={cn('border-t border-border/30', isOverdue && 'bg-destructive/5')}>
                <td className="px-4 py-2.5 font-medium flex items-center gap-1.5">
                  {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  {(l as any).cliente?.apelido || (l as any).cliente?.nome || '-'}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[200px]">{l.descricao}</td>
                <td className="px-4 py-2.5 font-semibold">
                  {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-2.5">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-[10px]">
                    {ETAPA_FINANCEIRO_LABELS[l.etapa_financeiro as EtapaFinanceiro] || l.etapa_financeiro}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <Badge className={cn(STATUS_STYLES[l.status as StatusFinanceiro], 'border-0 text-[10px]')}>
                    {STATUS_LABELS[l.status as StatusFinanceiro]}
                  </Badge>
                </td>
              </tr>
            );
          })}
          {lancamentos.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-8 text-muted-foreground">
                Nenhum lançamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
