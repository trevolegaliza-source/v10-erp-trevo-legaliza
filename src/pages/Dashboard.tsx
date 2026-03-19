import { useState } from 'react';
import {
  ArrowUpRight, FileText, Users, DollarSign, AlertTriangle, TrendingUp, Clock, Filter,
  MoreHorizontal, Eye, Receipt, CheckCircle, Tag, EyeOff, BarChart3, CreditCard, Coins,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { KANBAN_STAGES, PROCESS_TYPE_LABELS } from '@/types/process';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardStats } from '@/hooks/useProcessos';
import { useClientes } from '@/hooks/useFinanceiro';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

type DashFilter = 'all' | 'sla' | 'urgentes';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: clientes } = useClientes();
  const navigate = useNavigate();
  const [filterClienteId, setFilterClienteId] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<DashFilter>('all');

  const filteredRecentes = filterClienteId === 'all'
    ? (stats?.recentes || [])
    : (stats?.recentes || []).filter(p => p.cliente_id === filterClienteId);

  const filteredUrgentes = filterClienteId === 'all'
    ? (stats?.urgentes || [])
    : (stats?.urgentes || []).filter(p => p.cliente_id === filterClienteId);

  const filteredSla = filterClienteId === 'all'
    ? (stats?.slaProximos || [])
    : (stats?.slaProximos || []).filter(p => p.cliente_id === filterClienteId);

  const filteredPipeline = stats?.pipelineCounts || {};
  const filteredPipelineValues = stats?.pipelineValues || {};
  const totalPipelineProcs = Object.values(filteredPipeline).reduce((s, n) => s + n, 0);

  // KPI click filter: show filtered list
  const displayList = activeFilter === 'sla'
    ? filteredUrgentes
    : activeFilter === 'urgentes'
      ? filteredUrgentes
      : filteredRecentes;

  const kpis = [
    {
      label: 'Processos Ativos',
      value: filterClienteId === 'all' ? (stats?.processosAtivos ?? 0) : filteredRecentes.length,
      icon: FileText,
      bgClass: 'bg-primary/10',
      iconClass: 'text-primary',
      onClick: () => navigate('/processos'),
    },
    {
      label: 'Clientes Ativos',
      value: stats?.totalClientes ?? 0,
      icon: Users,
      bgClass: 'bg-info/10',
      iconClass: 'text-info',
      onClick: () => navigate('/clientes'),
    },
    {
      label: 'Faturamento Mensal',
      value: null,
      icon: DollarSign,
      bgClass: 'bg-success/10',
      iconClass: 'text-success',
      customRender: true,
      onClick: () => navigate('/faturamento'),
    },
    {
      label: 'SLA em Risco',
      value: filteredUrgentes.length,
      icon: AlertTriangle,
      bgClass: 'bg-destructive/10',
      iconClass: 'text-destructive',
      onClick: () => setActiveFilter(prev => prev === 'sla' ? 'all' : 'sla'),
    },
  ];

  const formatCurrency = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleQuickAction = (action: string, procId: string) => {
    switch (action) {
      case 'abrir':
        navigate('/processos');
        break;
      case 'pago':
        toast.success('Ação: Marcar como Pago (implementar por processo)');
        break;
      case 'cobrado':
        toast.success('Ação: Marcar como Cobrado (implementar por processo)');
        break;
      case 'honorarios':
        toast.info('Ação: Adicionar honorários extras');
        break;
      case 'ocultar':
        toast.info('Processo ocultado da visualização');
        break;
      default:
        break;
    }
  };

  const pipelineStages = KANBAN_STAGES.filter(s => s.key !== 'finalizados' && s.key !== 'arquivo');
  const maxPipelineCount = Math.max(1, ...pipelineStages.map(s => filteredPipeline[s.key] || 0));

  const daysAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / 86400000);
  };

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

      {/* KPI Cards - all clickable */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <Card
            key={stat.label}
            className="border-border/60 card-hover cursor-pointer hover:border-primary/40"
            onClick={stat.onClick}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className={`rounded-lg ${stat.bgClass} p-2 w-fit`}>
                  <stat.icon className={`h-4.5 w-4.5 ${stat.iconClass}`} />
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="mt-3">
                {isLoading ? (
                  <Skeleton className="h-7 w-20" />
                ) : stat.customRender ? (
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stats?.faturamentoRealizado ?? 0)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                        Realizado
                      </span>
                      {(stats?.faturamentoPotencial ?? 0) > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning font-medium">
                          +{formatCurrency(stats?.faturamentoPotencial ?? 0)} potencial
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold">{stat.value}</p>
                )}
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className="border-border/60 border-l-4 border-l-warning card-hover cursor-pointer hover:border-primary/40"
          onClick={() => navigate('/financeiro')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-warning/10 p-2 w-fit">
                <CreditCard className="h-4.5 w-4.5 text-warning" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalCobrancasGerar ?? 0)}</p>
              )}
              <p className="text-xs text-muted-foreground">Cobranças a Gerar</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className="border-border/60 border-l-4 border-l-info card-hover cursor-pointer hover:border-primary/40"
          onClick={() => navigate('/financeiro')}
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-info/10 p-2 w-fit">
                <Coins className="h-4.5 w-4.5 text-info" />
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-3">
              {isLoading ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <p className="text-2xl font-bold">{formatCurrency(stats?.totalValoresReembolsaveis ?? 0)}</p>
              )}
              <p className="text-xs text-muted-foreground">Valores Reembolsáveis</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active filter indicator */}
      {activeFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <Badge className="bg-destructive/10 text-destructive border-0">
            Filtrando: {activeFilter === 'sla' ? 'SLA em Risco' : 'Urgentes'}
          </Badge>
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setActiveFilter('all')}>
            Limpar filtro
          </Button>
        </div>
      )}

      {/* Pipeline Funnel */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Pipeline de Processos
            {totalPipelineProcs > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-auto">{totalPipelineProcs} ativos</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {pipelineStages.map((stage) => {
                const count = filteredPipeline[stage.key] || 0;
                const stageValue = filteredPipelineValues[stage.key] || 0;
                const pct = (count / maxPipelineCount) * 100;
                return (
                  <div key={stage.key} className="text-center space-y-1.5 group/bar">
                    <p className="text-[9px] font-semibold text-primary opacity-0 group-hover/bar:opacity-100 transition-opacity">
                      {formatCurrency(stageValue)}
                    </p>
                    <div className="h-16 flex items-end justify-center">
                      <div
                        className="w-8 rounded-t bg-primary/80 transition-all duration-300 group-hover/bar:bg-primary group-hover/bar:shadow-[0_0_12px_hsl(var(--primary)/0.5)]"
                        style={{ height: `${Math.max(pct, 6)}%` }}
                      />
                    </div>
                    <p className="text-lg font-bold leading-none">{count}</p>
                    <p className="text-[9px] text-muted-foreground leading-tight truncate" title={stage.label}>
                      {stage.label}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Processes */}
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" />
              {activeFilter === 'sla' ? 'Processos com SLA em Risco' : 'Processos Recentes'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))
              ) : displayList.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {activeFilter !== 'all' ? 'Nenhum processo nesta categoria.' : 'Nenhum processo encontrado. Crie um no Cadastro Rápido.'}
                </p>
              ) : (
                displayList.map((proc) => (
                  <div
                    key={proc.id}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3 group cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate('/processos')}
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
                          Urgente
                        </Badge>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleQuickAction('abrir', proc.id)}>
                            <Eye className="h-3.5 w-3.5 mr-2" /> Abrir Processo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction('honorarios', proc.id)}>
                            <Receipt className="h-3.5 w-3.5 mr-2" /> Honorários Extras
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleQuickAction('pago', proc.id)}>
                            <CheckCircle className="h-3.5 w-3.5 mr-2" /> Marcar como Pago
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickAction('cobrado', proc.id)}>
                            <Tag className="h-3.5 w-3.5 mr-2" /> Marcar como Cobrado
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleQuickAction('ocultar', proc.id)} className="text-muted-foreground">
                            <EyeOff className="h-3.5 w-3.5 mr-2" /> Ocultar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right column: SLA + Ranking */}
        <div className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4 text-warning" />
                Alertas SLA
                {filteredUrgentes.length > 0 && (
                  <Badge className="text-[10px] bg-destructive/10 text-destructive border-0 ml-auto">
                    {filteredUrgentes.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {isLoading ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))
                ) : filteredUrgentes.length === 0 && filteredSla.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhum alerta</p>
                ) : (
                  <>
                    {filteredUrgentes.slice(0, 3).map((proc) => (
                      <div key={proc.id} className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                        <p className="text-sm font-medium">{proc.razao_social}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {proc.cliente?.nome || '-'} · {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                        </p>
                        {proc.responsavel && (
                          <p className="text-[11px] text-destructive mt-1 font-medium">
                            Responsável: {proc.responsavel}
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {!isLoading && filteredSla.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                      Mais Antigos (Próximos do Limite)
                    </p>
                    {filteredSla.map((proc) => (
                      <div
                        key={proc.id}
                        className="flex items-center justify-between py-2 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2"
                        onClick={() => navigate('/processos')}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{proc.razao_social}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0 border-warning/40 text-warning">
                          {daysAgo(proc.created_at)}d
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-primary" />
                Ranking de Clientes
                <span className="text-[10px] text-muted-foreground font-normal ml-auto">vol. financeiro/mês</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (stats?.topClientes || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {(stats?.topClientes || []).map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between py-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}.</span>
                        <span className="text-sm font-medium">{c.nome}</span>
                      </div>
                      <span className="text-sm font-semibold text-primary">{formatCurrency(c.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
