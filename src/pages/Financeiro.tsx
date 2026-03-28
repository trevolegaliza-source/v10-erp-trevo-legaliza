import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Download, FileText, Send, Clock, CheckCircle, AlertTriangle, DollarSign, TrendingUp, Search, ChevronDown } from 'lucide-react';
import { useFinanceiroClientes, type LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
import {
  ClientesFaturar,
  ClientesEnviar,
  ClientesAguardando,
  ClientesRecebidos,
  ClientesVencidos,
} from '@/components/financeiro/ClienteAccordionFinanceiro';
import { formatBRL } from '@/lib/pricing-engine';
import { downloadCSV, formatBRLPlain, formatDateBR } from '@/lib/export-utils';
import { ETAPA_FINANCEIRO_LABELS } from '@/types/financial';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

type PeriodoPreset = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'custom';

function getPeriodoDates(preset: PeriodoPreset): { inicio: string; fim: string } {
  const now = new Date();
  switch (preset) {
    case 'este_mes':
      return { inicio: toISO(startOfMonth(now)), fim: toISO(endOfMonth(now)) };
    case 'mes_anterior': {
      const prev = subMonths(now, 1);
      return { inicio: toISO(startOfMonth(prev)), fim: toISO(endOfMonth(prev)) };
    }
    case 'ultimos_3': {
      const m3 = subMonths(now, 2);
      return { inicio: toISO(startOfMonth(m3)), fim: toISO(endOfMonth(now)) };
    }
    default:
      return { inicio: toISO(startOfMonth(now)), fim: toISO(endOfMonth(now)) };
  }
}

export default function Financeiro() {
  const [periodo, setPeriodo] = useState<PeriodoPreset>('este_mes');
  const [customInicio, setCustomInicio] = useState('');
  const [customFim, setCustomFim] = useState('');
  const [activeTab, setActiveTab] = useState('cobrar');
  const [searchTodos, setSearchTodos] = useState('');
  const [showFuturas, setShowFuturas] = useState(false);

  const dates = periodo === 'custom'
    ? { inicio: customInicio, fim: customFim }
    : getPeriodoDates(periodo);

  const {
    clientes,
    clientesCobrar,
    clientesFuturaFatura,
    clientesEnviados,
    clientesAguardando,
    clientesPagos,
    clientesVencidos,
    metricas,
    isLoading,
  } = useFinanceiroClientes(dates.inicio, dates.fim);

  const kpis = [
    {
      label: 'Faturado',
      value: formatBRL(metricas.totalFaturado),
      subValue: `${metricas.totalProcessos} processos`,
      icon: DollarSign,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    {
      label: 'Cobrado',
      value: formatBRL(metricas.totalCobrado),
      subValue: `${metricas.clientesCobrados} clientes`,
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Pendente',
      value: formatBRL(metricas.totalPendente),
      subValue: `${metricas.clientesPendentes} clientes`,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Recebido',
      value: formatBRL(metricas.totalRecebido),
      subValue: `${metricas.taxaRecebimento}% do faturado`,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  // Tab "Todos" - flat list
  const todosLancamentos = useMemo(() => {
    const all: Array<LancamentoFinanceiro & { cliente_nome: string; cliente_apelido: string | null }> = [];
    for (const c of clientes) {
      for (const l of c.lancamentos) {
        all.push({ ...l, cliente_nome: c.cliente_nome, cliente_apelido: c.cliente_apelido });
      }
    }
    if (searchTodos) {
      const q = searchTodos.toLowerCase();
      return all.filter(l =>
        (l.cliente_apelido || l.cliente_nome).toLowerCase().includes(q) ||
        l.processo_razao_social.toLowerCase().includes(q) ||
        l.descricao.toLowerCase().includes(q)
      );
    }
    return all;
  }, [clientes, searchTodos]);

  const handleExportCSV = () => {
    if (todosLancamentos.length === 0) { toast.info('Sem dados para exportar'); return; }
    const rows = todosLancamentos.map(l => ({
      Cliente: l.cliente_apelido || l.cliente_nome,
      'Razão Social': l.processo_razao_social,
      Tipo: l.processo_tipo,
      Valor: formatBRLPlain(l.valor),
      Vencimento: formatDateBR(l.data_vencimento),
      Etapa: ETAPA_FINANCEIRO_LABELS[l.etapa_financeiro as keyof typeof ETAPA_FINANCEIRO_LABELS] || l.etapa_financeiro,
      Status: l.status,
      Pagamento: formatDateBR(l.data_pagamento),
    }));
    downloadCSV(rows, `financeiro_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Relatório exportado!');
  };

  const periodoLabel = periodo === 'este_mes' ? 'Este Mês'
    : periodo === 'mes_anterior' ? 'Mês Anterior'
    : periodo === 'ultimos_3' ? 'Últimos 3 Meses'
    : 'Personalizado';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Centro de cobranças e recebimentos</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoPreset)}>
            <SelectTrigger className="w-40">
              <SelectValue>{periodoLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="este_mes">Este Mês</SelectItem>
              <SelectItem value="mes_anterior">Mês Anterior</SelectItem>
              <SelectItem value="ultimos_3">Últimos 3 Meses</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {periodo === 'custom' && (
            <div className="flex items-center gap-1">
              <Input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="w-36 h-9" />
              <span className="text-xs text-muted-foreground">a</span>
              <Input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="w-36 h-9" />
            </div>
          )}
          <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map(kpi => (
              <Card key={kpi.label} className="border-border/60">
                <CardContent className="p-5">
                  <div className={`rounded-lg ${kpi.bgColor} p-2 w-fit`}>
                    <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-3 ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.subValue}</p>
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-1">{kpi.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="cobrar" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Cobrar
                {clientesCobrar.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{clientesCobrar.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="enviados" className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Enviados
                {clientesEnviados.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{clientesEnviados.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="aguardando" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Ag. Pagamento
                {clientesAguardando.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{clientesAguardando.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pagos" className="gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Pagos
              </TabsTrigger>
              <TabsTrigger value="vencidos" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Vencidos
                {clientesVencidos.length > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px]">{clientesVencidos.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="todos" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Todos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="cobrar" className="mt-4">
              <ClientesFaturar clientes={clientesCobrar} />
              
              {clientesFuturaFatura.length > 0 && (
                <div className="mt-6">
                  <button
                    onClick={() => setShowFuturas(!showFuturas)}
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    {clientesFuturaFatura.length} cliente(s) com fatura futura
                    <ChevronDown className={`h-3 w-3 transition-transform ${showFuturas ? 'rotate-180' : ''}`} />
                  </button>

                  {showFuturas && (
                    <div className="mt-2 space-y-2 opacity-60">
                      {clientesFuturaFatura.map(c => {
                        const diaFatura = c.cliente_dia_vencimento_mensal || 0;
                        const diasAte = diaFatura - new Date().getDate();
                        return (
                          <div key={c.cliente_id} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-border/60">
                            <div>
                              <p className="text-sm font-medium">{c.cliente_apelido || c.cliente_nome}</p>
                              <p className="text-xs text-muted-foreground">
                                {c.qtd_sem_extrato} proc. · {formatBRL(c.total_faturado)} · Fatura dia {diaFatura}
                              </p>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {diasAte > 0 ? `Cobrar em ${diasAte} dias` : 'Próximo mês'}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
            <TabsContent value="enviados" className="mt-4">
              <ClientesEnviar clientes={clientesEnviados} />
            </TabsContent>
            <TabsContent value="aguardando" className="mt-4">
              <ClientesAguardando clientes={clientesAguardando} />
            </TabsContent>
            <TabsContent value="pagos" className="mt-4">
              <ClientesPagos clientes={clientesPagos} />
            </TabsContent>
            <TabsContent value="vencidos" className="mt-4">
              <ClientesVencidos clientes={clientesVencidos} />
            </TabsContent>
            <TabsContent value="todos" className="mt-4">
              <TabTodos
                lancamentos={todosLancamentos}
                search={searchTodos}
                onSearchChange={setSearchTodos}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ── Tab Pagos uses the existing component but we re-export for clarity
function ClientesPagos({ clientes }: { clientes: import('@/hooks/useFinanceiroClientes').ClienteFinanceiro[] }) {
  return <ClientesRecebidos clientes={clientes} />;
}

// ── Tab Todos: flat table
function TabTodos({ lancamentos, search, onSearchChange }: {
  lancamentos: Array<LancamentoFinanceiro & { cliente_nome: string; cliente_apelido: string | null }>;
  search: string;
  onSearchChange: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente ou processo..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <span className="text-xs text-muted-foreground">{lancamentos.length} lançamentos</span>
      </div>
      <div className="rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left p-3 font-medium">Cliente</th>
                <th className="text-left p-3 font-medium">Descrição</th>
                <th className="text-right p-3 font-medium">Valor</th>
                <th className="text-left p-3 font-medium">Vencimento</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {lancamentos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</td></tr>
              ) : lancamentos.map(l => {
                const isPago = l.status === 'pago';
                const hoje = new Date(); hoje.setHours(0,0,0,0);
                const venc = new Date(l.data_vencimento + 'T00:00:00');
                const isVenc = !isPago && venc < hoje;
                return (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-medium truncate max-w-[160px]">{l.cliente_apelido || l.cliente_nome}</td>
                    <td className="p-3 truncate max-w-[200px] text-muted-foreground">{l.processo_razao_social || l.descricao}</td>
                    <td className="p-3 text-right font-medium">{formatBRL(l.valor)}</td>
                    <td className="p-3">{formatDateBR(l.data_vencimento)}</td>
                    <td className="p-3">
                      {isPago ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">Pago</Badge>
                      ) : isVenc ? (
                        <Badge variant="destructive" className="text-xs">Vencido</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{formatDateBR(l.data_pagamento)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
