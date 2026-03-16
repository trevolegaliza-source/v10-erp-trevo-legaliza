import { useState } from 'react';
import {
  ArrowUpRight,
  FileText,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROCESS_TYPE_LABELS } from '@/types/process';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/hooks/useProcessos';
import { useClientes } from '@/hooks/useFinanceiro';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: clientes } = useClientes();
  const [filterClienteId, setFilterClienteId] = useState<string>('all');

  // Filter data by selected client
  const filteredRecentes = filterClienteId === 'all'
    ? (stats?.recentes || [])
    : (stats?.recentes || []).filter(p => p.cliente_id === filterClienteId);

  const filteredUrgentes = filterClienteId === 'all'
    ? (stats?.urgentes || [])
    : (stats?.urgentes || []).filter(p => p.cliente_id === filterClienteId);

  const kpis = [
    {
      label: 'Processos Ativos',
      value: filterClienteId === 'all' ? (stats?.processosAtivos ?? 0) : filteredRecentes.length,
      icon: FileText,
    },
    {
      label: 'Clientes Ativos',
      value: stats?.totalClientes ?? 0,
      icon: Users,
    },
    {
      label: 'Faturamento Mensal',
      value: (stats?.faturamentoMes ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      icon: DollarSign,
    },
    {
      label: 'SLA em Risco',
      value: filteredUrgentes.length,
      icon: AlertTriangle,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral da operação Trevo Legaliza</p>
        </div>
        <Select value={filterClienteId} onValueChange={setFilterClienteId}>
          <SelectTrigger className="w-56 h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            <SelectValue placeholder="Filtrar por contabilidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Contabilidades</SelectItem>
            {(clientes || []).map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.apelido || c.nome} {c.nome_contador ? `(${c.nome_contador})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="rounded-lg bg-primary/10 p-2 w-fit">
                <stat.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
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
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))
              ) : filteredRecentes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum processo encontrado. Crie um no Cadastro Rápido.
                </p>
              ) : (
                filteredRecentes.map((proc) => (
                  <div
                    key={proc.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{proc.razao_social}</p>
                      <p className="text-xs text-muted-foreground">{proc.cliente?.nome || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                      </Badge>
                      {proc.prioridade === 'urgente' && (
                        <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">
                          Urgente (+50%)
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts + Top Clients */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-warning" />
              Alertas SLA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))
              ) : filteredUrgentes.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
              ) : (
                filteredUrgentes.map((proc) => (
                  <div key={proc.id} className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <p className="text-sm font-medium">{proc.razao_social}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {proc.cliente?.nome || '-'} · {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                    </p>
                    {proc.responsavel && (
                      <p className="text-[11px] text-warning mt-1.5 font-medium">
                        Responsável: {proc.responsavel}
                      </p>
                    )}
                  </div>
                ))
              )}

              {/* Top clients */}
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2.5 uppercase tracking-wider">
                  Ranking de Clientes
                </p>
                {isLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (stats?.topClientes || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem dados</p>
                ) : (
                  (stats?.topClientes || []).map((client, i) => (
                    <div key={client.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm">
                        <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                        {client.nome}
                      </span>
                      <span className="text-xs font-medium text-primary">{client.total} proc.</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
