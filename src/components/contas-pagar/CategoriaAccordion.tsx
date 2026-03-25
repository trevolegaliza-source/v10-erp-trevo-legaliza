import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pencil, CheckCircle } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import * as LucideIcons from 'lucide-react';

interface Props {
  lancamentos: any[];
  onEdit: (l: any) => void;
  onMarcarPago: (l: any) => void;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getStatusBadge(l: any) {
  const hoje = new Date().toISOString().split('T')[0];
  if (l.status === 'pago') return <Badge className="bg-primary/15 text-primary border-0 text-[10px]">Pago</Badge>;
  if (l.status === 'pendente' && l.data_vencimento < hoje) return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente</Badge>;
}

export default function CategoriaAccordion({ lancamentos, onEdit, onMarcarPago }: Props) {
  const categorias = Object.entries(CATEGORIAS_DESPESAS) as [CategoriaKey, typeof CATEGORIAS_DESPESAS[CategoriaKey]][];

  const grouped = categorias.map(([key, cat]) => {
    const items = lancamentos.filter(l => (l.categoria || 'outros') === key);
    const total = items.reduce((s: number, l: any) => s + Number(l.valor), 0);
    return { key, cat, items, total };
  });

  return (
    <Accordion type="multiple" className="space-y-2">
      {grouped.map(({ key, cat, items, total }) => {
        const IconComp = (LucideIcons as any)[cat.icon] || LucideIcons.Circle;
        const hasItems = items.length > 0;

        return (
          <AccordionItem
            key={key}
            value={key}
            className={`border rounded-lg overflow-hidden ${!hasItems ? 'opacity-50' : ''}`}
            style={{ borderLeftWidth: '4px', borderLeftColor: cat.color }}
          >
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3 w-full">
                <IconComp className="h-4 w-4 shrink-0" style={{ color: cat.color }} />
                <span className="font-semibold text-sm text-foreground">{cat.label}</span>
                <span className="ml-auto mr-3 font-bold text-sm" style={{ color: cat.color }}>{fmt(total)}</span>
                <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">Nenhuma despesa nesta categoria</p>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((l: any) => (
                    <div key={l.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{l.subcategoria || l.descricao}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.fornecedor && `${l.fornecedor} • `}
                          {new Date(l.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <span className="font-bold text-sm text-foreground whitespace-nowrap">{fmt(Number(l.valor))}</span>
                      {getStatusBadge(l)}
                      <div className="flex gap-1">
                        {l.status === 'pendente' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMarcarPago(l)}>
                            <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
