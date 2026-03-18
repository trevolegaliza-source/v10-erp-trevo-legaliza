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
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: clientes } = useClientes();
  const navigate = useNavigate();
  const [filterClienteId, setFilterClienteId] = useState<string>('all');

  const filteredRecentes = filterClienteId === 'all'
    ? (stats?.recentes || [])
    : (stats?.recentes || []).filter(p => p.cliente_id === filterClienteId);

  const filteredUrgentes = filterClienteId === 'all'
    ? (stats?.urgentes || [])
    : (stats?.urgentes || []).filter(p => p.cliente_id === filterClienteId);

  const filteredSla = filterClienteId === 'all'
    ? (stats?.slaProximos || [])
    : (stats?.slaProximos || []).filter(p => p.cliente_id === filterClienteId);

  const filteredPipeline = filterClienteId === 'all'
    ? (stats?.pipelineCounts || {})
    : (() => {
        // When filtered, we can't easily recompute — show unfiltered with note
        return stats?.pipelineCounts || {};
      })();

  const totalPipelineProcs = Object.values(filteredPipeline).reduce((s, n) => s + n, 0);

  const kpis = [
    {
      label: 'Processos Ativos',
      value: filterClienteId === 'all' ? (stats?.processosAtivos ?? 0) : filteredRecentes.length,
      icon: FileText,
      clickable: true,
      href: '/processos-ativos',
    },
    { label: 'Clientes Ativos', value: stats?.totalClientes ?? 0, icon: Users },
    {
      label: 'Faturamento Mensal',
      value: null, // custom render
      icon: DollarSign,
      clickable: true,
      href: '/faturamento',
      customRender: true,
    },
    { label: 'SLA em Risco', value: filteredUrgentes.length, icon: AlertTriangle },
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

  // Pipeline stages to show (grouped for readability)
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

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <Card
            key={stat.label}
            className={`border-border/60 card-hover ${stat.clickable ? 'cursor-pointer hover:border-primary/40' : ''}`}
            onClick={() => stat.clickable && stat.href && navigate(stat.href)}
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="rounded-lg bg-primary/10 p-2 w-fit">
                  <stat.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                {stat.clickable && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
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
        <Card className="border-border/60 border-l-4 border-l-warning card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-warning/10 p-2 w-fit">
                <CreditCard className="h-4.5 w-4.5 text-warning" />
              </div>
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
        <Card className="border-border/60 border-l-4 border-l-info card-hover">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="rounded-lg bg-info/10 p-2 w-fit">
                <Coins className="h-4.5 w-4.5 text-info" />
              </div>
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
                const pct = (count / maxPipelineCount) * 100;
                return (
                  <div key={stage.key} className="text-center space-y-1.5">
                    <div className="h-16 flex items-end justify-center">
                      <div
                        className="w-8 rounded-t bg-primary/80 transition-all duration-300"
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
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3 group"
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
          {/* SLA Alerts with proximity list */}
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

                {/* SLA Proximity */}
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

          {/* Ranking by financial volume */}
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
                <p className="text-xs text-muted-foreground text-center py-4">Sem dados financeiros este mês</p>
              ) : (
                <div className="space-y-2.5">
                  {(stats?.topClientes || []).map((client, i) => {
                    const maxVal = stats?.topClientes?.[0]?.total || 1;
                    const pct = (client.total / maxVal) * 100;
                    return (
                      <div key={client.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm">
                            <span className="text-muted-foreground mr-1.5 font-mono text-xs">{i + 1}.</span>
                            {client.nome}
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {formatCurrency(client.total)}
                          </span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
