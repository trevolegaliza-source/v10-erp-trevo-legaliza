import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CATEGORIAS_DESPESAS } from '@/constants/categorias-despesas';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

type Urgencia = 'atrasado' | 'urgente' | 'normal';

interface LancamentoDetalhe {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string | null;
  subcategoria: string | null;
  colaborador_id: string | null;
  urgencia: Urgencia;
}

function getUrgencia(dataVenc: string): Urgencia {
  const hoje = new Date().toISOString().split('T')[0];
  const em7 = new Date();
  em7.setDate(em7.getDate() + 7);
  const em7Str = em7.toISOString().split('T')[0];

  if (dataVenc < hoje) return 'atrasado';
  if (dataVenc <= em7Str) return 'urgente';
  return 'normal';
}

const URGENCIA_COLORS: Record<Urgencia, string> = {
  atrasado: '#EF4444',
  urgente: '#F59E0B',
  normal: '#E2E8F0',
};

function getCategoriaLabel(cat: string | null) {
  if (!cat) return null;
  const found = CATEGORIAS_DESPESAS[cat as keyof typeof CATEGORIAS_DESPESAS];
  return found?.label || cat;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function FluxoDetalheModal({ open, onClose }: Props) {
  const { data: items = [] } = useQuery<LancamentoDetalhe[]>({
    queryKey: ['fluxo_detalhe_15dias'],
    enabled: open,
    queryFn: async () => {
      const hoje = new Date();
      const em15 = new Date(hoje);
      em15.setDate(em15.getDate() + 15);
      const hojeStr = hoje.toISOString().split('T')[0];
      const em15Str = em15.toISOString().split('T')[0];

      const { data: rows } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, data_vencimento, status, categoria, subcategoria, colaborador_id')
        .eq('tipo', 'pagar')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', em15Str)
        .order('data_vencimento', { ascending: true });

      return (rows || []).map(r => ({
        ...r,
        valor: Number(r.valor),
        urgencia: getUrgencia(r.data_vencimento),
      }));
    },
  });

  const total = items.reduce((s, i) => s + i.valor, 0);

  // Group by date
  const grouped = items.reduce<Record<string, LancamentoDetalhe[]>>((acc, item) => {
    const key = item.data_vencimento;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Compromissos dos Próximos 15 Dias</DialogTitle>
          <DialogDescription>
            {items.length} despesa{items.length !== 1 ? 's' : ''} · Total: {fmt(total)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {sortedDates.map(dateStr => {
            const d = new Date(dateStr + 'T12:00:00');
            const diaSemana = DIAS_SEMANA[d.getDay()];
            const label = `${diaSemana}, ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;

            return (
              <div key={dateStr}>
                <div className="flex items-center gap-2 my-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{label}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                {grouped[dateStr].map(item => (
                  <div key={item.id} className="flex items-start gap-3 py-2 px-2 rounded-md hover:bg-muted/40">
                    {/* Urgency bar */}
                    <div
                      className="w-1 min-h-[40px] rounded-full flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: URGENCIA_COLORS[item.urgencia] }}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{item.descricao}</span>
                        <span className="text-sm font-semibold text-foreground whitespace-nowrap">{fmt(item.valor)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {item.categoria && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {getCategoriaLabel(item.categoria)}
                          </Badge>
                        )}
                        {item.subcategoria && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.subcategoria}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum compromisso nos próximos 15 dias.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
