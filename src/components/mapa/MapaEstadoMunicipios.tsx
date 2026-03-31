import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { geoCache } from '@/lib/geo-cache';
import { Search } from 'lucide-react';
import { UF_NOMES } from '@/constants/estados-brasil';

interface Props {
  uf: string;
  clientesPorMunicipio?: Record<string, number>;
  onMunicipioClick?: (nome: string) => void;
}

const IBGE_TO_UF: Record<string, string> = {
  '11':'RO','12':'AC','13':'AM','14':'RR','15':'PA','16':'AP','17':'TO',
  '21':'MA','22':'PI','23':'CE','24':'RN','25':'PB','26':'PE','27':'AL',
  '28':'SE','29':'BA','31':'MG','32':'ES','33':'RJ','35':'SP','41':'PR',
  '42':'SC','43':'RS','50':'MS','51':'MT','52':'GO','53':'DF',
};

const UF_TO_IBGE: Record<string, string> = Object.fromEntries(
  Object.entries(IBGE_TO_UF).map(([k, v]) => [v, k])
);

const GREEN_BRIGHT = '#22c55e';

function getMunNome(d: any): string {
  return d.properties?.name || d.properties?.nome || d.properties?.NM_MUN || 'Município';
}

export function MapaEstadoMunicipios({ uf, clientesPorMunicipio = {}, onMunicipioClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<any>(null);
  const projectionRef = useRef<any>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buscaMunicipio, setBuscaMunicipio] = useState('');
  const clientesRef = useRef(clientesPorMunicipio);

  useEffect(() => { clientesRef.current = clientesPorMunicipio; }, [clientesPorMunicipio]);

  // Clean up old sessionStorage keys
  useEffect(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('mun_geo') || key.startsWith('municipios_geo'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (_) { /* ignore */ }
  }, []);

  // Load municipality GeoJSON
  useEffect(() => {
    const fetchMunicipios = async () => {
      setLoading(true);
      setError(null);
      try {
        const cacheKey = `municipios_${uf}`;
        const cached = geoCache.get(cacheKey);
        if (cached) { setGeoData(cached); setLoading(false); return; }

        const codigoIBGE = UF_TO_IBGE[uf];
        if (!codigoIBGE) throw new Error('UF não encontrada');

        const url = `https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-${codigoIBGE}-mun.json`;
        console.log('Carregando municípios de:', url);

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Erro ao carregar: ${res.status}`);
        const data = await res.json();
        if (!data.features?.length) throw new Error('Sem municípios');

        console.log(`Carregados ${data.features.length} municípios para ${uf}`, data.features[0]?.properties);

        geoCache.set(cacheKey, data);
        setGeoData(data);
      } catch (err: any) {
        console.error('Erro municípios:', err);
        setError(err.message);
      } finally { setLoading(false); }
    };
    fetchMunicipios();
  }, [uf]);

  const getMunFill = useCallback((d: any): string => {
    const nome = getMunNome(d).toUpperCase();
    const qtd = clientesRef.current[nome] || 0;
    if (qtd >= 5) return '#22c55e';
    if (qtd >= 3) return '#16a34a';
    if (qtd >= 1) return '#14532d';
    return '#0d1117';
  }, []);

  // Render municipality map
  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = 500;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const projection = d3.geoMercator()
      .fitExtent([[20, 20], [width - 20, height - 20]], geoData);
    projectionRef.current = projection;
    const pathGen = d3.geoPath().projection(projection);

    // Glow filter
    const defs = svg.append('defs');
    const glow = defs.append('filter').attr('id', 'mun-glow')
      .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    // Zoom (buttons + pinch only, NO scroll)
    const zoom = d3.zoom()
      .scaleExtent([0.8, 6])
      .filter((event: any) => {
        if (event.type === 'wheel') return false;
        return true;
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom as any);
    zoomRef.current = zoom;

    // Municipalities
    g.selectAll('path.municipio')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('class', 'municipio')
      .attr('d', pathGen as any)
      .attr('fill', (d: any) => getMunFill(d))
      .attr('stroke', '#1e3a2a')
      .attr('stroke-width', 0.4)
      .attr('cursor', 'pointer')
      .on('mouseover', function (event: any, d: any) {
        d3.select(this)
          .attr('fill', GREEN_BRIGHT)
          .attr('stroke', '#4ade80')
          .attr('stroke-width', 1)
          .attr('filter', 'url(#mun-glow)');

        const nome = getMunNome(d);
        const qtd = clientesRef.current[nome.toUpperCase()] || 0;

        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
          tooltipRef.current.innerHTML = `
            <div style="font-size:14px;font-weight:800;color:${GREEN_BRIGHT};margin-bottom:4px;">${nome}</div>
            <div style="font-size:11px;color:#8b949e;">
              ${qtd > 0
                ? `<div style="display:flex;justify-content:space-between;gap:20px;"><span>Clientes</span><span style="color:${GREEN_BRIGHT};font-weight:700;">${qtd}</span></div>`
                : '<div style="color:#484f58;">Sem clientes cadastrados</div>'
              }
            </div>`;
        }
      })
      .on('mousemove', function (event: any) {
        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
        }
      })
      .on('mouseout', function (_event: any, d: any) {
        d3.select(this)
          .attr('fill', getMunFill(d))
          .attr('stroke', '#1e3a2a')
          .attr('stroke-width', 0.4)
          .attr('filter', 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      })
      .on('click', function (event: any, d: any) {
        event.stopPropagation();
        const nome = getMunNome(d);
        if (onMunicipioClick) onMunicipioClick(nome);
      });

    // Labels on municipalities with clients
    g.selectAll('text')
      .data(geoData.features.filter((d: any) => (clientesRef.current[getMunNome(d).toUpperCase()] || 0) > 0))
      .enter()
      .append('text')
      .attr('x', (d: any) => pathGen.centroid(d)[0])
      .attr('y', (d: any) => pathGen.centroid(d)[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '7px')
      .attr('font-weight', '700')
      .attr('fill', '#e6edf3')
      .attr('pointer-events', 'none')
      .text((d: any) => getMunNome(d));

  }, [geoData, clientesPorMunicipio, getMunFill, onMunicipioClick]);

  // Highlight municipalities based on search
  const highlightMunicipio = useCallback((query: string) => {
    if (!svgRef.current || !geoData) return;
    const g = d3.select(svgRef.current).select('g');
    const q = query.toLowerCase().trim();

    g.selectAll('path.municipio')
      .transition()
      .duration(200)
      .attr('fill', (d: any) => {
        if (!q) return getMunFill(d);
        const nome = (getMunNome(d) || '').toLowerCase();
        if (nome.includes(q)) return '#22c55e';
        return '#060809';
      })
      .attr('opacity', (d: any) => {
        if (!q) return 1;
        const nome = (getMunNome(d) || '').toLowerCase();
        return nome.includes(q) ? 1 : 0.3;
      });

    // Zoom to matched municipality
    if (q.length >= 3 && zoomRef.current) {
      const matchFeature = geoData.features.find((f: any) =>
        (getMunNome(f) || '').toLowerCase().includes(q)
      );
      if (matchFeature && projectionRef.current) {
        const svg = d3.select(svgRef.current);
        const pathGen = d3.geoPath().projection(projectionRef.current);
        const [[x0, y0], [x1, y1]] = pathGen.bounds(matchFeature);
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const w = svgRef.current.clientWidth || 800;
        svg.transition().duration(500).call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(w / 2 - cx * 3, 250 - cy * 3).scale(3)
        );
      }
    } else if (!q && zoomRef.current) {
      // Reset zoom when search cleared
      const svg = d3.select(svgRef.current);
      svg.transition().duration(500).call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  }, [geoData, getMunFill]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-[500px] rounded-xl" style={{ background: '#0b0e14' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm" style={{ color: '#8b949e' }}>Carregando municípios...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-[500px] rounded-xl" style={{ background: '#0b0e14' }}>
      <p className="text-sm" style={{ color: '#ef4444' }}>Erro ao carregar mapa: {error}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#484f58' }} />
        <input
          type="text"
          value={buscaMunicipio}
          onChange={(e) => {
            setBuscaMunicipio(e.target.value);
            highlightMunicipio(e.target.value);
          }}
          placeholder={`Buscar município em ${UF_NOMES[uf] || uf}...`}
          className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
          style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3', outline: 'none' }}
          onFocus={(e) => e.target.style.borderColor = '#22c55e'}
          onBlur={(e) => e.target.style.borderColor = '#30363d'}
        />
      </div>

      {/* Map container */}
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden"
        style={{ background: '#0b0e14' }}
        onMouseLeave={() => { if (tooltipRef.current) tooltipRef.current.style.display = 'none'; }}
      >
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)', backgroundSize: '20px 20px', pointerEvents: 'none' }} />
        <svg ref={svgRef} width="100%" height="500" style={{ display: 'block' }} />
        <div ref={tooltipRef} style={{ display: 'none', position: 'absolute', zIndex: 50, background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 8px 32px rgba(34,197,94,0.15)', minWidth: '180px', pointerEvents: 'none' }} />

        {/* Zoom buttons */}
        <div className="absolute top-4 right-4 flex flex-col gap-1 z-10">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:border-green-500"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }}
          >+</button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:border-green-500"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }}
          >−</button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 flex items-center gap-3" style={{ color: '#8b949e', fontSize: '10px' }}>
          <span className="uppercase tracking-wider font-bold" style={{ color: '#484f58' }}>Legenda:</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#22c55e' }} />5+ cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#16a34a' }} />3-4 cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#14532d' }} />1-2 cli</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: '#0d1117', border: '1px solid #1e3a2a' }} />0</span>
        </div>

        {/* Count */}
        <div className="absolute top-4 left-4 text-xs" style={{ color: '#484f58' }}>
          {geoData?.features?.length || 0} municípios
        </div>
      </div>
    </div>
  );
}
