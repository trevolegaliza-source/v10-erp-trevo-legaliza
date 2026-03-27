import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Send, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFinanceiroClientes } from '@/hooks/useFinanceiroClientes';
import { useFinanceiroDashboard } from '@/hooks/useFinanceiro';
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

export default function Financeiro() {
  const { clientes, metricas, isLoading } = useFinanceiroClientes();
  const { data: stats } = useFinanceiroDashboard();
  const [activeTab, setActiveTab] = useState('faturar');

  // Filter clients per tab
  const clientesFaturar = clientes.filter(c => c.qtd_sem_extrato > 0);
  const clientesEnviar = clientes.filter(c =>
    c.etapa_predominante === 'cobranca_gerada' && c.qtd_sem_extrato === 0
  );
  const clientesAguardando = clientes.filter(c =>
    c.etapa_predominante === 'cobranca_enviada'
  );
  const clientesRecebidos = clientes.filter(c =>
    c.etapa_predominante === 'honorario_pago'
  );
  const clientesVencidos = clientes.filter(c =>
    c.lancamentos.some(l => l.status === 'atrasado' || l.etapa_financeiro === 'honorario_vencido')
  );

  const totalRecebido = stats?.receitaPrevistaMes || 0;
  const totalFaturado = clientes.reduce((s, c) => s + c.total_faturado, 0) + totalRecebido;
  const taxaRecebimento = totalFaturado > 0 ? Math.round((totalRecebido / totalFaturado) * 100) : 0;

  const kpis = [
    {
      label: 'Gerar Extrato',
      value: `${metricas.aguardandoExtrato} clientes`,
      subValue: formatBRL(metricas.valorAguardandoExtrato),
      icon: FileText,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      tab: 'faturar',
    },
    {
      label: 'Enviar Cobrança',
      value: `${metricas.aguardandoEnvio} clientes`,
      subValue: formatBRL(metricas.valorAguardandoEnvio),
      icon: Send,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      tab: 'enviar',
    },
    {
      label: 'Aguardando Pagamento',
      value: `${metricas.aguardandoPagamento} clientes`,
      subValue: formatBRL(metricas.valorAguardandoPagamento),
      icon: Clock,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      tab: 'aguardando',
    },
    {
      label: 'Recebido no mês',
      value: formatBRL(totalRecebido),
      subValue: `${taxaRecebimento}% do faturado`,
      icon: CheckCircle,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      tab: 'recebidos',
    },
  ];

  const handleExportCSV = () => {
    if (clientes.length === 0) { toast.info('Sem dados para exportar'); return; }
    const rows = clientes.flatMap(c =>
      c.lancamentos.map(l => ({
        Cliente: c.cliente_apelido || c.cliente_nome,
        'Razão Social': l.processo_razao_social,
        Tipo: l.processo_tipo,
        Valor: formatBRLPlain(l.valor),
        Vencimento: formatDateBR(l.data_vencimento),
        Etapa: ETAPA_FINANCEIRO_LABELS[l.etapa_financeiro as keyof typeof ETAPA_FINANCEIRO_LABELS] || l.etapa_financeiro,
        Status: l.status,
      }))
    );
    downloadCSV(rows, `financeiro_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Relatório exportado!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">Gestão visual de cobranças e honorários</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground" onClick={handleExportCSV}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
          <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link to="/contas-receber">Contas a Receber</Link>
          </Button>
          <Button variant="outline" size="sm" className="text-muted-foreground hover:text-foreground" asChild>
            <Link to="/contas-pagar">Contas a Pagar</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(kpi => (
          <Card
            key={kpi.label}
            className="border-border/60 cursor-pointer hover:border-border transition-colors"
            onClick={() => setActiveTab(kpi.tab)}
          >
            <CardContent className="p-5">
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ) : (
                <>
                  <div className={`rounded-lg ${kpi.bgColor} p-2 w-fit`}>
                    <kpi.icon className={`h-4.5 w-4.5 ${kpi.color}`} />
                  </div>
                  <p className={`text-2xl font-bold mt-3 ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.subValue}</p>
                  <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide mt-1">{kpi.label}</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="faturar" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Gerar Extrato
            {metricas.aguardandoExtrato > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{metricas.aguardandoExtrato}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="enviar" className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Enviar
            {metricas.aguardandoEnvio > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{metricas.aguardandoEnvio}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="aguardando" className="gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Ag. Pagamento
            {metricas.aguardandoPagamento > 0 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 min-w-[18px]">{metricas.aguardandoPagamento}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="recebidos" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Recebidos
          </TabsTrigger>
          {metricas.vencidos > 0 && (
            <TabsTrigger value="vencidos" className="gap-1.5 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Vencidos
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 min-w-[18px]">{metricas.vencidos}</Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="faturar" className="mt-4">
          <ClientesFaturar clientes={clientesFaturar} />
        </TabsContent>
        <TabsContent value="enviar" className="mt-4">
          <ClientesEnviar clientes={clientesEnviar} />
        </TabsContent>
        <TabsContent value="aguardando" className="mt-4">
          <ClientesAguardando clientes={clientesAguardando} />
        </TabsContent>
        <TabsContent value="recebidos" className="mt-4">
          <ClientesRecebidos clientes={clientesRecebidos} />
        </TabsContent>
        <TabsContent value="vencidos" className="mt-4">
          <ClientesVencidos clientes={clientesVencidos} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
