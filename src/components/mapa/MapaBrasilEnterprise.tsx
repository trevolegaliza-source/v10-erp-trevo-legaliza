import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';

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
  onEstadoClick?: (uf: string) => void;
  onHover?: HoverCallback;
  clientesPorCidade?: Record<string, number>; // "UF-CIDADE" => count
  onActiveUFChange?: (uf: string | null) => void;
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

const IBGE_TO_UF: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
  '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
  '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
  '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
  '52': 'GO', '53': 'DF',
};

const UF_TO_IBGE: Record<string, string> = Object.fromEntries(
  Object.entries(IBGE_TO_UF).map(([k, v]) => [v, k])
);

function getUfFromFeature(d: any): string {
  return d.properties?.sigla || d.properties?.UF || d.properties?.uf || '';
}

const GREEN_BRIGHT = '#22c55e';
const GREEN_STRONG = '#16a34a';
const GREEN_MEDIUM = '#15803d';
const GREEN_DARK = '#14532d';
const GREEN_GLOW_RGBA = 'rgba(34, 197, 94, 0.15)';

function getColor(uf: string, dados: EstadoData[]): string {
  const e = dados.find(d => d.uf === uf);
  if (!e || e.clientes === 0) return '#161b22';
  if (e.clientes >= 10) return GREEN_BRIGHT;
  if (e.clientes >= 6) return GREEN_STRONG;
  if (e.clientes >= 3) return GREEN_MEDIUM;
  return GREEN_DARK;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getMunNome(d: any): string {
  return d.properties?.name || d.properties?.nome || d.properties?.NM_MUN || 'Município';
}

export function MapaBrasilEnterprise({ dadosEstados, onEstadoClick, onHover, clientesPorCidade, onActiveUFChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeUF, setActiveUF] = useState<string | null>(null);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [municipiosGeo, setMunicipiosGeo] = useState<any>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const pathRef = useRef<any>(null);
  const dimensionsRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });
  const activeUFRef = useRef<string | null>(null);
  const zoomBehaviorRef = useRef<any>(null);
  const onHoverRef = useRef<HoverCallback | undefined>(onHover);
  const clientesPorCidadeRef = useRef(clientesPorCidade);
  const navigate = useNavigate();

  useEffect(() => { onHoverRef.current = onHover; }, [onHover]);
  useEffect(() => { activeUFRef.current = activeUF; onActiveUFChange?.(activeUF); }, [activeUF, onActiveUFChange]);
  useEffect(() => { clientesPorCidadeRef.current = clientesPorCidade; }, [clientesPorCidade]);

  // Municipalities with clients for sidebar during drill-down
  const municipiosComClientes = useMemo(() => {
    if (!activeUF || !clientesPorCidade) return [];
    const prefix = `${activeUF}-`;
    return Object.entries(clientesPorCidade)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ municipio: k.slice(prefix.length), clientes: v }))
      .sort((a, b) => b.clientes - a.clientes);
  }, [activeUF, clientesPorCidade]);

  // Total municipalities loaded
  const totalMunicipios = municipiosGeo?.features?.length || 0;

  // Load GeoJSON once
  useEffect(() => {
    const fetchGeo = async () => {
      try {
        const cached = sessionStorage.getItem('brasil_geojson');
        if (cached) { setGeoData(JSON.parse(cached)); setLoading(false); return; }
        const res = await fetch(
          'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson'
        );
        const data = await res.json();
        sessionStorage.setItem('brasil_geojson', JSON.stringify(data));
        setGeoData(data);
      } catch (err) { console.error('Erro ao carregar GeoJSON:', err); }
      finally { setLoading(false); }
    };
    fetchGeo();
  }, []);

  const getMunFill = useCallback((d: any, uf: string) => {
    const nome = getMunNome(d).toUpperCase();
    const key = `${uf}-${nome}`;
    const count = clientesPorCidadeRef.current?.[key] || 0;
    if (count > 0) return GREEN_BRIGHT;
    return '#0d1117';
  }, []);

  const renderMunicipios = useCallback((
    g: d3.Selection<any, any, any, any>,
    municipiosData: any,
    pathGenerator: any,
    parentScale: number,
    uf: string
  ) => {
    g.selectAll('.municipios-layer').remove();
    const layer = g.append('g').attr('class', 'municipios-layer');

    layer.selectAll('path.municipio')
      .data(municipiosData.features || [])
      .enter()
      .append('path')
      .attr('class', (d: any) => {
        const nome = getMunNome(d).toUpperCase();
        const key = `${uf}-${nome}`;
        const hasClient = (clientesPorCidadeRef.current?.[key] || 0) > 0;
        return `municipio${hasClient ? ' municipio-ativo' : ''}`;
      })
      .attr('d', pathGenerator as any)
      .attr('fill', (d: any) => getMunFill(d, uf))
      .attr('stroke', '#1e3a2a')
      .attr('stroke-width', 0.4 / parentScale)
      .attr('cursor', 'pointer')
      .attr('opacity', 0)
      .transition()
      .duration(400)
      .delay((_d: any, i: number) => Math.min(i * 3, 600))
      .attr('opacity', 1);

    // Event binding after entering
    layer.selectAll('path.municipio')
      .on('mouseover', function (event: any, d: any) {
        d3.select(this)
          .attr('fill', GREEN_BRIGHT)
          .attr('stroke', '#4ade80')
          .attr('stroke-width', 0.8 / parentScale)
          .attr('filter', 'url(#glow-hover)');

        const nome = getMunNome(d);
        const key = `${uf}-${nome.toUpperCase()}`;
        const qtd = clientesPorCidadeRef.current?.[key] || 0;

        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.display = 'block';
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
          tooltipRef.current.innerHTML = `
            <div style="font-size:14px;font-weight:800;color:${GREEN_BRIGHT};margin-bottom:6px">${nome}</div>
            <div style="font-size:11px;color:#8b949e;line-height:1.8">
              ${qtd > 0
                ? `<div style="display:flex;justify-content:space-between;gap:20px"><span>Clientes</span><span style="color:${GREEN_BRIGHT};font-weight:700">${qtd}</span></div>`
                : '<div style="color:#484f58">Sem clientes cadastrados</div>'
              }
            </div>
          `;
        }
      })
      .on('mousemove', function (event: any) {
        if (tooltipRef.current && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
          tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
        }
      })
      .on('mouseout', function (this: any, _event: any, d: any) {
        d3.select(this)
          .attr('fill', getMunFill(d, uf))
          .attr('stroke', '#1e3a2a')
          .attr('stroke-width', 0.4 / parentScale)
          .attr('filter', 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      });
  }, [getMunFill]);

  const zoomToEstado = useCallback(async (uf: string, feature: any) => {
    if (!svgRef.current || !gRef.current || !pathRef.current) return;
    try {
      const g = gRef.current;
      const pathGenerator = pathRef.current;
      const { width, height } = dimensionsRef.current;

      const [[x0, y0], [x1, y1]] = pathGenerator.bounds(feature);
      const dx = x1 - x0;
      const dy = y1 - y0;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const scale = Math.max(1, Math.min(8, 0.85 / Math.max(dx / width, dy / height)));
      const tx = width / 2 - scale * cx;
      const ty = height / 2 - scale * cy;

      // Fade other states
      g.selectAll('path.estado')
        .transition().duration(750)
        .attr('opacity', (d: any) => getUfFromFeature(d) === uf ? 0.15 : 0.05);

      g.selectAll('text.estado-label')
        .transition().duration(750).attr('opacity', 0);

      g.transition().duration(750)
        .attr('transform', `translate(${tx},${ty}) scale(${scale})`);

      activeUFRef.current = uf;
      setActiveUF(uf);
      setSearchQuery('');
      setLoadingMunicipios(true);

      const cacheKey = `mun_geo_${uf}`;
      const cached = sessionStorage.getItem(cacheKey);
      let municipiosData;

      if (cached) {
        municipiosData = JSON.parse(cached);
      } else {
        const codigoIBGE = UF_TO_IBGE[uf];
        if (!codigoIBGE) { setLoadingMunicipios(false); return; }
        const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${codigoIBGE}?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=municipio`;
        const res = await fetch(url);
        if (!res.ok) { setLoadingMunicipios(false); return; }
        municipiosData = await res.json();
        if (!municipiosData.features?.length) { setLoadingMunicipios(false); return; }
        sessionStorage.setItem(cacheKey, JSON.stringify(municipiosData));
      }

      setMunicipiosGeo(municipiosData);

      setTimeout(() => {
        renderMunicipios(g, municipiosData, pathGenerator, scale, uf);
        setLoadingMunicipios(false);
      }, 800);
    } catch (err) {
      console.error('Erro no drill-down:', err);
      setLoadingMunicipios(false);
      activeUFRef.current = null;
      setActiveUF(null);
    }
  }, [renderMunicipios]);

  const voltarParaBrasil = useCallback(() => {
    if (!gRef.current) return;
    const g = gRef.current;
    g.transition().duration(750).attr('transform', 'translate(0,0) scale(1)');
    g.selectAll('path.estado').transition().duration(750).attr('opacity', 1);
    g.selectAll('text.estado-label').transition().duration(750).attr('opacity', 1);
    g.selectAll('.municipios-layer').transition().duration(300).attr('opacity', 0).remove();
    activeUFRef.current = null;
    setActiveUF(null);
    setMunicipiosGeo(null);
    setSearchQuery('');
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  }, []);

  // Search filtering
  useEffect(() => {
    if (!activeUF || !gRef.current) return;
    const g = gRef.current;
    const query = searchQuery.toLowerCase();
    g.selectAll('path.municipio')
      .attr('fill', function (d: any) {
        const nome = getMunNome(d).toLowerCase();
        if (!query) return getMunFill(d, activeUF);
        return nome.includes(query) ? GREEN_BRIGHT : '#0d1117';
      })
      .attr('opacity', function (d: any) {
        const nome = getMunNome(d).toLowerCase();
        if (!query) return 1;
        return nome.includes(query) ? 1 : 0.3;
      });
  }, [searchQuery, activeUF, getMunFill]);

  // D3 render
  useEffect(() => {
    if (!geoData || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = containerRef.current.clientWidth;
    const height = Math.max(450, width * 0.7);
    dimensionsRef.current = { width, height };
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    svg.selectAll('*').remove();

    const padding = 40;
    const projection = d3.geoMercator()
      .fitExtent([[padding, padding], [width - padding, height - padding]], geoData);
    const path = d3.geoPath().projection(projection);
    pathRef.current = path;

    const g = svg.append('g') as d3.Selection<SVGGElement, unknown, null, undefined>;
    gRef.current = g;

    // Zoom — block wheel scroll
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 8])
      .filter((event: any) => event.type !== 'wheel')
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // mouseleave: ONLY hide tooltip, do NOT reset drill-down
    svg.on('mouseleave', () => {
      if (tooltipRef.current) tooltipRef.current.style.display = 'none';
      // Only clear hover when NOT in drill-down
      if (!activeUFRef.current && onHoverRef.current) {
        onHoverRef.current(null);
      }
    });

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

    const navFn = navigate;
    const zoomFn = zoomToEstado;

    // States
    g.selectAll('path.estado')
      .data(geoData.features)
      .enter()
      .append('path')
      .attr('class', 'estado')
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
        // Don't show state hover when in drill-down mode
        if (activeUFRef.current) return;

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
        if (activeUFRef.current) return;
        if (!tooltipRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        tooltipRef.current.style.left = (event.clientX - rect.left + 16) + 'px';
        tooltipRef.current.style.top = (event.clientY - rect.top - 10) + 'px';
      })
      .on('mouseout', function (_event: any, d: any) {
        if (activeUFRef.current) return;
        const uf = getUfFromFeature(d);
        const e = dadosEstados.find(dd => dd.uf === uf);
        d3.select(this)
          .attr('fill', getColor(uf, dadosEstados))
          .attr('stroke', '#30363d')
          .attr('stroke-width', 0.5)
          .attr('filter', e && e.clientes > 0 ? 'url(#glow-active)' : 'none');
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        if (onHoverRef.current) onHoverRef.current(null);
      })
      .on('click', function (event: any, d: any) {
        event.preventDefault();
        event.stopPropagation();
        const uf = getUfFromFeature(d);
        if (!uf) return;

        if (activeUFRef.current === uf) {
          navFn(`/inteligencia-geografica/${uf}`);
          return;
        }
        if (activeUFRef.current && activeUFRef.current !== uf) {
          // Switch drill-down — need to reset and re-zoom
          const gCurrent = gRef.current;
          if (gCurrent) {
            gCurrent.selectAll('.municipios-layer').remove();
            gCurrent.selectAll('path.estado').transition().duration(300).attr('opacity', 1);
            gCurrent.selectAll('text.estado-label').transition().duration(300).attr('opacity', 1);
            gCurrent.transition().duration(300).attr('transform', 'translate(0,0) scale(1)');
          }
          activeUFRef.current = null;
          setTimeout(() => zoomFn(uf, d), 350);
          return;
        }
        zoomFn(uf, d);
      });

    // Labels
    g.selectAll('text.estado-label')
      .data(geoData.features)
      .enter()
      .append('text')
      .attr('class', 'estado-label')
      .attr('x', (d: any) => path.centroid(d)[0])
      .attr('y', (d: any) => path.centroid(d)[1])
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('fill', '#8b949e')
      .attr('pointer-events', 'none')
      .text((d: any) => getUfFromFeature(d));

  }, [geoData, dadosEstados, navigate, onEstadoClick, zoomToEstado]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomBehaviorRef.current.scaleBy as any, factor);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" style={{ background: '#0b0e14' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: GREEN_BRIGHT, borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#8b949e' }}>Carregando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative rounded-xl overflow-hidden" style={{ background: '#0b0e14' }}
      onMouseLeave={() => {
        if (tooltipRef.current) tooltipRef.current.style.display = 'none';
        // Do NOT reset drill-down on mouse leave
        if (!activeUFRef.current && onHover) onHover(null);
      }}
    >
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 px-4 pt-3 text-xs" style={{ color: '#8b949e', zIndex: 10, position: 'relative' }}>
        <span
          className={`cursor-pointer transition-colors ${!activeUF ? 'font-bold' : 'hover:text-green-400'}`}
          style={!activeUF ? { color: GREEN_BRIGHT } : undefined}
          onClick={() => { if (activeUF) voltarParaBrasil(); }}
        >
          🇧🇷 Brasil
        </span>
        {activeUF && (
          <>
            <span>/</span>
            <span className="font-bold" style={{ color: GREEN_BRIGHT }}>
              {UF_NOMES[activeUF]}
            </span>
            <span className="ml-2 px-2 py-0.5 rounded" style={{ background: '#161b22', border: '1px solid #30363d', fontSize: '10px' }}>
              {totalMunicipios} municípios
            </span>
          </>
        )}
      </div>

      {/* Grid background */}
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(#30363d 1px, transparent 1px)',
        backgroundSize: '20px 20px', pointerEvents: 'none',
      }} />

      <svg ref={svgRef} width="100%" style={{ display: 'block' }} />

      {/* Tooltip */}
      <div ref={tooltipRef} style={{
        display: 'none', position: 'absolute', zIndex: 50,
        background: '#161b22', border: '1px solid #30363d', borderRadius: '12px',
        padding: '14px 18px', boxShadow: `0 8px 32px ${GREEN_GLOW_RGBA}, 0 0 0 1px rgba(34,197,94,0.1)`,
        minWidth: '180px', pointerEvents: 'none',
      }} />

      {/* Back button */}
      {activeUF && (
        <button onClick={voltarParaBrasil}
          className="absolute top-12 left-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
          style={{
            background: '#161b22', border: `1px solid ${GREEN_BRIGHT}`, color: GREEN_BRIGHT,
            boxShadow: `0 0 15px rgba(34,197,94,0.2)`, zIndex: 10,
          }}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para o Brasil
        </button>
      )}

      {/* Search bar */}
      {activeUF && !loadingMunicipios && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 w-72" style={{ zIndex: 10 }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#484f58' }} />
            <input type="text" placeholder={`Buscar município em ${UF_NOMES[activeUF]}...`}
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm"
              style={{ background: '#161b22', border: '1px solid #30363d', color: '#e6edf3', outline: 'none' }}
              onFocus={(e) => (e.target.style.borderColor = GREEN_BRIGHT)}
              onBlur={(e) => (e.target.style.borderColor = '#30363d')}
            />
          </div>
        </div>
      )}

      {/* Loading municipios */}
      {loadingMunicipios && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg"
          style={{ background: '#161b22', border: '1px solid #30363d', zIndex: 10 }}>
          <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN_BRIGHT, borderTopColor: 'transparent' }} />
          <span className="text-xs" style={{ color: '#8b949e' }}>Carregando municípios...</span>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex items-center gap-3" style={{ color: '#8b949e', fontSize: '10px', pointerEvents: 'none' }}>
        <span className="uppercase tracking-wider font-bold" style={{ color: '#484f58' }}>Legenda:</span>
        {[
          { c: GREEN_BRIGHT, l: '10+' }, { c: GREEN_STRONG, l: '6-10' },
          { c: GREEN_MEDIUM, l: '3-5' }, { c: GREEN_DARK, l: '1-2' },
          { c: '#161b22', l: '0', border: true },
        ].map(i => (
          <span key={i.l} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: i.c, border: i.border ? '1px solid #30363d' : undefined }} />
            {i.l}
          </span>
        ))}
      </div>

      {/* Zoom buttons */}
      <div className="absolute top-12 right-4 flex flex-col gap-1" style={{ pointerEvents: 'auto' }}>
        {[{ label: '+', f: 1.5 }, { label: '−', f: 0.67 }].map(z => (
          <button key={z.label} onClick={() => handleZoom(z.f)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-colors hover:text-white"
            style={{ background: '#161b22', border: '1px solid #30363d', color: '#8b949e' }}
          >{z.label}</button>
        ))}
      </div>

      {/* Ver detalhes button */}
      {activeUF && !loadingMunicipios && (
        <button onClick={() => navigate(`/inteligencia-geografica/${activeUF}`)}
          className="absolute top-12 right-16 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all hover:scale-105"
          style={{ background: GREEN_BRIGHT, color: '#0b0e14', boxShadow: '0 0 15px rgba(34,197,94,0.3)', zIndex: 10 }}
        >
          Ver detalhes de {UF_NOMES[activeUF]} →
        </button>
      )}
    </div>
  );
}

// Re-export for sidebar usage
export { UF_NOMES as MAP_UF_NOMES };
export type { Props as MapaBrasilEnterpriseProps };
