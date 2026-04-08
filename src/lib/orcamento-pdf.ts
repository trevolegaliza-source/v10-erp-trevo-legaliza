import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  type OrcamentoItem, type OrcamentoPacote, type OrcamentoSecao,
  type OrcamentoModo, type OrcamentoPDFMode, getItemValor, DEFAULT_SECOES,
} from '@/components/orcamentos/types';

export interface OrcamentoPDFData {
  modo: OrcamentoModo;
  modoContador?: boolean; // legacy compat
  modoPDF?: OrcamentoPDFMode; // 'contador' | 'cliente' | 'direto'
  destinatario?: 'contador' | 'cliente_via_contador' | 'cliente_direto';
  prospect_nome: string;
  prospect_cnpj: string | null;
  // Escritório contábil (used in contador and cliente_via_contador modes)
  escritorioNome?: string;
  escritorioEmail?: string;
  escritorioTelefone?: string;
  escritorioCnpj?: string;
  // Legacy compat fields
  clienteNome?: string;
  contadorNome?: string;
  contadorEmail?: string;
  contadorTelefone?: string;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  contexto: string;
  ordem_execucao: string;
  desconto_pct: number;
  subtotal: number;
  total: number;
  validade_dias: number;
  prazo_execucao: string;
  pagamento: string;
  observacoes: string;
  numero: number;
  data_emissao: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

// FIX 5 — Title Case for ALL CAPS names (smart: keeps conjunctions lowercase)
function toTitleCase(str: string): string {
  const minusculas = new Set([
    'e', 'de', 'da', 'do', 'das', 'dos',
    'em', 'no', 'na', 'nos', 'nas',
    'por', 'para', 'com', 'sem', 'sob',
    'a', 'o', 'as', 'os',
    'um', 'uma',
  ]);
  const semEspacos = str.replace(/\s+/g, '');
  if (semEspacos !== semEspacos.toUpperCase()) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      if (!word) return word;
      if (index === 0) return word.charAt(0).toUpperCase() + word.slice(1);
      if (minusculas.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

// FIX 7 — Format contexto with highlighted risk words and monetary values
function formatarContextoPDF(texto: string): string {
  if (!texto) return '';
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(
    /(R\$[\s]?[\d.,kmKM\-]+)/g,
    '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>'
  );
  const palavrasRisco = [
    'interdição', 'interditada', 'embargo', 'embargada',
    'multa', 'multas', 'autuação', 'penalidade',
    'bloqueio', 'bloqueada', 'suspensão',
    'proibição', 'proibida', 'ilegal',
  ];
  palavrasRisco.forEach(palavra => {
    const regex = new RegExp(`\\b(${palavra})\\b`, 'gi');
    html = html.replace(regex, '<strong style="color: #b91c1c; font-weight: 700;">$1</strong>');
  });
  html = html.replace(/\n/g, '<br>');
  return html;
}

const LOGO_URLS = [
  'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza-hd.png',
  'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza-hd.png',
  'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo/trevo-legaliza.png',
  'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png',
];

async function preloadImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function preloadLogo(): Promise<string | null> {
  for (const url of LOGO_URLS) {
    const b64 = await preloadImageAsBase64(url);
    if (b64) return b64;
  }
  return null;
}

/**
 * Measures the real rendered height of an HTML block in the DOM.
 * Uses getBoundingClientRect() for pixel-accurate measurement.
 */
async function medirAlturaReal(html: string): Promise<number> {
  const probe = document.createElement('div');
  probe.style.cssText = `
    position: absolute;
    top: -99999px;
    left: -99999px;
    width: 722px;
    visibility: hidden;
    pointer-events: none;
    box-sizing: border-box;
  `;
  probe.innerHTML = html;
  document.body.appendChild(probe);

  // Wait one frame for the browser to calculate layout
  await new Promise(r => requestAnimationFrame(r));

  const altura = probe.getBoundingClientRect().height;
  document.body.removeChild(probe);
  return Math.ceil(altura) + 24; // +24px safety margin
}

const HEADER_HEIGHT = 64;

function logoHtml(logo: string | null, height = 36): string {
  return logo
    ? `<img src="${logo}" style="height: ${height}px !important; width: auto !important; max-height: ${height}px !important; min-height: ${height}px !important; object-fit: contain !important; display: block !important; flex-shrink: 0 !important;" crossorigin="anonymous" />`
    : `<div style="font-size: 22px; font-weight: 800; line-height: 1.2;">
         <span style="color: #22c55e;">Trevo</span>
         <span style="color: #ffffff; font-weight: 400; font-size: 18px;"> Legaliza</span>
       </div>`;
}

const HEADER_TREVO = (numero: number, data: string, logo: string | null) => `
  <div style="height:${HEADER_HEIGHT}px !important;min-height:${HEADER_HEIGHT}px !important;max-height:${HEADER_HEIGHT}px !important;overflow:hidden !important;flex-shrink:0;background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); padding: 0 32px; position:relative; display:flex; align-items:center; justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:12px;">
      ${logoHtml(logo, 36)}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(numero).padStart(3, '0')}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px;">${data}</div>
    </div>
  </div>
  <div style="height: 4px; flex-shrink:0; background: linear-gradient(90deg, #22c55e, #86efac, #22c55e);"></div>
`;

const HEADER_CLIENTE = (numero: number, data: string, nomeContabilidade: string) => `
  <div style="height:${HEADER_HEIGHT}px !important;min-height:${HEADER_HEIGHT}px !important;max-height:${HEADER_HEIGHT}px !important;overflow:hidden !important;flex-shrink:0;background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 0 32px; position:relative; display:flex; align-items:center; justify-content:space-between;">
    <div>
      <div style="font-size: 20px; font-weight: 800; color: #ffffff;">${esc(nomeContabilidade)}</div>
      <div style="font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 2px;">Assessoria empresarial</div>
    </div>
    <div style="text-align: right;">
      <div style="font-size: 10px; color: #93c5fd; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(numero).padStart(3, '0')}</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 2px;">${data}</div>
    </div>
  </div>
  <div style="height: 4px; flex-shrink:0; background: linear-gradient(90deg, #3b82f6, #93c5fd, #3b82f6);"></div>
`;

const FOOTER_TREVO = `
  <div style="padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
    <div style="font-size: 10px; color: #94a3b8;">
      Trevo Legaliza · CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP · administrativo@trevolegaliza.com.br · (11) 93492-7001 · trevolegaliza.com.br
    </div>
  </div>
`;

const FOOTER_CLIENTE = (nome: string) => `
  <div style="padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
    <div style="font-size: 10px; color: #94a3b8;">${esc(nome)}</div>
  </div>
`;

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 50);
}

function resolvePDFMode(d: OrcamentoPDFData): OrcamentoPDFMode {
  if (d.modoPDF) return d.modoPDF;
  if (d.destinatario === 'cliente_via_contador') return 'cliente';
  if (d.destinatario === 'cliente_direto') return 'direto';
  return d.modoContador ? 'cliente' : 'contador';
}

/** Resolve the escritório name from new or legacy fields */
function getEscritorioNome(d: OrcamentoPDFData): string {
  return d.escritorioNome || d.clienteNome || d.contadorNome || '';
}

function getNomeExibicao(d: OrcamentoPDFData, pdfMode: OrcamentoPDFMode, contexto: 'header' | 'capa_principal' | 'headline_cenario' | 'cta_final' | 'rodape'): string {
  const escritorio = getEscritorioNome(d);
  const empresa = toTitleCase(d.prospect_nome || '');

  switch (pdfMode) {
    case 'contador':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return 'Trevo Legaliza';
      if (contexto === 'capa_principal') return escritorio || empresa;
      if (contexto === 'headline_cenario') return empresa;
      break;
    case 'cliente':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return escritorio || empresa;
      if (contexto === 'capa_principal' || contexto === 'headline_cenario') return empresa;
      break;
    case 'direto':
      if (contexto === 'header' || contexto === 'rodape' || contexto === 'cta_final') return 'Trevo Legaliza';
      if (contexto === 'capa_principal' || contexto === 'headline_cenario') return empresa;
      break;
  }
  return empresa;
}

function getHeader(d: OrcamentoPDFData, logo: string | null, pdfMode: OrcamentoPDFMode): string {
  if (pdfMode === 'cliente') {
    return HEADER_CLIENTE(d.numero, d.data_emissao, getNomeExibicao(d, pdfMode, 'header'));
  }
  return HEADER_TREVO(d.numero, d.data_emissao, logo);
}

function getFooter(d: OrcamentoPDFData, pdfMode: OrcamentoPDFMode): string {
  if (pdfMode === 'cliente') {
    return FOOTER_CLIENTE(getNomeExibicao(d, pdfMode, 'rodape'));
  }
  return FOOTER_TREVO;
}

/** For rendering logic: 'direto' behaves like 'cliente' (no margins/costs) but with Trevo branding */
function isClienteView(pdfMode: OrcamentoPDFMode): boolean {
  return pdfMode === 'cliente' || pdfMode === 'direto';
}

// Short name for prazos
function shortName(descricao: string): string {
  const map: Record<string, string> = {
    'LICENÇA BOMBEIROS': 'Bombeiros',
    'LICENCA BOMBEIROS': 'Bombeiros',
    'ALVARÁ SANITÁRIO': 'Vigilância Sanitária',
    'ALVARA SANITARIO': 'Vigilância Sanitária',
    'ATUALIZAÇÃO CADASTRO': 'Cadastro Prefeitura',
    'ATUALIZACAO CADASTRO': 'Cadastro Prefeitura',
    'ATUALIZAÇÃO SC BEM': 'JUCESC',
    'REGISTRO CRM': 'CRM PJ',
    'CADASTRO CNES': 'CNES',
    'REGISTRO MARCA': 'Marca INPI',
    'REGISTRO DE MARCA': 'Marca INPI',
  };
  const upper = descricao.toUpperCase();
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key)) return val;
  }
  return descricao.split(' ').slice(0, 3).join(' ');
}

