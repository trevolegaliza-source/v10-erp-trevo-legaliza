import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useLancamentosReceber, useValoresAdicionaisBatch } from '@/hooks/useContasReceber';
import type { LancamentoReceber } from '@/hooks/useContasReceber';
import PeriodoSelector from '@/components/contas-receber/PeriodoSelector';
import ContasReceberKPIs from '@/components/contas-receber/ContasReceberKPIs';
import AlertaInadimplencia from '@/components/contas-receber/AlertaInadimplencia';
import ClienteAccordion from '@/components/contas-receber/ClienteAccordion';
import ContasReceberLista from '@/components/contas-receber/ContasReceberLista';
import InadimplenciaTab from '@/components/contas-receber/InadimplenciaTab';

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

export default function ContasReceber() {
  const navigate = useNavigate();
  const now = new Date();
  const [dataInicio, setDataInicio] = useState(toISO(startOfMonth(now)));
  const [dataFim, setDataFim] = useState(toISO(endOfMonth(now)));
  const [activeTab, setActiveTab] = useState('clientes');

  const { data: lancamentos, isLoading } = useLancamentosReceber(dataInicio, dataFim);
  const processoIds = useMemo(() => (lancamentos || []).map(l => l.processo_id).filter(Boolean) as string[], [lancamentos]);
  const { data: taxasPorProcesso } = useValoresAdicionaisBatch(processoIds);

  const handlePeriodoChange = (inicio: string, fim: string) => {
    setDataInicio(inicio);
    setDataFim(fim);
  };

  // Group by client
  const clienteGroups = useMemo(() => {
    const map: Record<string, { clienteId: string; clienteNome: string; lancamentos: LancamentoReceber[] }> = {};
    (lancamentos || []).forEach(l => {
      const cid = l.cliente_id || 'sem-cliente';
      if (!map[cid]) map[cid] = { clienteId: cid, clienteNome: l.cliente?.nome || 'Sem cliente', lancamentos: [] };
      map[cid].lancamentos.push(l);
    });
    return Object.values(map);
  }, [lancamentos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">Consulta de faturamento, recebimentos e inadimplência</p>
        </div>
        <div className="flex items-center gap-3">
          <PeriodoSelector dataInicio={dataInicio} dataFim={dataFim} onChange={handlePeriodoChange} />
          <Button variant="outline" size="sm" onClick={() => navigate('/financeiro')}>
            <ArrowRight className="h-4 w-4 mr-1" />
            Ir para Cobranças
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <ContasReceberKPIs lancamentos={lancamentos || []} />

          {/* Alert bar */}
          <AlertaInadimplencia lancamentos={lancamentos || []} onVerClick={() => setActiveTab('inadimplencia')} />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="clientes">Por Cliente</TabsTrigger>
              <TabsTrigger value="lista">Lista Completa</TabsTrigger>
              <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
            </TabsList>

            <TabsContent value="clientes">
              <ClienteAccordion
                groups={clienteGroups}
                taxasPorProcesso={taxasPorProcesso || {}}
              />
            </TabsContent>

            <TabsContent value="lista">
              <ContasReceberLista
                lancamentos={lancamentos || []}
                taxasPorProcesso={taxasPorProcesso || {}}
              />
            </TabsContent>

            <TabsContent value="inadimplencia">
              <InadimplenciaTab
                lancamentos={lancamentos || []}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
