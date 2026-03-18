import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useValoresAdicionais } from '@/hooks/useValoresAdicionais';
import { formatBRL } from '@/lib/pricing-engine';

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
  const rawBase = isUrgente ? baseValue / 1.5 : baseValue;
  const urgencyAddon = isUrgente ? rawBase * 0.5 : 0;
  const cliente = processo.cliente as any;

  const { data: valoresAdicionais = [] } = useValoresAdicionais(processo.id);
  const somaAdicionais = valoresAdicionais.reduce((s, i) => s + Number(i.valor), 0);
  const total = baseValue + somaAdicionais;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resumo de Fechamento</DialogTitle>
          <DialogDescription>
            Confirme os valores antes de gerar a cobrança para{' '}
            <span className="font-semibold text-foreground">
              {cliente?.apelido || processo.razao_social}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Valor Base do Processo</span>
            <span>{formatBRL(rawBase)}</span>
          </div>

          {/* Discount info */}
          {cliente?.desconto_progressivo > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-info">Desconto Progressivo ({cliente.desconto_progressivo}%)</span>
              <span className="text-info">Aplicado no cálculo</span>
            </div>
          )}

          {isUrgente && (
            <div className="flex justify-between text-sm">
              <span className="text-warning">Adicional de Urgência (+50%)</span>
              <span className="text-warning">{formatBRL(urgencyAddon)}</span>
            </div>
          )}

          {valoresAdicionais.length > 0 && (
            <>
              <Separator />
              <p className="text-xs font-semibold text-muted-foreground uppercase">Valores Adicionais</p>
              {valoresAdicionais.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.descricao}</span>
                  <span>{formatBRL(Number(item.valor))}</span>
                </div>
              ))}
            </>
          )}

          {cliente?.tipo === 'MENSALISTA' && (
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="text-[10px] border-info text-info">Mensalista</Badge>
              <span className="text-muted-foreground text-xs">
                Franquia: {cliente.qtd_processos ?? '—'} processos/mês
              </span>
            </div>
          )}

          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total Final a Cobrar</span>
            <span className="text-primary">{formatBRL(total)}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button size="sm" onClick={() => { onConfirm(); onOpenChange(false); }}>
            Confirmar e Gerar Cobrança
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
