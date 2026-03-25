import { Card, CardContent } from '@/components/ui/card';
import { DollarSign, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface KPIProps {
  totalPrevisto: number;
  totalPago: number;
  totalPendente: number;
  totalVencido: number;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ContasPagarKPIs({ totalPrevisto, totalPago, totalPendente, totalVencido }: KPIProps) {
  const cards = [
    { label: 'Total Previsto', value: totalPrevisto, Icon: DollarSign, color: 'text-destructive' },
    { label: 'Pago', value: totalPago, Icon: CheckCircle, color: 'text-primary' },
    { label: 'Pendente', value: totalPendente, Icon: Clock, color: 'text-warning' },
    { label: 'Vencido', value: totalVencido, Icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(c => (
        <Card key={c.label} className="bg-sidebar-background border-sidebar-border">
          <CardContent className="p-5 flex items-start gap-4">
            <div className={`rounded-lg bg-background/10 p-2.5 ${c.color}`}>
              <c.Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-sidebar-foreground">{fmt(c.value)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