// FIX 6 — Ordem de execução: filter meta-text lines ending with ":"
function formatarOrdemExecucao(texto: string, isCliente: boolean): string {
  const linhas = texto.split('\n').filter(l => l.trim());
  const bgColor = isCliente ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #22c55e, #16a34a)';
  const arrowColor = isCliente ? '#3b82f6' : '#22c55e';

  let html = '';
  let stepNum = 0;

  for (const linha of linhas) {
    const trimmed = linha.trim();
    // Meta-text: ends with ":" or first line that doesn't start with a number
    const isMetaText = trimmed.endsWith(':');
    if (isMetaText) {
      // Render as subtitle, not numbered step
      html += `<div style="font-size: 9px; color: #9ca3af; font-style: italic; padding: 4px 0 2px; margin-top: 4px;">${esc(trimmed)}</div>`;
      continue;
    }
    stepNum++;
    const isLast = linhas.indexOf(linha) === linhas.length - 1;
    html += `
      <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
        <div style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; background: ${bgColor}; color: #fff; font-size: 11px; font-weight: 800; flex-shrink: 0;">${stepNum}</div>
        <div style="flex: 1; font-size: 10px; color: #374151; line-height: 1.5;">${esc(trimmed)}</div>
        
      </div>
    `;
  }
  return html;
}

