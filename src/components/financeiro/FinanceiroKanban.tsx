import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import FinanceiroCard from './FinanceiroCard';
import ProcessoEditModal from './ProcessoEditModal';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import GerarCobrancaModal from './GerarCobrancaModal';
import { useMoveEtapaFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_ORDER, ETAPA_FINANCEIRO_LABELS, ETAPA_FINANCEIRO_COLORS } from '@/types/financial';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface FinanceiroKanbanProps {
  processos: ProcessoFinanceiro[];
}

export default function FinanceiroKanban({ processos }: FinanceiroKanbanProps) {
  const moveEtapa = useMoveEtapaFinanceiro();

  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState<{ processo: ProcessoFinanceiro; target: EtapaFinanceiro } | null>(null);
  const [passwordTitle, setPasswordTitle] = useState('');
  const [passwordDesc, setPasswordDesc] = useState('');

  const [cobrancaModalOpen, setCobrancaModalOpen] = useState(false);
  const [cobrancaProcesso, setCobrancaProcesso] = useState<ProcessoFinanceiro | null>(null);

  // Double-click edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);

  const handleDoubleClick = (processo: ProcessoFinanceiro) => {
    setEditProcesso(processo);
    setEditModalOpen(true);
  };

  const handleMoveRequest = (processo: ProcessoFinanceiro, targetEtapa: EtapaFinanceiro) => {
    const cliente = processo.cliente as any;
    const momentoFat = cliente?.momento_faturamento || 'na_solicitacao';

    if (
      processo.etapa_financeiro === 'solicitacao_criada' &&
      targetEtapa === 'gerar_cobranca' &&
      momentoFat === 'no_deferimento'
    ) {
      setPasswordTitle('Confirmar Antecipação');
      setPasswordDesc('Este processo deve ser pago no Deferimento. Confirma antecipação? Insira a senha master.');
      setPendingMove({ processo, target: targetEtapa });
      setPasswordOpen(true);
      return;
    }

    if (processo.etapa_financeiro === 'honorario_vencido') {
      setPasswordTitle('Trava de Inadimplência');
      setPasswordDesc('Para mover um honorário vencido, insira a senha master.');
      setPendingMove({ processo, target: targetEtapa });
      setPasswordOpen(true);
      return;
    }

    if (targetEtapa === 'cobranca_gerada' && processo.etapa_financeiro === 'gerar_cobranca') {
      setCobrancaProcesso(processo);
      setCobrancaModalOpen(true);
      return;
    }

    executeMove(processo, targetEtapa);
  };

  const executeMove = (processo: ProcessoFinanceiro, targetEtapa: EtapaFinanceiro) => {
    moveEtapa.mutate(
      { processo, targetEtapa },
      { onSuccess: () => toast.success(`Movido para ${ETAPA_FINANCEIRO_LABELS[targetEtapa]}`) },
    );
  };

  const handlePasswordConfirm = () => {
    if (pendingMove) {
      executeMove(pendingMove.processo, pendingMove.target);
      setPendingMove(null);
    }
  };

  const handleCobrancaConfirm = () => {
    if (cobrancaProcesso) {
      executeMove(cobrancaProcesso, 'cobranca_gerada');
      setCobrancaProcesso(null);
    }
  };

  const columns = ETAPA_FINANCEIRO_ORDER.map((etapa) => ({
    etapa,
    label: ETAPA_FINANCEIRO_LABELS[etapa],
    color: ETAPA_FINANCEIRO_COLORS[etapa],
    items: processos.filter((p) => p.etapa_financeiro === etapa),
  }));

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin w-full">
        {columns.map((col) => (
          <div key={col.etapa} className="flex-1 min-w-[260px]">
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
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {col.items.map((p) => (
                  <FinanceiroCard
                    key={p.id}
                    processo={p}
                    onMoveRequest={handleMoveRequest}
                    onDoubleClick={handleDoubleClick}
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

      <GerarCobrancaModal
        open={cobrancaModalOpen}
        onOpenChange={setCobrancaModalOpen}
        processo={cobrancaProcesso}
        onConfirm={handleCobrancaConfirm}
      />

      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={editProcesso}
      />
    </>
  );
}
