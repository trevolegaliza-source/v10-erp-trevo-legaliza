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

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);

  const handleDoubleClick = (processo: ProcessoFinanceiro) => {
    setEditProcesso(processo);
    setEditModalOpen(true);
  };

  const handleMoveRequest = (processo: ProcessoFinanceiro, targetEtapa: EtapaFinanceiro) => {
    const cliente = processo.cliente as any;
    const momentoFat = cliente?.momento_faturamento || 'na_solicitacao';

    // Password gate: anticipation for 'no_deferimento' clients
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

    // Password gate: overdue invoices
    if (processo.etapa_financeiro === 'honorario_vencido') {
      setPasswordTitle('Trava de Inadimplência');
      setPasswordDesc('Para mover um honorário vencido, insira a senha master.');
      setPendingMove({ processo, target: targetEtapa });
      setPasswordOpen(true);
      return;
    }

    // PASSWORD GATE: "Gerar Cobrança" action
    if (targetEtapa === 'cobranca_gerada' && processo.etapa_financeiro === 'gerar_cobranca') {
      setPasswordTitle('Confirmar Geração de Cobrança');
      setPasswordDesc('Insira a senha master para gerar a cobrança.');
      setPendingMove({ processo, target: '__gerar_cobranca__' as any });
      setPasswordOpen(true);
      return;
    }

    // PASSWORD GATE: "Marcar como Pago" action
    if (targetEtapa === 'honorario_pago') {
      setPasswordTitle('Confirmar Pagamento');
      setPasswordDesc('Insira a senha master para marcar como pago.');
      setPendingMove({ processo, target: targetEtapa });
      setPasswordOpen(true);
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
      // If it was a gerar_cobranca action, open the cobranca modal
      if ((pendingMove.target as string) === '__gerar_cobranca__') {
        setCobrancaProcesso(pendingMove.processo);
        setCobrancaModalOpen(true);
      } else {
        executeMove(pendingMove.processo, pendingMove.target);
      }
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
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex min-w-max gap-3">
          {columns.map((col) => (
            <div key={col.etapa} className="flex-1 min-w-[300px] flex flex-col" style={{ minHeight: '80vh' }}>
              <div className={cn('rounded-t-lg border-t-4 bg-card p-3 mb-2 h-16 flex items-center', col.color)}>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                    {col.etapa === 'honorario_vencido' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {col.label}
                  </h3>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {col.items.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-2 pb-8">
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
              </div>
            </div>
          ))}
        </div>
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