// ────────────────────────────────────────
// SIMPLES MODE (unchanged logic)
// ────────────────────────────────────────
function buildSimplesHTML(d: OrcamentoPDFData, logo: string | null): string {
  const itensHtml = d.itens.map((item, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 0; ${idx > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
      <div style="flex: 1; padding-right: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: #1a1a2e;">${idx + 1}. ${esc(item.descricao)}${item.quantidade > 1 ? ` (×${item.quantidade})` : ''}</div>
        ${item.detalhes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${esc(item.detalhes)}</div>` : ''}
      </div>
      <div style="font-size: 14px; font-weight: 800; color: #166534; white-space: nowrap;">${fmt(getItemValor(item) * item.quantidade)}</div>
    </div>
  `).join('');

  const descontoHtml = d.desconto_pct > 0
    ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e2e8f0; font-size: 12px;">
        <span style="color: #64748b;">Desconto (${d.desconto_pct}%)</span>
        <span style="color: #dc2626; font-weight: 600;">- ${fmt(d.subtotal * d.desconto_pct / 100)}</span>
       </div>` : '';

  const observacoesHtml = d.observacoes
    ? `<div style="margin-top: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${esc(d.observacoes)}</div>
       </div>` : '';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${HEADER_TREVO(d.numero, d.data_emissao, logo)}
      <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preparada para</div>
        <div style="font-size: 18px; font-weight: 800; color: #1a1a2e;">${esc(d.prospect_nome)}</div>
        ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Válida por ${d.validade_dias} dias</div>
      </div>
      <div style="padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
        ${itensHtml}
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding: 6px 0;">
            <span>Subtotal</span><span style="font-weight: 600;">${fmt(d.subtotal)}</span>
          </div>
          ${descontoHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 8px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Total</span>
            <span style="font-size: 28px; font-weight: 900; color: #166534;">${fmt(d.total)}</span>
          </div>
        </div>
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.pagamento || 'A combinar')}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao || 'A combinar')}</div>
          </div>
        </div>
        ${observacoesHtml}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER_TREVO}</div>
    </div>
  `;
}

// ────────────────────────────────────────
// DETALHADO MODE
// ────────────────────────────────────────
async function buildDetalhadoPages(d: OrcamentoPDFData, logo: string | null): Promise<string[]> {
  const pages: string[] = [];
  const pdfMode = resolvePDFMode(d);
  const isCliente = isClienteView(pdfMode); // true for 'cliente' and 'direto' (hides costs/margins)
  const secoes = d.secoes.length > 0 ? d.secoes : DEFAULT_SECOES;
  const header = getHeader(d, logo, pdfMode);
  const footer = getFooter(d, pdfMode);

  // Compute values
  const getCustoTrevo = (item: OrcamentoItem) => (item.honorario || 0) * item.quantidade;
  const getPrecoCliente = (item: OrcamentoItem) => ((item.honorario_minimo_contador || item.honorario || 0)) * item.quantidade;

  const totalCustoTrevo = d.itens.reduce((s, i) => s + getCustoTrevo(i), 0);
  const totalPrecoCliente = d.itens.reduce((s, i) => s + getPrecoCliente(i), 0);
  const totalTaxaMin = d.itens.reduce((s, i) => s + i.taxa_min, 0);
  const totalTaxaMax = d.itens.reduce((s, i) => s + i.taxa_max, 0);
  const hasTaxas = totalTaxaMin > 0 || totalTaxaMax > 0;

  const totalHonorariosCapa = isCliente ? totalPrecoCliente : totalCustoTrevo;
  const descontoValorCapa = totalHonorariosCapa * (d.desconto_pct / 100);
  const honorarioFinalCapa = totalHonorariosCapa - descontoValorCapa;
  const investimentoMin = honorarioFinalCapa + totalTaxaMin;
  const investimentoMax = honorarioFinalCapa + totalTaxaMax;
  const valorCapa = hasTaxas
    ? `${fmt(investimentoMin)} a ${fmt(investimentoMax)}`
    : fmt(honorarioFinalCapa);

  // Contador-specific cover values
  const custoTrevoFinalCapa = totalCustoTrevo * (1 - d.desconto_pct / 100);
  const precoClienteFinalCapa = totalPrecoCliente * (1 - d.desconto_pct / 100);
  const margemCapa = precoClienteFinalCapa - custoTrevoFinalCapa;
  const margemCapaPct = custoTrevoFinalCapa > 0 ? (((precoClienteFinalCapa / custoTrevoFinalCapa) - 1) * 100).toFixed(0) : '0';

  const useBlueTheme = pdfMode === 'cliente'; // only pure client mode uses blue; direto uses Trevo green
  const accentColor = useBlueTheme ? '#3b82f6' : '#22c55e';
  const accentColorLight = useBlueTheme ? '#93c5fd' : '#4ade80';
  const accentBg = useBlueTheme ? '#eff6ff' : '#f0fdf4';
  const accentBorder = useBlueTheme ? '#3b82f6' : '#22c55e';
  const accentText = useBlueTheme ? '#1e40af' : '#166534';

  // Display name via getNomeExibicao
  const displayName = getNomeExibicao(d, pdfMode, 'capa_principal');
  const nomeEmpresaCurto = getNomeExibicao(d, pdfMode, 'headline_cenario').split(' ').slice(0, 3).join(' ');

  // --- PAGE 1: Cover ---
  const itemCount = d.itens.filter(i => i.descricao.trim()).length;
  const escritorioNome = getEscritorioNome(d);

  if (!isCliente) {
    // ═══════════════════════════════════════════
    // INTERNAL COVER — 4 zones: Identity header, Client ID, 3 financial cards, Footer info
    // ═══════════════════════════════════════════
    const badgeNome = escritorioNome || 'USO EXCLUSIVO DA CONTABILIDADE';

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; height: 1123px; background: white; position: relative; display: flex; flex-direction: column;">

        <!-- ZONA 1: Identity header (dark green, ~30%) -->
        <div style="background: #0f3d24; padding: 48px 40px 36px; position: relative; flex-shrink: 0;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              ${logoHtml(logo, 48)}
              <div style="font-size: 13px; color: #86efac; margin-top: 10px;">Seu Departamento Societário Completo</div>
              <div style="font-size: 9px; color: #6ee7b7; font-style: italic; margin-top: 6px; opacity: 0.8;">🤝 PAINEL DO PARCEIRO — ${esc(badgeNome)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">PROPOSTA #${String(d.numero).padStart(3, '0')}</div>
              <div style="font-size: 10px; color: rgba(255,255,255,0.6); margin-top: 4px;">${d.data_emissao}</div>
              <div style="font-size: 9px; color: #6ee7b7; font-style: italic; margin-top: 16px;">Desde 2018 · 27 estados · Referência nacional</div>
            </div>
          </div>
        </div>

        <!-- ZONA 2: Client identification -->
        <div style="padding: 32px 40px 24px; flex-shrink: 0;">
          <div style="font-size: 9px; color: #0f3d24; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 10px;">PAINEL DO PARCEIRO — PROPOSTA #${String(d.numero).padStart(3, '0')}</div>
          <div style="font-size: 22px; font-weight: 700; color: #0f3d24; margin-bottom: 6px;">${esc(escritorioNome || toTitleCase(d.prospect_nome))}</div>
          ${escritorioNome ? `<div style="font-size: 12px; color: #6b7280;">Para: ${esc(toTitleCase(d.prospect_nome))}</div>` : ''}
          ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        </div>

        <!-- ZONA 3: Three financial cards -->
        <div style="padding: 0 40px; flex-shrink: 0;">
          <div style="display: flex; gap: 16px; width: 100%; margin-top: 24px;">
            <!-- Card 1: Custo Trevo -->
            <div style="flex: 1; background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SEU CUSTO TREVO</div>
              <div style="font-size: 20px; font-weight: 700; color: #333;">${fmt(custoTrevoFinalCapa)}</div>
            </div>
            <!-- Card 2: Cobrar do Cliente (highlight) -->
            <div style="flex: 1; background: #e8f5e9; border: 2px solid #2d6a4f; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #1a4731; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">COBRAR DO CLIENTE</div>
              <div style="font-size: 24px; font-weight: 700; color: #0f3d24;">${valorCapa}</div>
              <div style="font-size: 9px; color: #555; margin-top: 6px;">honorários${hasTaxas ? ' + taxas gov. estimadas' : ''}</div>
            </div>
            <!-- Card 3: Sua Margem -->
            <div style="flex: 1; background: #1a4731; border-radius: 8px; padding: 20px 16px; text-align: center;">
              <div style="font-size: 9px; color: #86efac; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">SUA MARGEM</div>
              <div style="font-size: 24px; font-weight: 700; color: #ffffff;">${fmt(margemCapa)}</div>
              <div style="font-size: 12px; color: #86efac; margin-top: 6px;">${margemCapaPct}% de lucro</div>
            </div>
          </div>
        </div>

        <!-- FIX 3: Mini-cronograma de execução -->
        <div style="padding: 0 48px; flex-shrink: 0; margin-top: 32px;">
          <div style="border-top: 1px solid #e2e8f0; margin-bottom: 24px;"></div>
          <div style="font-size: 10px; font-weight: 600; color: #64748b; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 14px;">Fluxo de execução estimado</div>
          <div style="display: flex; align-items: center; gap: 0;">
            <div style="flex: 1; text-align: center;">
              <div style="width: 32px; height: 32px; background: #1a4731; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; margin: 0 auto 6px auto;">1</div>
              <div style="font-size: 9px; font-weight: 600; color: #1a4731;">Bombeiros</div>
              <div style="font-size: 9px; color: #64748b;">15–45 dias</div>
            </div>
            <div style="font-size: 16px; color: #94a3b8; padding: 0 2px; margin-bottom: 16px;">→</div>
            <div style="flex: 1; text-align: center;">
              <div style="width: 32px; height: 32px; background: #1a4731; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; margin: 0 auto 6px auto;">2</div>
              <div style="font-size: 9px; font-weight: 600; color: #1a4731;">Vigilância</div>
              <div style="font-size: 9px; color: #64748b;">20–60 dias</div>
            </div>
            <div style="font-size: 16px; color: #94a3b8; padding: 0 2px; margin-bottom: 16px;">→</div>
            <div style="flex: 1; text-align: center;">
              <div style="width: 32px; height: 32px; background: #1a4731; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; margin: 0 auto 6px auto;">3</div>
              <div style="font-size: 9px; font-weight: 600; color: #1a4731;">Prefeitura</div>
              <div style="font-size: 9px; color: #64748b;">5–15 dias</div>
            </div>
            <div style="font-size: 16px; color: #94a3b8; padding: 0 2px; margin-bottom: 16px;">→</div>
            <div style="flex: 1; text-align: center;">
              <div style="width: 32px; height: 32px; background: #1a4731; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: white; margin: 0 auto 6px auto;">4</div>
              <div style="font-size: 9px; font-weight: 600; color: #1a4731;">CRM / CNES</div>
              <div style="font-size: 9px; color: #64748b;">15–40 dias</div>
            </div>
            <div style="font-size: 16px; color: #94a3b8; padding: 0 2px; margin-bottom: 16px;">→</div>
            <div style="flex: 1; text-align: center;">
              <div style="width: 32px; height: 32px; background: #0f3d24; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #86efac; margin: 0 auto 6px auto;">✓</div>
              <div style="font-size: 9px; font-weight: 700; color: #0f3d24;">Regular</div>
              <div style="font-size: 9px; color: #64748b;">6–12 sem.</div>
            </div>
          </div>
        </div>

        <!-- ZONA 4: Footer info -->
        <div style="padding: 0 40px 20px; flex-shrink: 0; margin-top: 24px;">
          <div style="border-top: 1px solid #e0e0e0; padding-top: 12px; text-align: center;">
            <div style="font-size: 10px; color: #888;">
              📋 ${itemCount} serviços incluídos &nbsp;·&nbsp; Válido por ${d.validade_dias} dias &nbsp;·&nbsp; Emissão: ${d.data_emissao}
            </div>
            <div style="font-size: 9px; color: #aaa; font-style: italic; margin-top: 6px;">
              Desde 2018 · Referência nacional em regularização empresarial · Atuação em 27 estados
            </div>
          </div>
        </div>

        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  } else {
    // ═══════════════════════════════════════════
    // CLIENT COVER — unchanged layout
    // ═══════════════════════════════════════════
    const coverValueBoxHtml = `
      <div style="margin-top: 40px; padding: 20px 40px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 16px; text-align: center;">
        <div style="font-size: 10px; color: ${accentText}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Investimento Estimado</div>
        <div style="font-size: ${hasTaxas ? '26' : '36'}px; font-weight: 900; color: ${accentText};">${valorCapa}</div>
      </div>
      <div style="font-size: 8px; color: #9ca3af; margin-top: 8px; letter-spacing: 0.3px;">
        Honorários profissionais${hasTaxas ? ' + taxas governamentais estimadas' : ''}
      </div>
    `;

    const coverBulletsHtml = `
      <div style="margin-top: 24px; border-top: 1px solid #e0e0e0; padding-top: 16px; width: 100%; max-width: 500px; text-align: center;">
        <div style="font-size: 11px; color: #555;">
          📋 ${itemCount} serviços incluídos &nbsp;|&nbsp; ⏱ 6 a 12 semanas
        </div>
        <div style="font-size: 10px; color: #888; margin-top: 6px;">
          Válido por ${d.validade_dias} dias · ${esc((d.pagamento || 'Pagamento a combinar').substring(0, 60))}
        </div>
        ${d.data_emissao ? `<div style="font-size: 10px; color: #888; margin-top: 4px;">Proposta emitida em ${d.data_emissao}</div>` : ''}
      </div>
    `;

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; height: 1123px; background: white; position: relative; display: flex; flex-direction: column;">
        ${header}
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 40px 60px;">
          <div style="font-size: 10px; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 4px; font-weight: 700; margin-bottom: 20px;">Proposta Comercial</div>
          <div style="font-size: 28px; font-weight: 600; color: #1a1a2e; text-align: center; margin-bottom: 8px;">${esc(displayName)}</div>
          ${d.prospect_cnpj ? `<div style="font-size: 14px; color: #64748b;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
          ${coverValueBoxHtml}
          ${coverBulletsHtml}

          <!-- FIX 4: 3 benefícios visuais + frase de impacto (cliente) -->
          <div style="margin-top: 36px; width: 100%; max-width: 560px;">
            <div style="border-top: 1px solid #e2e8f0; margin-bottom: 28px;"></div>
            <div style="display: flex; gap: 16px; justify-content: center; margin-bottom: 28px;">
              <div style="flex: 1; text-align: center; padding: 16px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 22px; margin-bottom: 8px;">🛡️</div>
                <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">Operação sem riscos</div>
                <div style="font-size: 10px; color: #64748b; line-height: 1.4;">Elimina risco de multas, interdição e bloqueio de convênios</div>
              </div>
              <div style="flex: 1; text-align: center; padding: 16px 12px; background: #f0fdf4; border-radius: 10px; border: 1px solid #bbf7d0;">
                <div style="font-size: 22px; margin-bottom: 8px;">📋</div>
                <div style="font-size: 11px; font-weight: 700; color: #15803d; margin-bottom: 4px;">Tudo incluído</div>
                <div style="font-size: 10px; color: #4b5563; line-height: 1.4;">Expertise full-service — desde o protocolo até a licença em mãos</div>
              </div>
              <div style="flex: 1; text-align: center; padding: 16px 12px; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                <div style="font-size: 22px; margin-bottom: 8px;">⏱️</div>
                <div style="font-size: 11px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">6 a 12 semanas</div>
                <div style="font-size: 10px; color: #64748b; line-height: 1.4;">Prazo estimado para regularização completa</div>
              </div>
            </div>
            <div style="text-align: center; font-size: 12px; font-style: italic; color: #475569; padding: 14px 20px; background: #f1f5f9; border-radius: 8px; line-height: 1.5;">
              "Regularização não é burocracia — é o que permite sua empresa<br>
              operar com segurança, contratar convênios e crescer sem sustos."
            </div>
          </div>
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  // --- PAGE 2: Context (if filled) ---
  const temContexto = d.contexto && d.contexto.trim().length > 0;
  const temOrdem = d.ordem_execucao && d.ordem_execucao.trim().length > 0;
  if (temContexto || temOrdem) {
    // FIX 4 — Risk box for client mode (before context)
    const riskBoxHtml = isCliente ? `
      <div style="background: #FEF2F2; border-left: 4px solid #B03030; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #7F1D1D; margin-bottom: 8px;">⛔ SITUAÇÃO ATUAL — RISCOS DE OPERAÇÃO SEM REGULARIZAÇÃO</div>
        <div style="font-size: 11px; color: #991B1B; line-height: 1.8;">
          • Multas de R$ 5.000 a R$ 50.000 por autuação da Vigilância Sanitária<br/>
          • Risco de interdição imediata e embargo das atividades<br/>
          • Bloqueio de convênios médicos e SUS sem CNES ativo
        </div>
      </div>
    ` : '';

    // MELHORIA C — Lead forte no cenário (cliente mode)
    const leadForteHtml = isCliente && temContexto ? `
      <div style="font-weight: 600; font-size: 13px; color: #1a4731; margin-bottom: 12px; line-height: 1.5;">
        A regularização não é uma formalidade — é o que permite ${esc(nomeEmpresaCurto)} operar sem riscos e crescer com segurança.
      </div>
    ` : '';

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${header}
        <div style="padding: 24px 36px; box-sizing: border-box;">
          ${riskBoxHtml}
          ${temContexto ? `
            <div style="margin-bottom: 30px;">
              <div style="font-size: 10px; font-weight: 700; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid ${accentBg}; padding-bottom: 8px;">Cenário e Oportunidade</div>
              ${leadForteHtml}
              <div style="background: #fafafa; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-top: 12px;">
                <div style="line-height: 1.7; font-size: 11px; color: #374151;">${formatarContextoPDF(d.contexto)}</div>
              </div>
            </div>
          ` : ''}
          ${temOrdem ? `
            <div>
              <div style="font-size: 10px; font-weight: 700; color: ${accentColorLight}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid ${accentBg}; padding-bottom: 8px;">Ordem Sugerida de Execução</div>
              <div style="background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">
                ${formatarOrdemExecucao(d.ordem_execucao, useBlueTheme)}
              </div>
            </div>
            ${(!isCliente || pdfMode === 'direto') ? `
              <div style="margin-top: 32px; padding: 20px 24px; background: #f0faf4; border-left: 4px solid #1a4731; border-radius: 0 8px 8px 0;">
                <div style="font-size: 12px; font-weight: 700; color: #1a4731; margin-bottom: 12px;">Por que a Trevo Legaliza?</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px;">
                  <div style="font-size: 11px; color: #333;">✓ +8 anos de mercado</div>
                  <div style="font-size: 11px; color: #333;">✓ 27 estados de atuação</div>
                  <div style="font-size: 11px; color: #333;">✓ Expertise full-service</div>
                  <div style="font-size: 11px; color: #333;">✓ Honorários fixos por item</div>
                </div>
                <div style="font-size: 10px; color: #555; font-style: italic; margin-top: 10px;">${pdfMode === 'direto' ? 'Regularize sua empresa com quem entende do assunto.' : 'Você vende. A Trevo executa. Simples assim.'}</div>
              </div>
            ` : ''}
          ` : ''}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  // --- ITEMS PAGES (grouped by section, REAL HEIGHT MEASUREMENT) ---
  const grouped = secoes
    .map(s => ({ ...s, items: d.itens.filter(i => i.secao === s.key).sort((a, b) => a.ordem - b.ordem) }))
    .filter(g => g.items.length > 0);

  interface ItemEntry {
    item: OrcamentoItem;
    sectionLabel?: string;
    sectionKey?: string;
  }

  const allEntries: ItemEntry[] = [];
  for (const group of grouped) {
    const label = group.key !== 'geral' ? `${group.label} (${group.items.length})` : undefined;
    group.items.forEach((item, i) => {
      allEntries.push({ item, sectionLabel: i === 0 ? label : undefined, sectionKey: group.key });
    });
  }

  // Build HTML for a single entry card (extracted for measurement)
  function buildEntryHtml(entry: ItemEntry): string {
    let cardHtml = '';
    const item = entry.item;

    if (entry.sectionLabel) {
      cardHtml += `<div style="font-size: 11px; font-weight: 700; color: ${accentText}; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid ${accentBg};">${esc(entry.sectionLabel)}</div>`;
    }

    const valorExibido = isCliente
      ? (item.honorario_minimo_contador || item.honorario)
      : getItemValor(item);
    const valorTotal = valorExibido * item.quantidade;
    const totalMin = valorTotal + item.taxa_min;
    const totalMax = valorTotal + item.taxa_max;
    const hasTaxaItem = item.taxa_min > 0 || item.taxa_max > 0;
    const isOpcional = item.isOptional === true || entry.sectionKey === 'opcionais' || (secoes.find(s => s.key === entry.sectionKey)?.label || '').toLowerCase().includes('opcional');
    const isCNES = /cnes|altamente recomendado/i.test(item.descricao);
    const borderColor = isOpcional
      ? (isCNES ? '#10b981' : '#f59e0b')
      : (entry.sectionKey === 'obrigatorios' ? '#22c55e' : '#e5e7eb');
    const borderStyle = (isOpcional && !isCNES) ? 'dashed' : 'solid';

    // Financial section based on PDF mode
    let financialHtml = '';
    if (!isCliente) {
      const hMin = item.honorario_minimo_contador || 0;
      const vMerc = item.valor_mercado || 0;
      const vPrem = item.valor_premium || 0;
      const margemMin = hMin > 0 && item.honorario > 0 ? hMin - item.honorario : 0;
      const margemMinPct = item.honorario > 0 && hMin > 0 ? ((hMin / item.honorario - 1) * 100).toFixed(0) : '0';
      const margemMerc = vMerc > 0 && item.honorario > 0 ? vMerc - item.honorario : 0;
      const margemMercPct = item.honorario > 0 && vMerc > 0 ? ((vMerc / item.honorario - 1) * 100).toFixed(0) : '0';
      const hasContadorFields = hMin > 0 || vMerc > 0 || vPrem > 0;

      if (hasContadorFields) {
        financialHtml = `
          <div style="padding: 0 18px 12px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 1px; background: #e5e7eb; border-radius: 12px; overflow: hidden; margin: 12px 0;">
              <div style="padding: 10px; background: #f5f5f5; text-align: center;">
                <div style="font-size: 6.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #666666; margin-bottom: 4px;">NOSSO CUSTO</div>
                <div style="font-size: 12px; font-weight: 400; color: #666666;">${fmt(item.honorario)}</div>
              </div>
              <div style="padding: 10px; background: #e8f5e9; border: 1px solid #a5d6a7; text-align: center;">
                <div style="font-size: 6.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">COBRAR NO MÍNIMO</div>
                <div style="font-size: 12px; font-weight: 500; color: #2e7d32;">${hMin > 0 ? fmt(hMin) : '—'}</div>
                ${margemMin > 0 ? `<div style="font-size: 7px; color: #388e3c; margin-top: 2px;">Margem: ${fmt(margemMin)} (${margemMinPct}%)</div>` : ''}
              </div>
              <div style="padding: 10px; background: #c8e6c9; border: 2px solid #4caf50; text-align: center;">
                <div style="font-size: 9px; color: #2e7d32; font-weight: 700; margin-bottom: 2px;">✓ IDEAL</div>
                <div style="font-size: 6.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">VALOR DE MERCADO</div>
                <div style="font-size: 12px; font-weight: 700; color: #1b5e20;">${vMerc > 0 ? fmt(vMerc) : '—'}</div>
                ${margemMerc > 0 ? `<div style="font-size: 7px; color: #2e7d32; font-weight: 600; margin-top: 2px;">Margem: ${fmt(margemMerc)} (${margemMercPct}%)</div>` : ''}
              </div>
              <div style="padding: 10px; background: #fff3cd; border: 1px solid #ffc107; text-align: center;">
                <div style="font-size: 6.5px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #9ca3af; margin-bottom: 4px;">ACIMA = CARO</div>
                <div style="font-size: 12px; font-weight: 400; color: #856404;">${vPrem > 0 ? fmt(vPrem) : '—'}</div>
              </div>
            </div>
            ${hasTaxaItem ? `<div style="font-size: 8px; color: #6b7280; text-align: center; padding: 4px 0;">Taxas externas (pagas pelo cliente): ${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</div>` : ''}
          </div>
        `;
      } else {
        financialHtml = `
          <div style="padding: 12px 18px; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
              <span style="color: #6b7280;">Honorário Trevo</span>
              <span style="font-weight: 700; color: #1a1a2e;">${fmt(valorTotal)}</span>
            </div>
            ${hasTaxaItem ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
                <span style="color: #6b7280;">Taxas externas (estimativa)</span>
                <span style="font-weight: 500; color: #92400e;">${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px;">
                <span style="font-weight: 700; color: #1a1a2e;">Total estimado</span>
                <span style="font-size: 11px; font-weight: 700; color: ${accentText};">${fmt(totalMin)} a ${fmt(totalMax)}</span>
              </div>
            ` : ''}
          </div>
        `;
      }
    } else {
      financialHtml = `
        <div style="padding: 12px 18px; background: #fafafa;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
            <span style="color: #6b7280;">Investimento</span>
            <span style="font-weight: 700; color: #1a1a2e;">${fmt(valorTotal)}</span>
          </div>
          ${hasTaxaItem ? `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 10px;">
              <span style="color: #6b7280;">Taxas governamentais (estimativa)</span>
              <span style="font-weight: 500; color: #92400e;">${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px;">
              <span style="font-weight: 700; color: #1a1a2e;">Total estimado</span>
              <span style="font-size: 11px; font-weight: 700; color: ${accentText};">${fmt(totalMin)} a ${fmt(totalMax)}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    const showDocsSection = item.prazo || item.docs_necessarios;
    const opcionalBadge = isOpcional
      ? (isCNES
        ? `<span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:4px;background:#d1fae5;color:#064e3b;letter-spacing:0.5px;margin-right:10px;white-space:nowrap;vertical-align:middle;">★ RECOMENDADO</span>`
        : `<span style="font-size:9px;font-weight:600;padding:2px 8px;border-radius:4px;background:#fef3c7;color:#92400e;letter-spacing:0.5px;margin-right:10px;white-space:nowrap;vertical-align:middle;">OPCIONAL</span>`)
      : '';

    cardHtml += `
      <div style="border: 1px solid #e5e7eb; border-left: 4px ${borderStyle} ${borderColor}; border-radius: 16px; margin-bottom: 14px; overflow: hidden;">
        <div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%);">
          <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.15); color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0;">${item.ordem || '•'}</div>
          <div style="flex: 1; min-width: 0;">
            <div style="font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.3;">${esc(item.descricao)}</div>
          </div>
          ${opcionalBadge}
          <div style="font-size: 16px; font-weight: 800; color: #ffffff; white-space: nowrap;">${fmt(valorTotal)}</div>
        </div>
        ${item.detalhes ? `<div style="padding: 12px 18px; font-size: 10.5px; line-height: 1.6; color: #6b7280; border-bottom: 1px solid #f3f4f6;">${esc(item.detalhes)}</div>` : ''}
        ${showDocsSection ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #f3f4f6; border-bottom: 1px solid #f3f4f6;">
            <div style="padding: 10px 18px; background: #ffffff;">
              <div style="font-size: 7px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Prazo</div>
              <div style="font-size: 10px; color: #374151; font-weight: 500;">${esc(item.prazo || 'A definir')}</div>
            </div>
            <div style="padding: 10px 18px; background: #ffffff;">
              <div style="font-size: 7px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Documentos necessários</div>
              <div style="font-size: 10px; color: #374151; font-weight: 500;">${esc(item.docs_necessarios || '—')}</div>
            </div>
          </div>
        ` : ''}
        ${financialHtml}
      </div>
    `;

    return cardHtml;
  }

  // Generate HTML for every entry, then measure real heights
  const entryHtmls = allEntries.map(e => buildEntryHtml(e));

  const ALTURA_DISPONIVEL = 880; // 1123 - 64(header) - 48(footer) - 48(padding) - 48(section title) - 35(safety)
  const entryHeights: number[] = [];
  for (const html of entryHtmls) {
    entryHeights.push(await medirAlturaReal(html));
  }

  // Paginate based on measured real heights — never split a card
  const itemPageIndices: number[][] = [[]];
  let alturaAcumulada = 0;
  for (let i = 0; i < allEntries.length; i++) {
    if (alturaAcumulada + entryHeights[i] > ALTURA_DISPONIVEL && itemPageIndices[itemPageIndices.length - 1].length > 0) {
      itemPageIndices.push([]);
      alturaAcumulada = 0;
    }
    itemPageIndices[itemPageIndices.length - 1].push(i);
    alturaAcumulada += entryHeights[i];
  }

  // Build page divs from paginated indices
  for (const indices of itemPageIndices) {
    const chunkHtml = indices.map(i => entryHtmls[i]).join('');
    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${header}
        <div style="padding: 24px 36px; box-sizing: border-box;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
          ${chunkHtml}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  // --- PACKAGES PAGE ---
  const validPacotes = d.pacotes.filter(p => p.nome && p.itens_ids.length > 0);
  if (validPacotes.length > 0) {
    let pacotesHtml = '';
    for (const pac of validPacotes) {
      const selected = d.itens.filter(i => pac.itens_ids.includes(i.id));
      const descontoPct = pac.desconto_pct / 100;

      const custoSemDesconto = selected.reduce((s, i) => s + (i.honorario || 0) * i.quantidade, 0);
      const custoComDesconto = custoSemDesconto * (1 - descontoPct);
      const precoSemDesconto = selected.reduce((s, i) => s + ((i.honorario_minimo_contador || i.honorario || 0)) * i.quantidade, 0);
      const precoComDesconto = precoSemDesconto * (1 - descontoPct);
      const margemValor = precoComDesconto - custoComDesconto;
      const margemPct = custoComDesconto > 0 ? ((margemValor / custoComDesconto) * 100).toFixed(0) : '0';
      const taxaMin = selected.reduce((s, i) => s + i.taxa_min, 0);
      const taxaMax = selected.reduce((s, i) => s + i.taxa_max, 0);
      const hasTaxaPac = taxaMin > 0 || taxaMax > 0;

      const itensNomes = selected.map(i => `✓ ${i.ordem}. ${i.descricao}`);

      // MELHORIA A — "RECOMENDADO" badge on Completo package
      const isCompleto = pac.nome.toLowerCase().includes('completo');
      const recomendadoBadge = isCompleto
        ? `<div style="background: #1a4731; color: #ffffff; font-size: 9px; padding: 3px 8px; border-radius: 4px; font-weight: 700;">★ RECOMENDADO</div>`
        : '';
      const pacBorder = isCompleto ? '2px solid #1a4731' : '1px solid #e5e7eb';

      if (!isCliente) {
        pacotesHtml += `
          <div style="border: ${pacBorder}; border-radius: 16px; margin-bottom: 16px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%);">
              <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${esc(pac.nome)}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${recomendadoBadge}
                <span style="font-size: 11px; color: #4ade80; font-weight: 700;">-${pac.desconto_pct}% de desconto</span>
              </div>
            </div>
            <div style="padding: 12px 18px; border-bottom: 1px solid #f3f4f6;">
              ${itensNomes.map(n => `<div style="font-size: 10px; color: #374151; padding: 2px 0;">${esc(n)}</div>`).join('')}
            </div>
            <div style="border-top: 1px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6;">
                <div style="font-size: 7px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">SEU CUSTO TREVO</div>
                <div style="text-align: right; font-size: 11px;">
                  <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px; font-size: 9px;">${fmt(custoSemDesconto)}</span>
                  <span style="font-weight: 700;">${fmt(custoComDesconto)}</span>
                </div>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6; background: #f0fdf4;">
                <div style="font-size: 7px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">SUGESTÃO PARA SEU CLIENTE</div>
                <div style="text-align: right; font-size: 11px;">
                  <span style="text-decoration: line-through; color: #9ca3af; margin-right: 8px; font-size: 9px;">${fmt(precoSemDesconto)}</span>
                  <span style="font-weight: 700; color: #166534;">${fmt(precoComDesconto)}</span>
                </div>
              </div>
              <!-- FIX 2: Margin highlight card -->
              <div style="margin: 14px 18px 10px; padding: 14px 20px; background: #f0fdf4; border: 1.5px solid #4ade80; border-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 10px; font-weight: 600; color: #166534; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">Você ganha com este pacote</div>
                  <div style="font-size: 22px; font-weight: 700; color: #15803d; line-height: 1;">${fmt(margemValor)}</div>
                  <div style="font-size: 11px; color: #4ade80; margin-top: 3px; font-weight: 500;">${margemPct}% de lucro líquido</div>
                </div>
                <div style="width: 52px; height: 52px; background: #dcfce7; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 22px;">💰</div>
              </div>
              ${hasTaxaPac ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 18px; border-bottom: 1px solid #f3f4f6;">
                  <div style="font-size: 7px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #9ca3af;">TAXAS EXTERNAS</div>
                  <div style="font-size: 11px;">${fmt(taxaMin)} a ${fmt(taxaMax)}</div>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 18px; background: #fafafa; border-top: 2px solid #e5e7eb;">
                <div style="font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #1a1a2e;">INVESTIMENTO TOTAL CLIENTE</div>
                <div style="font-size: 13px; font-weight: 800;">${hasTaxaPac ? `${fmt(precoComDesconto + taxaMin)} a ${fmt(precoComDesconto + taxaMax)}` : fmt(precoComDesconto)}</div>
              </div>
            </div>
          </div>
        `;
      } else {
        // CLIENTE MODE
        pacotesHtml += `
          <div style="border: ${pacBorder}; border-radius: 16px; margin-bottom: 16px; overflow: hidden;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
              <span style="font-size: 14px; font-weight: 800; color: #ffffff;">${esc(pac.nome)}</span>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${recomendadoBadge}
                <span style="font-size: 11px; color: #93c5fd; font-weight: 700;">-${pac.desconto_pct}% de desconto</span>
              </div>
            </div>
            <div style="padding: 12px 18px; border-bottom: 1px solid #f3f4f6;">
              ${itensNomes.map(n => `<div style="font-size: 10px; color: #374151; padding: 2px 0;">${esc(n)}</div>`).join('')}
            </div>
            <div style="padding: 12px 18px; background: #fafafa;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                <span style="color: #6b7280;">Investimento sem desconto</span>
                <span style="text-decoration: line-through; color: #94a3b8;">${fmt(precoSemDesconto)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                <span style="color: #1e40af; font-weight: 600;">Investimento com -${pac.desconto_pct}%</span>
                <span style="color: #1e40af; font-weight: 700;">${fmt(precoComDesconto)}</span>
              </div>
              <!-- FIX 8: Economia em reais -->
              <div style="font-size: 10px; color: #15803d; font-weight: 600; text-align: right; margin-top: -4px; margin-bottom: 8px; padding: 0 0;">
                ↓ Economia de ${fmt(precoSemDesconto - precoComDesconto)} com este pacote
              </div>
              ${hasTaxaPac ? `
                <div style="display: flex; justify-content: space-between; padding: 4px 0; font-size: 10px;">
                  <span style="color: #6b7280;">Taxas governamentais estimadas</span>
                  <span style="color: #92400e;">${fmt(taxaMin)} a ${fmt(taxaMax)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 11px;">
                <span style="font-weight: 700; color: #1a1a2e;">INVESTIMENTO TOTAL</span>
                <span style="font-weight: 800; color: #1e40af;">${hasTaxaPac ? `${fmt(precoComDesconto + taxaMin)} a ${fmt(precoComDesconto + taxaMax)}` : fmt(precoComDesconto)}</span>
              </div>
            </div>
          </div>
        `;
      }
    }

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${header}
        <div style="padding: 24px 36px; box-sizing: border-box;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Pacotes Disponíveis</div>
          ${pacotesHtml}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
      </div>
    `);
  }

  // --- TOTALS + CONDITIONS + CTA PAGE ---
  const prazosItens = d.itens.filter(i => i.prazo);
  let prazoHtml = '';
  if (prazosItens.length > 0) {
    const prazoItems = prazosItens.map(i => `
      <div style="display: flex; align-items: baseline; gap: 4px; font-size: 9px; padding: 3px 0;">
        <span style="font-weight: 600; color: #374151; white-space: nowrap;">${esc(shortName(i.descricao))}</span>
        <span style="flex: 1; border-bottom: 1px dotted #d1d5db; min-width: 20px; margin: 0 4px;"></span>
        <span style="font-weight: 500; color: #6b7280; white-space: nowrap;">${esc(i.prazo)}</span>
      </div>
    `).join('');
    prazoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Prazos por Serviço</div>
        ${prazoItems}
        <div style="margin-top: 8px; font-size: 8px; font-style: italic; color: #9ca3af;">Prazo total estimado: execução sequencial, 6 a 12 semanas.</div>
      </div>
    `;
  } else if (d.prazo_execucao) {
    prazoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
        <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
        <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao)}</div>
      </div>
    `;
  }

  // FIX 2 — CTA per mode with contador contact info
  const ctaSection = (!isCliente || pdfMode === 'direto') ? `
    <div style="background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); border-radius: 16px; padding: 24px; text-align: center;">
      <div style="font-size: 11px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
      <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-bottom: 16px;">Para aprovar esta proposta, entre em contato conosco:</div>
      <div style="display: flex; justify-content: center; gap: 24px; font-size: 10px; color: #ffffff;">
        <span>📱 (11) 93492-7001</span>
        <span>✉️ administrativo@trevolegaliza.com.br</span>
        <span>🌐 trevolegaliza.com.br</span>
      </div>
    </div>
  ` : (() => {
    // CLIENTE MODE: show contador contact if available
    if (d.contadorNome) {
      const contactLines: string[] = [];
      if (d.contadorTelefone) contactLines.push(`<div style="font-size: 11px; color: #ffffff; margin-top: 6px;">📱 ${esc(d.contadorTelefone)}</div>`);
      if (d.contadorEmail) contactLines.push(`<div style="font-size: 11px; color: #ffffff; margin-top: 4px;">✉️ ${esc(d.contadorEmail)}</div>`);
      return `
        <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.7); margin-bottom: 12px;">Esta proposta é válida por ${d.validade_dias} dias. Para avançar ou esclarecer dúvidas, entre em contato — estamos prontos para começar.</div>
          <div style="font-size: 14px; font-weight: 700; color: #ffffff; margin-top: 8px;">${esc(d.contadorNome)}</div>
          ${contactLines.join('')}
        </div>
      `;
    }
    // Fallback: generic
    return `
      <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 16px; padding: 24px; text-align: center;">
        <div style="font-size: 11px; font-weight: 700; color: #93c5fd; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Próximo Passo</div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.7);">Esta proposta é válida por ${d.validade_dias} dias. Para avançar ou esclarecer dúvidas, entre em contato com o escritório responsável.</div>
      </div>
    `;
  })();

  // Resumo per mode
  let resumoHtml = '';
  if (!isCliente) {
    const descontoCusto = totalCustoTrevo * (d.desconto_pct / 100);
    const custoFinal = totalCustoTrevo - descontoCusto;
    const descontoPreco = totalPrecoCliente * (d.desconto_pct / 100);
    const precoFinal = totalPrecoCliente - descontoPreco;
    const margemTotal = precoFinal - custoFinal;
    const margemTotalPct = custoFinal > 0 ? (((precoFinal / custoFinal) - 1) * 100).toFixed(0) : '0';

    resumoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
          <span style="color: #64748b;">Seu custo Trevo (honorários)</span>
          <span style="font-weight: 600;">${fmt(totalCustoTrevo)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; background: #f0fdf4; margin: 2px -20px; padding-left: 20px; padding-right: 20px;">
          <span style="color: #166534;">Sugestão para seu cliente (honorários)</span>
          <span style="font-weight: 700; color: #166534;">${fmt(totalPrecoCliente)}</span>
        </div>
        ${d.desconto_pct > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
            <span>Desconto (${d.desconto_pct}%)</span>
            <span style="font-weight: 600;">- ${fmt(descontoPreco)} (cliente) / - ${fmt(descontoCusto)} (custo)</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; background: #eff6ff; margin: 2px -20px; padding-left: 20px; padding-right: 20px;">
          <span style="color: #1e40af;">Sua margem total</span>
          <span style="font-weight: 700; color: #1e40af;">${fmt(margemTotal)} (${margemTotalPct}%)</span>
        </div>
        ${hasTaxas ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Taxas externas estimadas</span>
            <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Investimento Total do Cliente</span>
          <span style="font-size: ${hasTaxas ? '22' : '28'}px; font-weight: 900; color: #166534;">
            ${hasTaxas ? `${fmt(precoFinal + totalTaxaMin)} a ${fmt(precoFinal + totalTaxaMax)}` : fmt(precoFinal)}
          </span>
        </div>
      </div>
    `;
  } else {
    resumoHtml = `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
          <span style="color: #64748b;">Investimento (honorários)</span>
          <span style="font-weight: 600;">${fmt(totalPrecoCliente)}</span>
        </div>
        ${d.desconto_pct > 0 ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
            <span>Desconto (${d.desconto_pct}%)</span>
            <span style="font-weight: 600;">- ${fmt(totalPrecoCliente * d.desconto_pct / 100)}</span>
          </div>
        ` : ''}
        ${hasTaxas ? `
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
            <span style="color: #64748b;">Taxas externas estimadas</span>
            <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
          </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: ${accentBg}; border: 2px solid ${accentBorder}; border-radius: 12px;">
          <span style="font-size: 12px; font-weight: 700; color: ${accentText}; text-transform: uppercase; letter-spacing: 1px;">${hasTaxas ? 'Investimento Total' : 'Total'}</span>
          <span style="font-size: ${hasTaxas ? '22' : '28'}px; font-weight: 900; color: ${accentText};">
            ${hasTaxas ? `${fmt(honorarioFinalCapa + totalTaxaMin)} a ${fmt(honorarioFinalCapa + totalTaxaMax)}` : fmt(honorarioFinalCapa)}
          </span>
        </div>
      </div>
    `;
  }

  pages.push(`
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${header}
      <div style="padding: 24px 36px; box-sizing: border-box;">
        <!-- Totals -->
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Resumo do Investimento</div>
        ${resumoHtml}

        <!-- Conditions -->
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Validade</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${d.validade_dias} dias</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.pagamento || 'A combinar')}</div>
          </div>
        </div>
        ${prazoHtml}
        ${d.observacoes ? `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${esc(d.observacoes)}</div>
          </div>
        ` : ''}

        <!-- Disclaimer -->
        <div style="font-size: 7px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px; padding: 10px; background: #f8fafc; border-radius: 6px;">
          * Taxas governamentais são estimativas baseadas em tabelas vigentes em 2026 e podem sofrer alterações pelos órgãos competentes. Valores de honorários são fixos e não sofrem reajuste durante a execução do projeto.
        </div>

        <!-- CTA -->
        ${ctaSection}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${footer}</div>
    </div>
  `);

  return pages;
}

// FIX: Fresh DOM container per page + image preload + windowWidth
async function renderPageToCanvas(html: string): Promise<HTMLCanvasElement> {
  // 1. Remove any leftover container
  const old = document.getElementById('orcamento-render-container');
  if (old) old.parentNode?.removeChild(old);

  // 2. Create a brand-new element
  const container = document.createElement('div');
  container.id = 'orcamento-render-container';
  container.style.cssText = 'position:absolute;top:-9999px;left:-9999px;width:794px;overflow:hidden;';
  container.innerHTML = html;
  document.body.appendChild(container);

  // 3. Wait for ALL images (logo) to fully load
  const images = container.querySelectorAll('img');
  await Promise.all(Array.from(images).map(img =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        })
  ));

  // 4. Extra reflow wait
  window.scrollTo(0, 0);
  await new Promise(resolve => setTimeout(resolve, 200));

  // 5. Capture with explicit width to guarantee consistent layout
  const el = container.firstElementChild as HTMLElement;
  const canvas = await html2canvas(el, {
    scale: 1.5,
    useCORS: true,
    allowTaint: false,
    logging: false,
    backgroundColor: '#ffffff',
    width: 794,
    windowWidth: 794,
  });

  // 6. Clean up
  document.body.removeChild(container);
  return canvas;
}

export async function gerarOrcamentoPDF(data: OrcamentoPDFData): Promise<Blob> {
  const logo = await preloadLogo();

  const isDetalhado = data.modo === 'detalhado' ||
    data.itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios) ||
    !!(data.contexto && data.contexto.trim());

  if (!isDetalhado) {
    const html = buildSimplesHTML(data, logo);
    const canvas = await renderPageToCanvas(html);
    const doc = new jsPDF('p', 'mm', 'a4');
    addCanvasToDoc(doc, canvas);
    return doc.output('blob');
  }

  const pagesHtml = await buildDetalhadoPages(data, logo);
  const doc = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage();
    const canvas = await renderPageToCanvas(pagesHtml[i]);
    addCanvasToDoc(doc, canvas);
  }

  return doc.output('blob');
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function addCanvasToDoc(doc: jsPDF, canvas: HTMLCanvasElement) {
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/jpeg', 0.82);
  let imgW = pdfW;
  let imgH = (canvas.height / canvas.width) * pdfW;
  if (imgH > pdfH) {
    const scale = pdfH / imgH;
    imgW = pdfW * scale;
    imgH = pdfH;
  }
  const offsetX = (pdfW - imgW) / 2;
  doc.addImage(imgData, 'JPEG', offsetX, 0, imgW, imgH);
}

export { sanitizeFilename };
