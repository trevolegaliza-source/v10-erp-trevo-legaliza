import {
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockProcesses, mockClients } from '@/data/mock-data';
import { PROCESS_TYPE_LABELS } from '@/types/process';

const stats = [
  {
    label: 'Processos Ativos',
    value: '16',
    change: '+12%',
    trend: 'up' as const,
    icon: FileText,
  },
  {
    label: 'Clientes Ativos',
    value: '4',
    change: '+2',
    trend: 'up' as const,
    icon: Users,
  },
  {
    label: 'Faturamento Mensal',
    value: 'R$ 12.850',
    change: '+8,5%',
    trend: 'up' as const,
    icon: DollarSign,
  },
  {
    label: 'SLA em Risco',
    value: '3',
    change: '-1',
    trend: 'down' as const,
    icon: AlertTriangle,
  },
];

export default function Dashboard() {
  const recentProcesses = mockProcesses.slice(0, 6);
  const urgentProcesses = mockProcesses.filter((p) => p.priority === 'urgente');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da operação Trevo Legaliza</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2">
                  <stat.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    stat.trend === 'up' ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {stat.trend === 'up' ? (
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5" />
                  )}
                  {stat.change}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Processes */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              Processos Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentProcesses.map((proc) => (
                <div
                  key={proc.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{proc.company_name}</p>
                    <p className="text-xs text-muted-foreground">{proc.client_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-primary/30 text-primary"
                    >
                      {PROCESS_TYPE_LABELS[proc.process_type]}
                    </Badge>
                    {proc.priority === 'urgente' && (
                      <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">
                        Urgente
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-warning" />
              Alertas SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {urgentProcesses.map((proc) => (
                <div
                  key={proc.id}
                  className="rounded-lg border border-warning/20 bg-warning/5 p-3"
                >
                  <p className="text-sm font-medium">{proc.company_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {proc.client_name} · {PROCESS_TYPE_LABELS[proc.process_type]}
                  </p>
                  <p className="text-[11px] text-warning mt-1.5 font-medium">
                    Responsável: {proc.responsible}
                  </p>
                </div>
              ))}

              {/* Top clients */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">
                  Ranking de Clientes
                </p>
                {mockClients
                  .sort((a, b) => b.total_processes - a.total_processes)
                  .slice(0, 3)
                  .map((client, i) => (
                    <div key={client.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm">
                        <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                        {client.name}
                      </span>
                      <span className="text-xs font-medium text-primary">{client.total_processes} proc.</span>
                    </div>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
