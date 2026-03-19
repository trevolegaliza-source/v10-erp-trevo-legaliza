import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Clock, Receipt, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useFinanceiroDashboard } from '@/hooks/useFinanceiro';
import { useProcessosFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { Toggle } from '@/components/ui/toggle';
import FinanceiroKanban from '@/components/financeiro/FinanceiroKanban';
import FinanceiroList from '@/components/financeiro/FinanceiroList';
import { formatBRL } from '@/lib/pricing-engine';

export default function Financeiro() {
  const { data: stats, isLoading: loadingStats } = useFinanceiroDashboard();
  const { data: processos } = useProcessosFinanceiro();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  const items = processos || [];

  const kpis = [
    {
      label: 'Receita Prevista do Mês',
      value: stats?.receitaPrevistaMes || 0,
      icon: DollarSign,
      bgClass: 'bg-primary/10',
      iconClass: 'text-primary',
    },
    {
      label: 'A Receber em 7 dias',
      value: stats?.aReceber7dias || 0,
      icon: Clock,
      bgClass: 'bg-warning/10',
      iconClass: 'text-warning',
    },
    {
      label: 'Taxas a Reembolsar',
      value: stats?.taxasReembolsar || 0,
      icon: Receipt,
      bgClass: 'bg-info/10',
      iconClass: 'text-info',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Gestão visual de cobranças e honorários</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            <Toggle
              pressed={viewMode === 'kanban'}
              onPressedChange={() => setViewMode('kanban')}
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-7 px-2.5"
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Kanban</span>
            </Toggle>
            <Toggle
              pressed={viewMode === 'list'}
              onPressedChange={() => setViewMode('list')}
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground h-7 px-2.5"
            >
              <List className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Lista</span>
            </Toggle>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/contas-receber">Contas a Receber</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/contas-pagar">Contas a Pagar</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/60">
            <CardContent className="p-5">
              <div className={`rounded-lg ${kpi.bgClass} p-2 w-fit`}>
                <kpi.icon className={`h-4.5 w-4.5 ${kpi.iconClass}`} />
              </div>
              <p className="text-2xl font-bold mt-3">
                {loadingStats ? '...' : formatBRL(kpi.value)}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {viewMode === 'kanban' ? (
        <FinanceiroKanban processos={items} />
      ) : (
        <FinanceiroList processos={items} />
      )}
    </div>
  );
}
