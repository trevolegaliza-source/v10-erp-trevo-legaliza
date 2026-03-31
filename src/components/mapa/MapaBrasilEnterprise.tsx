import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import { geoCache } from '@/lib/geo-cache';

export interface EstadoData {
  uf: string;
  nome: string;
  clientes: number;
  receita: number;
  processos: number;
}

export type HoverCallback = (uf: string | null) => void;

interface Props {
  dadosEstados: EstadoData[];
  onHover?: HoverCallback;
}

const UF_NOMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas',
  BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo',
  GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

function getUfFromFeature(d: any): string {
  return d.properties?.sigla || d.properties?.UF || d.properties?.uf || '';
}

const GREEN_BRIGHT = '#22c55e';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MapaBrasilEnterprise({ dadosEstados, onHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const onHoverRef = useRef(onHover);
  const navigate = useNavigate();

  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);

  // Clean up old sessionStorage keys that may have filled quota
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('brasil_geo') || key.startsWith('mun_geo'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_) { /* ignore */ }
  }, []);

  // Load GeoJSON once (in-memory cache)
  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const cached = geoCache.get('brasil_estados');
        if (cached) { setGeoData(cached); setLoading(false); return; }
        const res = await fetch(
          'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson'
        );
        const data = await res.json();
        geoCache.set('brasil_estados', data);
        setGeoData(data);
      } catch (err) { console.error('Erro ao carregar GeoJSON:', err); }
      finally { setLoading(false); }
    };
    fetchGeo();
  }, []);

  // Render map
  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = 520;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const padding = 40;
    const projection = d3.geoMercator()
      .fitExtent([[padding, padding], [width - padding, height - padding]], geoData);
    const pathGen = d3.geoPath().projection(projection);

    // Glow filter
    const defs = svg.append('defs');
    const makeGlow = (id: string, stdDev: number) => {
      const f = defs.append('filter').attr('id', id)
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      f.append('feGaussianBlur').attr('stdDeviation', stdDev).attr('result', 'blur');
      const m = f.append('feMerge');
      m.append('feMergeNode').attr('in', 'blur');
      m.append('feMergeNode').attr('in', 'SourceGraphic');
    };
    makeGlow('glow-hover', 6);
    makeGlow('glow-active', 3);

    const g = svg.append('g');

    const getColor = (uf: string): string => {
      const e = dadosEstados.find(d => d.uf === uf);
      if (!e || e.clientes === 0) return '#161b22';
      if (e.clientes >= 10) return GREEN_BRIGHT;
      if (e.clientes >= 6) return '#16a34a';
      if (e.clientes >= 3) return '#15803d';
      return '#14532d';
    };

    // States
    g.selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', pathGen as any)
      .attr('fill', (d: any) => getColor(getUfFromFeature(d)))
      .attr('stroke', '#30363d')
      .attr('stroke-width', 0.5)
      .attr('cursor', 'pointer')
      .attr('filter', (d: any) => {
        const e = dadosEstados.find(dd => dd.uf === getUfFromFeature(d));
        return e && e.clientes > 0 ? 'url(#glow-active)' : 'none';
      })
      .on('mouseover', function (event: any, d: any) {
        const uf = getUfFromFeature(d);
        const dados = dadosEstados.find(dd => dd.uf === uf);
        d3.select(this)
          .attr('fill', GREEN_BRIGHT)
          .attr('stroke', GREEN_BRIGHT)
          .attr('stroke-width', 2)
          .attr('filter', 'url(#glow-hover)');

        if (onHoverRef.current) onHoverRef.current(uf);

        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
          tooltipRef.current.innerHTML = `
            <div style="font-size:14px;font-weight:800;color:${GREEN_BRIGHT};margin-bottom:6px">${UF_NOMES[uf] || uf}</div>
            <div style="font-size:11px;color:#8b949e;line-height:2">
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Clientes</span><span style="color:#e6edf3;font-weight:700">${dados?.clientes || 0}</span></div>
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Processos</span><span style="color:#e6edf3;font-weight:700">${dados?.processos || 0}</span></div>
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Receita</span><span style="color:${GREEN_BRIGHT};font-weight:700">${fmt(dados?.receita || 0)}</span></div>
            </div>
            <div style="margin-top:8px;font-size:10px;color:#484f58;text-align:center">Clique para explorar →</div>
          `;
        }
      })
      .on('mousemove', function (event: any) {
        if (!tooltipRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
        tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
      })
      .on('mouseout', function (_event: any, d: any) {
        const uf = getUfFromFeature(d);
        const e = dadosEstados.find(dd => dd.uf === uf);
        d3.select(this)
          .attr('fill', getColor(uf))
          .attr('stroke', '#30363d')
          .attr('stroke-width', 0.5)
          .attr('filter', e && e.clientes > 0 ? 'url(#glow-active)' : 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        if (onHoverRef.current) onHoverRef.current(null);
      })
      .on('click', function (event: any, d: any) {
        event.stopPropagation();
        const uf = getUfFromFeature(d);
        if (uf) navigate(`/inteligencia-geografica/${uf}`);
      });

    // Labels
    g.selectAll('text')
      .data(geoData.features)
      .enter()
      .append('text')
      .attr('x', (d: any) => pathGen.centroid(d)[0])
      .attr('y', (d: any) => pathGen.centroid(d)[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('fill', '#8b949e')
      .attr('pointer-events', 'none')
      .text((d: any) => getUfFromFeature(d));

  }, [geoData, dadosEstados, navigate]);

  if (loading) return (
    <div className="flex items-center justify-center h-[520px] rounded-xl" style={{ background: '#0b0e14' }}>
      <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative rounded-xl overflow-hidden"
      style={{ background: '#0b0e14' }}
      onMouseLeave={() => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        if (onHoverRef.current) onHoverRef.current(null);
      }}
    >
      <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
      <svg ref={svgRef} width="100%" height="520" style={{ display: 'block' }} />
      <div ref={tooltipRef} style={{ display: 'none', position: 'absolute', zIndex: 50, background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 8px 32px rgba(34,197,94,0.15)', minWidth: '180px', pointerEvents: 'none' }} />
      <div className="absolute bottom-4 left-4 flex items-center gap-3" style={{ color: '#8b949e', fontSize: '10px' }}>
        <span className="uppercase tracking-wider font-bold" style={{ color: '#484f58' }}>Legenda:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />10+</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }} />6-10</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#15803d' }} />3-5</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#14532d' }} />1-2</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#161b22', border: '1px solid #30363d' }} />0</span>
      </div>
    </div>
  );
}
