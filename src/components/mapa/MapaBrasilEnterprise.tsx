import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';

export interface EstadoData {
  uf: string;
  nome: string;
  clientes: number;
  receita: number;
  processos: number;
}

interface Props {
  dadosEstados: EstadoData[];
  onEstadoClick?: (uf: string) => void;
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

function getColor(uf: string, dados: EstadoData[]): string {
  const e = dados.find(d => d.uf === uf);
  if (!e || e.clientes === 0) return '#161b22';
  if (e.clientes >= 10) return '#00d2ff';
  if (e.clientes >= 6) return '#00a8cc';
  if (e.clientes >= 3) return '#007a99';
  return '#004d66';
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function MapaBrasilEnterprise({ dadosEstados, onEstadoClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const zoomRef = useRef<any>(null);
  const navigate = useNavigate();

  // Load GeoJSON once
  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const cached = sessionStorage.getItem('brasil_geojson');
        if (cached) {
          setGeoData(JSON.parse(cached));
          setLoading(false);
          return;
        }
        const res = await fetch(
          'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson'
        );
        const data = await res.json();
        sessionStorage.setItem('brasil_geojson', JSON.stringify(data));
        setGeoData(data);
      } catch (err) {
        console.error('Erro ao carregar GeoJSON:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGeo();
  }, []);

  // D3 render
  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = Math.max(500, width * 0.85);

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const projection = d3.geoMercator().fitSize([width * 0.95, height * 0.95], geoData);
    // center it
    const [tx, ty] = projection.translate();
    projection.translate([tx + width * 0.025, ty + height * 0.025]);

    const path = d3.geoPath().projection(projection);
    const g = svg.append('g');

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomRef.current = zoom;

    // Filters
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

    // States
    g.selectAll('path')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('d', path as any)
      .attr('fill', (d: any) => getColor(getUfFromFeature(d), dadosEstados))
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
          .attr('fill', '#00d2ff')
          .attr('stroke', '#00d2ff')
          .attr('stroke-width', 2)
          .attr('filter', 'url(#glow-hover)');

        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.innerHTML = `
            <div style="font-size:14px;font-weight:800;color:#00d2ff;margin-bottom:6px">${UF_NOMES[uf] || uf}</div>
            <div style="font-size:11px;color:#8b949e;line-height:2">
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Clientes</span><span style="color:#e6edf3;font-weight:700">${dados?.clientes || 0}</span></div>
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Processos</span><span style="color:#e6edf3;font-weight:700">${dados?.processos || 0}</span></div>
              <div style="display:flex;justify-content:space-between;gap:20px"><span>Receita</span><span style="color:#00d2ff;font-weight:700">${fmt(dados?.receita || 0)}</span></div>
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
          .attr('fill', getColor(uf, dadosEstados))
          .attr('stroke', '#30363d')
          .attr('stroke-width', 0.5)
          .attr('filter', e && e.clientes > 0 ? 'url(#glow-active)' : 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      })
      .on('click', function (_event: any, d: any) {
        const uf = getUfFromFeature(d);
        if (!uf) return;
        if (onEstadoClick) onEstadoClick(uf);
        else navigate(`/inteligencia-geografica/${uf}`);
      });

    // Labels
    g.selectAll('text')
      .data(geoData.features)
      .enter()
      .append('text')
      .attr('x', (d: any) => path.centroid(d)[0])
      .attr('y', (d: any) => path.centroid(d)[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('fill', '#8b949e')
      .attr('pointer-events', 'none')
      .text((d: any) => getUfFromFeature(d));

  }, [geoData, dadosEstados, navigate, onEstadoClick]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ background: '#0b0e14' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#00d2ff', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8b949e' }}>Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden" style={{ background: '#0b0e14' }}>
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }} />

      <svg ref={svgRef} width="100%" style={{ display: 'block' }} />

      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', zIndex: 50,
        background: '#161b22', border: '1px solid #30363d', borderRadius: '12px',
        padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,210,255,0.15), 0 0 0 1px rgba(0,210,255,0.1)',
        minWidth: '180px', pointerEvents: 'none',
      }} />

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3" style={{ color: '#8b949e', fontSize: '10px' }}>
        <span className="uppercase tracking-wider font-bold" style={{ color: '#484f58' }}>Legenda:</span>
        {[
          { c: '#00d2ff', l: '10+' }, { c: '#00a8cc', l: '6-10' },
          { c: '#007a99', l: '3-5' }, { c: '#004d66', l: '1-2' },
          { c: '#161b22', l: '0', border: true },
        ].map(i => (
          <span key={i.l} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: i.c, border: i.border ? '1px solid #30363d' : undefined }} />
            {i.l}
          </span>
        ))}
      </div>

      {/* Zoom buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-1">
        {[{ label: '+', f: 1.5 }, { label: '−', f: 0.67 }].map(z => (
          <button key={z.label} onClick={() => handleZoom(z.f)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:text-white"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }}
          >{z.label}</button>
        ))}
      </div>
    </div>
  );
}
