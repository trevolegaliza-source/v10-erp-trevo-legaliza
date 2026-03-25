import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRegistrarRecarga } from '@/hooks/usePrepagoMovimentacoes';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  saldoAtual: number;
  onSuccess?: () => void;
}

export default function RecargaModal({ open, onOpenChange, clienteId, clienteNome, saldoAtual, onSuccess }: Props) {
  const [valor, setValor] = useState('');
  const [observacao, setObservacao] = useState('');
  const recarga = useRegistrarRecarga();
  const valorNum = Number(valor) || 0;
  const novoSaldo = saldoAtual + valorNum;

  const handleConfirm = async () => {
    if (valorNum <= 0) return;
    await recarga.mutateAsync({
      clienteId,
      valor: valorNum,
      saldoAtual,
      nomeCliente: clienteNome,
      observacao: observacao || undefined,
    });
    setValor('');
    setObservacao('');
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Recarga — Pré-Pago</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Cliente: <span className="font-medium text-foreground">{clienteNome}</span></p>
            <p className="text-sm text-muted-foreground">Saldo atual: <span className="font-medium text-foreground">{fmt(saldoAtual)}</span></p>
          </div>
          <div className="space-y-2">
            <Label>Valor da recarga *</Label>
            <Input type="number" step="0.01" min="0" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea placeholder="Opcional..." value={observacao} onChange={e => setObservacao(e.target.value)} rows={2} />
          </div>
          {valorNum > 0 && (
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-sm font-medium">Novo saldo: <span className="text-success">{fmt(novoSaldo)}</span></p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={valorNum <= 0 || recarga.isPending}>
            {recarga.isPending ? 'Processando...' : 'Confirmar Recarga'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
