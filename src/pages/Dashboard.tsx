import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import SaudeFinanceiraKPIs from '@/components/dashboard/SaudeFinanceiraKPIs';
import AgendaSemana from '@/components/dashboard/AgendaSemana';
import ResultadoMes from '@/components/dashboard/ResultadoMes';
import Rankings from '@/components/dashboard/Rankings';
import InadimplenciaResumo from '@/components/dashboard/InadimplenciaResumo';
import ProcessosParados from '@/components/dashboard/ProcessosParados';
import ProvisaoResumo from '@/components/dashboard/ProvisaoResumo';
import MapaBrasil from '@/components/dashboard/MapaBrasil';
import {
  getSaudacao,
  getNomeUsuario,
  useLucroMensal,
  useLucroMesAnterior,
  useAReceberMes,
  useAPagarMes,
  useTicketMedio,
  useAgendaSemana,
  useInadimplenciaDashboard,
  useProcessosParados,
  useRankingFaturamento,
  useRankingVolume,
  useResultadoMes,
  useProvisaoDashboard,
} from '@/hooks/useDashboard';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Dashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const navMes = (dir: number) => {
    const d = new Date(ano, mes - 1 + dir, 1);
    setMes(d.getMonth() + 1);
    setAno(d.getFullYear());
  };

  // Queries
  const lucro = useLucroMensal(mes, ano);
  const lucroAnterior = useLucroMesAnterior(mes, ano);
  const aReceber = useAReceberMes(mes, ano);
  const aPagar = useAPagarMes(mes, ano);
  const ticket = useTicketMedio(mes, ano);
  const agenda = useAgendaSemana();
  const inadimplencia = useInadimplenciaDashboard();
  const parados = useProcessosParados();
  const rankFat = useRankingFaturamento(mes, ano);
  const rankVol = useRankingVolume(mes, ano);
  const resultado = useResultadoMes(mes, ano);
  const provisao = useProvisaoDashboard();

  const isLoading = lucro.isLoading || aReceber.isLoading || aPagar.isLoading || ticket.isLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getSaudacao()}, {getNomeUsuario(user?.email)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(now, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg px-2 py-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navMes(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
            {MESES[mes - 1]} {ano}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navMes(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <SaudeFinanceiraKPIs
        lucro={lucro.data}
        lucroAnterior={lucroAnterior.data}
        aReceber={aReceber.data}
        aPagar={aPagar.data}
        ticket={ticket.data}
        isLoading={isLoading}
      />

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left panel (60%) */}
        <div className="lg:col-span-3 space-y-6">
          <AgendaSemana
            pagar={agenda.data?.pagar || []}
            receber={agenda.data?.receber || []}
            isLoading={agenda.isLoading}
          />
          <ResultadoMes data={resultado.data} isLoading={resultado.isLoading} />
          <Rankings
            faturamento={rankFat.data}
            volume={rankVol.data}
            isLoading={rankFat.isLoading || rankVol.isLoading}
          />
        </div>

        {/* Right panel (40%) */}
        <div className="lg:col-span-2 space-y-6">
          <InadimplenciaResumo
            items={inadimplencia.data?.items || []}
            totalValor={inadimplencia.data?.totalValor || 0}
            isLoading={inadimplencia.isLoading}
          />
          <ProcessosParados
            items={parados.data || []}
            isLoading={parados.isLoading}
          />
          <ProvisaoResumo
            data={provisao.data}
            isLoading={provisao.isLoading}
          />
        </div>
      </div>
    </div>
  );
}
