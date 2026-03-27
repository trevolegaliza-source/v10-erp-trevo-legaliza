import { useState, useMemo } from 'react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLancamentosReceber, useValoresAdicionaisBatch } from '@/hooks/useContasReceber';
import type { LancamentoReceber } from '@/hooks/useContasReceber';
import PeriodoSelector from '@/components/contas-receber/PeriodoSelector';
import ContasReceberKPIs from '@/components/contas-receber/ContasReceberKPIs';
import AlertaInadimplencia from '@/components/contas-receber/AlertaInadimplencia';
import ClienteAccordion from '@/components/contas-receber/ClienteAccordion';
import ContasReceberLista from '@/components/contas-receber/ContasReceberLista';
import InadimplenciaTab from '@/components/contas-receber/InadimplenciaTab';
import MarcarRecebidoModal from '@/components/contas-receber/MarcarRecebidoModal';
import RegistrarContatoModal from '@/components/contas-receber/RegistrarContatoModal';
import ReenviarCobrancaModal from '@/components/contas-receber/ReenviarCobrancaModal';

function toISO(d: Date) { return d.toISOString().split('T')[0]; }

export default function ContasReceber() {
  const now = new Date();
  const [dataInicio, setDataInicio] = useState(toISO(startOfMonth(now)));
  const [dataFim, setDataFim] = useState(toISO(endOfMonth(now)));
  const [activeTab, setActiveTab] = useState('clientes');

  const { data: lancamentos, isLoading } = useLancamentosReceber(dataInicio, dataFim);
  const processoIds = useMemo(() => (lancamentos || []).map(l => l.processo_id).filter(Boolean) as string[], [lancamentos]);
  const { data: taxasPorProcesso } = useValoresAdicionaisBatch(processoIds);

  // Modals
  const [marcarPagoTarget, setMarcarPagoTarget] = useState<LancamentoReceber | null>(null);
  const [contatoTarget, setContatoTarget] = useState<LancamentoReceber | null>(null);
  const [cobrancaTarget, setCobrancaTarget] = useState<LancamentoReceber | null>(null);

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
          <p className="text-sm text-muted-foreground">Faturamento, recebimentos e inadimplência</p>
        </div>
        <PeriodoSelector dataInicio={dataInicio} dataFim={dataFim} onChange={handlePeriodoChange} />
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
              <TabsTrigger value="sem_extrato">Sem Extrato</TabsTrigger>
              <TabsTrigger value="lista">Lista Completa</TabsTrigger>
              <TabsTrigger value="inadimplencia">Inadimplência</TabsTrigger>
            </TabsList>

            <TabsContent value="clientes">
              <ClienteAccordion
                groups={clienteGroups}
                taxasPorProcesso={taxasPorProcesso || {}}
                onMarcarPago={setMarcarPagoTarget}
                onCobrar={setCobrancaTarget}
              />
            </TabsContent>

            <TabsContent value="sem_extrato">
              <ClienteAccordion
                groups={clienteGroups.filter(g =>
                  g.lancamentos.some(l => l.status === 'pendente' && !(l as any).extrato_id)
                )}
                taxasPorProcesso={taxasPorProcesso || {}}
                onMarcarPago={setMarcarPagoTarget}
                onCobrar={setCobrancaTarget}
              />
            </TabsContent>

            <TabsContent value="lista">
              <ContasReceberLista
                lancamentos={lancamentos || []}
                taxasPorProcesso={taxasPorProcesso || {}}
                onMarcarPago={setMarcarPagoTarget}
                onCobrar={setCobrancaTarget}
              />
            </TabsContent>

            <TabsContent value="inadimplencia">
              <InadimplenciaTab
                lancamentos={lancamentos || []}
                onMarcarPago={setMarcarPagoTarget}
                onRegistrarContato={setContatoTarget}
                onReenviarCobranca={setCobrancaTarget}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Modals */}
      <MarcarRecebidoModal lancamento={marcarPagoTarget} open={!!marcarPagoTarget} onOpenChange={v => !v && setMarcarPagoTarget(null)} />
      <RegistrarContatoModal lancamento={contatoTarget} open={!!contatoTarget} onOpenChange={v => !v && setContatoTarget(null)} />
      <ReenviarCobrancaModal lancamento={cobrancaTarget} open={!!cobrancaTarget} onOpenChange={v => !v && setCobrancaTarget(null)} />
    </div>
  );
}
