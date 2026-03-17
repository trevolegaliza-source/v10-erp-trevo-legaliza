import { useState, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import FinanceiroCard from './FinanceiroCard';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { useUpdateLancamento } from '@/hooks/useFinanceiro';
import type { Lancamento, EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_ORDER, ETAPA_FINANCEIRO_LABELS, ETAPA_FINANCEIRO_COLORS } from '@/types/financial';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface FinanceiroKanbanProps {
  lancamentos: Lancamento[];
}

export default function FinanceiroKanban({ lancamentos }: FinanceiroKanbanProps) {
  const updateLancamento = useUpdateLancamento();

  // Auto-move overdue items
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    lancamentos.forEach((l) => {
      if (
        l.status !== 'pago' &&
        l.etapa_financeiro !== 'honorario_vencido' &&
        l.etapa_financeiro !== 'honorario_pago' &&
        l.data_vencimento < today
      ) {
        updateLancamento.mutate({
          id: l.id,
          etapa_financeiro: 'honorario_vencido',
          status: 'atrasado',
        } as any);
      }
    });
  }, [lancamentos]); // eslint-disable-line react-hooks/exhaustive-deps

  // Password dialog state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ lancamento: Lancamento; target: EtapaFinanceiro } | null>(null);
  const [passwordTitle, setPasswordTitle] = useState('');
  const [passwordDesc, setPasswordDesc] = useState('');

  const handleMoveRequest = (lancamento: Lancamento, targetEtapa: EtapaFinanceiro) => {
    const cliente = (lancamento as any).cliente;
    const momentoFat = cliente?.momento_faturamento || 'na_solicitacao';

    // Trava de Antecipação
    if (
      lancamento.etapa_financeiro === 'solicitacao_criada' &&
      targetEtapa === 'gerar_cobranca' &&
      momentoFat === 'no_deferimento'
    ) {
      setPasswordTitle('Confirmar Antecipação');
      setPasswordDesc('Este processo deve ser pago no Deferimento. Confirma antecipação? Insira a senha master.');
      setPendingMove({ lancamento, target: targetEtapa });
      setPasswordOpen(true);
      return;
    }

    // Trava de Inadimplência
    if (lancamento.etapa_financeiro === 'honorario_vencido') {
      setPasswordTitle('Trava de Inadimplência');
      setPasswordDesc('Para mover um honorário vencido, insira a senha master.');
      setPendingMove({ lancamento, target: targetEtapa });
      setPasswordOpen(true);
      return;
    }

    // Normal move
    executeMove(lancamento, targetEtapa);
  };

  const executeMove = (lancamento: Lancamento, targetEtapa: EtapaFinanceiro) => {
    const updates: any = {
      id: lancamento.id,
      etapa_financeiro: targetEtapa,
    };

    if (targetEtapa === 'honorario_pago') {
      updates.status = 'pago';
      updates.data_pagamento = new Date().toISOString().split('T')[0];
    }

    updateLancamento.mutate(updates, {
      onSuccess: () => toast.success(`Movido para ${ETAPA_FINANCEIRO_LABELS[targetEtapa]}`),
    });
  };

  const handlePasswordConfirm = () => {
    if (pendingMove) {
      executeMove(pendingMove.lancamento, pendingMove.target);
      setPendingMove(null);
    }
  };

  const columns = ETAPA_FINANCEIRO_ORDER.map((etapa) => ({
    etapa,
    label: ETAPA_FINANCEIRO_LABELS[etapa],
    color: ETAPA_FINANCEIRO_COLORS[etapa],
    items: lancamentos.filter((l) => l.etapa_financeiro === etapa),
  }));

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {columns.map((col) => (
          <div key={col.etapa} className="flex-shrink-0 w-72">
            {/* Column header */}
            <div className={cn('rounded-t-lg border-t-4 bg-card p-3 mb-2', col.color)}>
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  {col.etapa === 'honorario_vencido' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                  {col.label}
                </h3>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                  {col.items.length}
                </span>
              </div>
            </div>
            {/* Cards */}
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {col.items.map((l) => (
                  <FinanceiroCard
                    key={l.id}
                    lancamento={l}
                    onMoveRequest={handleMoveRequest}
                  />
                ))}
                {col.items.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum item</p>
                )}
              </div>
            </ScrollArea>
          </div>
        ))}
      </div>

      <PasswordConfirmDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onConfirm={handlePasswordConfirm}
        title={passwordTitle}
        description={passwordDesc}
      />
    </>
  );
}
