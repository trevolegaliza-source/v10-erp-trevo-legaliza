import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';

interface GerarCobrancaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: ProcessoFinanceiro | null;
  onConfirm: () => void;
}

export default function GerarCobrancaModal({ open, onOpenChange, processo, onConfirm }: GerarCobrancaModalProps) {
  if (!processo) return null;

  const lanc = processo.lancamento;
  const baseValue = Number(lanc?.valor ?? processo.valor ?? 0);
  const isUrgente = processo.prioridade === 'urgente';
  // Base before urgency: if urgent, base = baseValue / 1.5
  const rawBase = isUrgente ? baseValue / 1.5 : baseValue;
  const urgencyAddon = isUrgente ? rawBase * 0.5 : 0;
  const extraHon = Number(lanc?.honorario_extra || 0);
  const total = baseValue + extraHon;

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resumo de Fechamento</DialogTitle>
          <DialogDescription>
            Confirme os valores antes de gerar a cobrança para{' '}
            <span className="font-semibold text-foreground">
              {(processo.cliente as any)?.apelido || processo.razao_social}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Base do Processo</span>
            <span>{fmt(rawBase)}</span>
          </div>
          {isUrgente && (
            <div className="flex justify-between text-sm">
              <span className="text-warning">Adicional de Urgência (+50%)</span>
              <span className="text-warning">{fmt(urgencyAddon)}</span>
            </div>
          )}
          {extraHon > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Honorários Extras / Reembolsos</span>
              <span>{fmt(extraHon)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total Final a Cobrar</span>
            <span className="text-primary">{fmt(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Confirmar e Gerar Cobrança
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
