import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEstadosResumo } from '@/hooks/useInteligenciaGeografica';
import { UF_NOMES } from '@/constants/estados-brasil';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Users, Kanban, DollarSign, ChevronRight } from 'lucide-react';
import BrazilSVG from '@/assets/brazil-map';
import { useState } from 'react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getCorEstado(qtd: number): string {
  if (qtd === 0) return 'hsl(var(--muted))';
  if (qtd <= 2) return '#bbf7d0';
  if (qtd <= 5) return '#4ade80';
  if (qtd <= 10) return '#22c55e';
  return '#15803d';
}

export default function InteligenciaGeografica() {
  const navigate = useNavigate();
  const { data: estadoData, isLoading } = useEstadosResumo();
  const [tooltip, setTooltip] = useState<{ uf: string; x: number; y: number } | null>(null);

  const ranking = useMemo(() => {
    if (!estadoData) return [];
    return Object.values(estadoData)
      .sort((a, b) => b.qtdClientes - a.qtdClientes)
      .filter(e => e.qtdClientes > 0);
  }, [estadoData]);

  const totals = useMemo(() => {
    if (!estadoData) return { clientes: 0, processos: 0, estados: 0 };
    const vals = Object.values(estadoData);
    return {
      clientes: vals.reduce((s, e) => s + e.qtdClientes, 0),
      processos: vals.reduce((s, e) => s + e.qtdProcessos, 0),
      estados: vals.filter(e => e.qtdClientes > 0).length,
    };
  }, [estadoData]);

  const colors = useMemo(() => {
    const c: Record<string, string> = {};
    Object.keys(UF_NOMES).forEach(uf => {
      c[uf] = getCorEstado(estadoData?.[uf]?.qtdClientes || 0);
    });
    return c;
  }, [estadoData]);

  const handleMouseEnter = (uf: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as SVGElement).closest('svg')?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ uf, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-80" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" /> Inteligência Geográfica
        </h1>
        <p className="text-sm text-muted-foreground">CRM Territorial — Clientes, órgãos e contatos por estado</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Estados ativos</span>
          </div>
          <p className="text-2xl font-bold">{totals.estados}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Clientes</span>
          </div>
          <p className="text-2xl font-bold">{totals.clientes}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Kanban className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Processos</span>
          </div>
          <p className="text-2xl font-bold">{totals.processos}</p>
        </Card>
      </div>

      {/* Map + Ranking */}
      <div className="flex flex-col lg:flex-row gap-6">
        <Card className="flex-1 lg:flex-[7] p-4">
          <div className="relative">
            <BrazilSVG
              colors={colors}
              onStateMouseEnter={handleMouseEnter}
              onStateMouseLeave={() => setTooltip(null)}
              onStateClick={(uf) => navigate(`/inteligencia-geografica/${uf}`)}
            />
            {tooltip && estadoData && (
              <div
                className="absolute z-50 pointer-events-none px-3 py-2 rounded-lg border bg-popover text-popover-foreground shadow-md text-sm"
                style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
              >
                <p className="font-semibold">{UF_NOMES[tooltip.uf]} ({tooltip.uf})</p>
                <p className="text-xs text-muted-foreground">
                  {estadoData[tooltip.uf]?.qtdClientes || 0} clientes · {estadoData[tooltip.uf]?.qtdProcessos || 0} processos
                </p>
                <p className="text-xs text-muted-foreground">
                  {fmt(estadoData[tooltip.uf]?.receita || 0)}
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:flex-[3] p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Ranking por estado</h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente cadastrado</p>
          ) : (
            <div className="space-y-2">
              {ranking.slice(0, 10).map((e, i) => (
                <div
                  key={e.uf}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                  onClick={() => navigate(`/inteligencia-geografica/${e.uf}`)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium">{e.uf}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{e.qtdClientes} cli</span>
                    <span className="font-medium text-foreground">{fmt(e.receita)}</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </div>
              ))}
              {ranking.length > 10 && (
                <p className="text-xs text-muted-foreground text-center pt-2">+ {ranking.length - 10} estados</p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 items-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Legenda:</span>
        {[
          { label: '10+', color: '#15803d' },
          { label: '6-10', color: '#22c55e' },
          { label: '3-5', color: '#4ade80' },
          { label: '1-2', color: '#bbf7d0' },
          { label: '0', color: 'hsl(var(--muted))' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm border border-border/40" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
