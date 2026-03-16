import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, Receipt, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useFinanceiroDashboard, useLancamentos } from '@/hooks/useFinanceiro';
import { Badge } from '@/components/ui/badge';
import { STATUS_STYLES, STATUS_LABELS } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';

export default function Financeiro() {
  const { data: stats, isLoading: loadingStats } = useFinanceiroDashboard();
  const { data: recentLancamentos } = useLancamentos('receber');

  const recent = (recentLancamentos || []).slice(0, 5);

  const kpis = [
    {
      label: 'Receita Prevista do Mês',
      value: stats?.receitaPrevistaMes || 0,
      icon: DollarSign,
      color: 'primary',
    },
    {
      label: 'A Receber em 7 dias',
      value: stats?.aReceber7dias || 0,
      icon: Clock,
      color: 'warning',
    },
    {
      label: 'Taxas a Reembolsar',
      value: stats?.taxasReembolsar || 0,
      icon: Receipt,
      color: 'info',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Dashboard de controladoria</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/contas-receber">Contas a Receber</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/contas-pagar">Contas a Pagar</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/60">
            <CardContent className="p-5">
              <div className={`rounded-lg bg-${kpi.color}/10 p-2 w-fit`}>
                <kpi.icon className={`h-4.5 w-4.5 text-${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold mt-3">
                {loadingStats ? '...' : kpi.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent entries */}
      <Card className="border-border/60">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Últimos Lançamentos a Receber
          </CardTitle>
          <Button variant="ghost" size="sm" className="text-xs" asChild>
            <Link to="/contas-receber">
              Ver todos <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {(l as any).cliente?.nome || '-'} · Venc: {new Date(l.data_vencimento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">
                    {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                    {STATUS_LABELS[l.status as StatusFinanceiro]}
                  </Badge>
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum lançamento encontrado. Execute o SQL schema no Supabase para começar.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
