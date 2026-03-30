import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface LancItem {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string | null;
  subcategoria: string | null;
}

interface Props {
  item: LancItem | null;
  onClose: () => void;
  onMarcarPago: (id: string) => void;
}

function statusBadge(status: string) {
  if (status === 'pago') return <Badge className="bg-green-100 text-green-800 border-green-300">PAGO</Badge>;
  if (status === 'atrasado') return <Badge className="bg-red-100 text-red-800 border-red-300">ATRASADO</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-300">PENDENTE</Badge>;
}

export default function FluxoItemDetalheModal({ item, onClose, onMarcarPago }: Props) {
  if (!item) return null;

  const d = new Date(item.data_vencimento + 'T12:00:00');
  const dataFmt = d.toLocaleDateString('pt-BR');

  return (
    <Dialog open={!!item} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="uppercase">{item.descricao}</DialogTitle>
          <DialogDescription>Detalhes do lançamento</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">VALOR</span>
            <span className="text-lg font-bold text-foreground">{fmt(item.valor)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">VENCIMENTO</span>
            <span className="text-sm font-medium text-foreground">{dataFmt}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">STATUS</span>
            {statusBadge(item.status)}
          </div>
          {item.categoria && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">CATEGORIA</span>
              <span className="text-sm font-medium text-foreground uppercase">{item.categoria}</span>
            </div>
          )}
          {item.subcategoria && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">SUBCATEGORIA</span>
              <span className="text-sm font-medium text-foreground uppercase">{item.subcategoria}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>FECHAR</Button>
          {item.status !== 'pago' && (
            <Button onClick={() => onMarcarPago(item.id)}>MARCAR COMO PAGO</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
