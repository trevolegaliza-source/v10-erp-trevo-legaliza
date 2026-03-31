import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstadosResumo } from '@/hooks/useInteligenciaGeografica';
import { UF_NOMES } from '@/constants/estados-brasil';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Users, Kanban, DollarSign, ChevronRight } from 'lucide-react';
import { MapaBrasilEnterprise, type EstadoData } from '@/components/mapa/MapaBrasilEnterprise';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function InteligenciaGeografica() {
  const navigate = useNavigate();
  const { data: estadoData, isLoading } = useEstadosResumo();

  const estadosComDados: EstadoData[] = useMemo(() => {
    if (!estadoData) return [];
    return Object.keys(UF_NOMES).map(uf => ({
      uf,
      nome: UF_NOMES[uf],
      clientes: estadoData[uf]?.qtdClientes || 0,
      processos: estadoData[uf]?.qtdProcessos || 0,
      receita: estadoData[uf]?.receita || 0,
    }));
  }, [estadoData]);

  const ranking = useMemo(() => {
    return estadosComDados.filter(e => e.clientes > 0).sort((a, b) => b.clientes - a.clientes);
  }, [estadosComDados]);

  const totals = useMemo(() => {
    if (!estadoData) return { clientes: 0, processos: 0, estados: 0, receita: 0 };
    const vals = Object.values(estadoData);
    return {
      clientes: vals.reduce((s, e) => s + e.qtdClientes, 0),
      processos: vals.reduce((s, e) => s + e.qtdProcessos, 0),
      estados: vals.filter(e => e.qtdClientes > 0).length,
      receita: vals.reduce((s, e) => s + e.receita, 0),
    };
  }, [estadoData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-80" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const kpis = [
    { label: 'Estados Ativos', valor: totals.estados, Icon: MapPin },
    { label: 'Clientes', valor: totals.clientes, Icon: Users },
    { label: 'Processos', valor: totals.processos, Icon: Kanban },
    { label: 'Receita', valor: fmt(totals.receita), Icon: DollarSign },
  ];

  return (
    <div className="geo-container p-6 rounded-xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#e6edf3' }}>
          <MapPin className="h-6 w-6 geo-accent" /> Inteligência Geográfica
        </h1>
        <p className="text-sm geo-muted">CRM Territorial — Clientes, órgãos e contatos por estado</p>
      </div>

      {/* KPIs — GREEN accents */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="geo-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <kpi.Icon className="h-4 w-4 geo-accent" />
              <span className="text-xs font-bold uppercase tracking-wider geo-muted">{kpi.label}</span>
            </div>
            <p className="text-2xl font-extrabold" style={{ color: '#e6edf3' }}>{kpi.valor}</p>
          </div>
        ))}
      </div>

      {/* Map + Ranking */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 lg:flex-[7]">
          <MapaBrasilEnterprise
            dadosEstados={estadosComDados}
            onEstadoClick={(uf) => navigate(`/inteligencia-geografica/${uf}`)}
          />
        </div>

        <div className="geo-card p-4 lg:flex-[3]">
          <h3 className="text-xs font-bold uppercase tracking-wider geo-accent mb-4">Ranking por Estado</h3>
          {ranking.length === 0 ? (
            <p className="text-sm geo-muted text-center py-4">Nenhum cliente cadastrado</p>
          ) : (
            <div className="space-y-1">
              {ranking.slice(0, 12).map((e, i) => (
                <div
                  key={e.uf}
                  className="flex items-center justify-between py-2 px-3 rounded-lg cursor-pointer transition-colors"
                  style={{ color: '#e6edf3' }}
                  onClick={() => navigate(`/inteligencia-geografica/${e.uf}`)}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = 'transparent')}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold geo-muted w-5">{i + 1}.</span>
                    <span className="font-bold text-sm">{e.uf}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="geo-muted">{e.clientes} cli</span>
                    <span className="geo-accent font-bold">{fmt(e.receita)}</span>
                    <ChevronRight className="h-3 w-3 geo-muted" />
                  </div>
                </div>
              ))}
              {ranking.length > 12 && (
                <p className="text-xs geo-muted text-center pt-2">+ {ranking.length - 12} estados</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
