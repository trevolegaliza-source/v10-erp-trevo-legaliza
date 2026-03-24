/**
 * Relatório de Performance Societária — TREVO ENGINE V16 (HTML2CANVAS)
 * Renders a pixel-perfect HTML template via html2canvas → jsPDF.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

// ═══ BRAND ═══
const BRAND = {
  nome: 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  fantasia: 'TREVO LEGALIZA',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
};

const LOGO_URL = 'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

// ═══ INTERFACES ═══
export interface ExtratoData {
  processos: ProcessoFinanceiro[];
  allCompetencia: ProcessoFinanceiro[];
  valoresAdicionais: Record<string, ValorAdicional[]>;
  cliente: {
    nome: string;
    cnpj: string | null;
    apelido: string | null;
    valor_base: number | null;
    desconto_progressivo: number | null;
    valor_limite_desconto: number | null;
  };
}

interface StepInfo {
  index: number;
  processo: ProcessoFinanceiro;
  valorBase: number;
  desconto: number;
  valorFinal: number;
  isSelected: boolean;
  isMudancaUF: boolean;
  isManual: boolean;
  isUrgencia: boolean;
  label: string;
}

// ═══ JGVCO LOGIC ═══
function buildEscadinha(data: ExtratoData): StepInfo[] {
  const base = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;
  const selectedIds = new Set(data.processos.map(p => p.id));

  const sorted = [...data.allCompetencia].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const steps: StepInfo[] = [];
  let slot = 0;

  for (const p of sorted) {
    const notas = (p.notas || '').toLowerCase();
    const isMudancaUF = notas.includes('mudança de uf') || notas.includes('mudanca de uf');
    const isUrgencia = notas.includes('urgência') || notas.includes('urgencia');
    const notasRaw = p.notas || '';
    const hasManualFlag = notasRaw.includes('Valor Manual') || notasRaw.includes('VALOR MANUAL')
      || notasRaw.includes('is_manual') || notasRaw.includes('IS_MANUAL');

    const slotsCount = isMudancaUF ? 2 : 1;

    for (let s = 0; s < slotsCount; s++) {
      slot++;
      let valorFinal: number;
      let desconto = 0;
      let isManual = false;
      let label = '';

      if (hasManualFlag && s === 0) {
        valorFinal = Number(p.valor) || base;
        isManual = true;
        label = 'VALOR MANUAL';
      } else if (isUrgencia && !hasManualFlag && s === 0) {
        valorFinal = base * 1.5;
        isManual = true;
        label = 'MÉTODO TREVO / URGÊNCIA';
      } else {
        valorFinal = base;
        if (descPct > 0 && slot > 1) {
          for (let i = 1; i < slot; i++) {
            valorFinal = valorFinal * (1 - descPct / 100);
          }
        }
        if (limite > 0 && valorFinal < limite) valorFinal = limite;
        desconto = base - valorFinal;
      }

      valorFinal = Math.round(valorFinal * 100) / 100;

      steps.push({
        index: slot, processo: p, valorBase: isManual ? valorFinal : base,
        desconto: Math.round(desconto * 100) / 100, valorFinal,
        isSelected: selectedIds.has(p.id), isMudancaUF: isMudancaUF && s === 0,
        isManual, isUrgencia, label,
      });
    }
  }
  return steps;
}

// ═══ HTML BUILDERS ═══
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body, div, span, p, td, th { font-family: 'DM Sans', sans-serif; }
  .page { width: 794px; min-height: 1123px; background: #ffffff; position: relative; overflow: hidden; }
  .stripe-top { width: 100%; height: 5px; background: #1a3a1a; }
  .header { display: flex; justify-content: space-between; align-items: center; padding: 10px 30px; border-bottom: 1px solid #e2e8f0; background: #fff; }
  .header-logo img { width: 208px; height: auto; object-fit: contain; display: block; }
  .header-right { text-align: right; }
  .header-right .line1 { font-size: 9px; font-weight: 700; color: #64748b; }
  .header-right .line2 { font-size: 9px; font-weight: 500; color: #64748b; }
  .gradient-bar { width: 100%; height: 3px; background: linear-gradient(90deg, #4C9F38 0%, #a3e635 100%); }
  .client-block { background: #0f1f0f; padding: 20px 30px; }
  .client-tag { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
  .client-name { font-size: 26px; font-weight: 800; color: #ffffff; line-height: 1.2; }
  .client-cnpj { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
  .client-meta { font-size: 10px; color: #94a3b8; margin-top: 4px; }
  .fin-section { padding: 22px 30px 0 30px; }
  .total-card { background: linear-gradient(135deg, #0f1f0f, #1a3a1a); border-radius: 8px; padding: 20px; text-align: center; }
  .total-tag { font-size: 8px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .total-label { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; }
  .total-prefix { font-size: 15px; color: #94a3b8; font-weight: 500; }
  .total-value { font-size: 42px; font-weight: 800; color: #ffffff; letter-spacing: -1px; line-height: 1.1; }
  .total-ctx { font-size: 9px; color: #94a3b8; margin-top: 4px; }
  .kpi-row { display: flex; gap: 12px; margin-top: 14px; }
  .kpi-card { flex: 1; background: #f8fafc; border: 2px solid #e2e8f0; border-top: 4px solid #4C9F38; border-radius: 0 0 5px 5px; padding: 12px; }
  .kpi-card.eco { background: #4C9F38; border-color: #4C9F38; }
  .kpi-label { font-size: 8px; font-weight: 700; color: #4C9F38; text-transform: uppercase; }
  .kpi-card.eco .kpi-label { color: #ffffff; }
  .kpi-value { font-size: 14px; font-weight: 800; color: #1a1a2e; margin-top: 2px; }
  .kpi-card.eco .kpi-value { color: #ffffff; }
  .vol-block { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; margin-top: 12px; border-radius: 4px; }
  .vol-text { font-size: 9px; color: #64748b; line-height: 1.5; }
  .footer-contact { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 10px 30px; text-align: center; font-size: 9px; color: #94a3b8; position: absolute; bottom: 30px; left: 0; right: 0; }
  .gradient-bottom { position: absolute; bottom: 20px; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #4C9F38 0%, #a3e635 100%); }
  .page-footer { position: absolute; bottom: 4px; left: 30px; right: 30px; display: flex; justify-content: space-between; font-size: 8px; color: #94a3b8; }
  .transparency-note { margin-top: 8px; padding: 7px 14px; background: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 0 3px 3px 0; }
  .transparency-note p { font-size: 7px; color: #78350f; font-style: italic; line-height: 1.4; }
  /* Progression bar */
  .prog-bar { display: flex; align-items: center; margin-top: 14px; margin-bottom: 12px; gap: 0; }
  .prog-step { flex: 1; padding: 10px 14px; border-radius: 5px; text-align: center; position: relative; }
  .prog-step.active { background: #1a3a1a; }
  .prog-step.next { background: #f0fdf4; border: 2px dashed #86efac; }
  .prog-step .ps-label { font-size: 8px; font-weight: 700; color: #ffffff; }
  .prog-step.next .ps-label { color: #166534; }
  .prog-step .ps-value { font-size: 12px; font-weight: 800; color: #4ade80; margin-top: 2px; }
  .prog-step.next .ps-value { color: #166534; }
  .prog-step .ps-desc { font-size: 7px; color: rgba(255,255,255,0.5); margin-top: 1px; }
  .prog-step.next .ps-desc { color: #64748b; }
  .prog-step .ps-next-label { font-size: 7px; font-weight: 700; color: #4C9F38; text-transform: uppercase; margin-top: 3px; }
  .prog-step .ps-limit { display: inline-block; font-size: 6px; background: #f59e0b; color: white; padding: 1px 5px; border-radius: 2px; margin-top: 3px; }
  .prog-arrow { width: 16px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .prog-arrow svg { width: 10px; height: 10px; }
  /* Page 2 */
  .section-banner { background: #0f1f0f; padding: 12px 30px; }
  .section-banner-text { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; }
  .process-card { background: #ffffff; border: 1px solid #e2e8f0; border-left: 4px solid #4C9F38; margin-bottom: 14px; overflow: hidden; }
  .process-header { background: #0f1f0f; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
  .ph-left { display: flex; align-items: center; gap: 10px; flex: 1; }
  .ph-badge { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #4C9F38; color: white; border-radius: 4px; font-size: 10px; font-weight: 800; text-align: center; line-height: 1; flex-shrink: 0; }
  .ph-info { flex: 1; }
  .ph-title { font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; }
  .ph-date { font-size: 8px; color: rgba(255,255,255,0.5); margin-top: 2px; }
  .ph-discount { font-size: 8px; color: #4ade80; margin-top: 1px; }
  .ph-right { text-align: right; }
  .ph-value { font-size: 18px; font-weight: 800; color: #ffffff; }
  .ph-base { font-size: 8px; color: rgba(255,255,255,0.4); }
  .manual-badge { display: inline-block; background: #f59e0b; color: #ffffff; font-size: 7px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; margin-left: 6px; }
  .tax-table { width: 100%; border-collapse: collapse; }
  .tax-table th { background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; padding: 5px 8px; text-align: left; }
  .tax-table th:last-child { text-align: right; }
  .tax-table td { font-size: 9px; padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
  .tax-table tr:nth-child(even) td { background: #f8fafc; }
  .tax-table .td-date { color: #64748b; }
  .tax-table .td-desc { color: #334155; font-weight: 500; }
  .tax-table .td-val { text-align: right; color: #1a1a2e; font-weight: 700; }
  .tax-table .td-val .prefix { color: #64748b; }
  .subtotal-row { background: #f8fafc; border-top: 2px solid #e2e8f0; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; }
  .subtotal-calc { font-size: 9px; font-weight: 500; color: #64748b; }
  .subtotal-result { font-size: 13px; font-weight: 800; color: #0f1f0f; background: #f0fdf4; border: 1px solid #dcfce7; padding: 4px 12px; border-radius: 4px; }
  .prog-block { background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: 5px; padding: 12px; margin-top: 14px; }
  .prog-title { font-size: 9px; font-weight: 700; color: #166534; text-transform: uppercase; margin-bottom: 8px; }
  .prog-table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .prog-table th { background: #166534; color: white; font-weight: 700; padding: 5px 8px; font-size: 8px; text-align: center; }
  .prog-table td { padding: 4px 8px; text-align: center; border: 1px solid #dcfce7; background: white; }
  .prog-table tr:nth-child(even) td { background: #f0fdf4; }
  .prog-table .val { font-weight: 700; color: #166534; }
  .prog-table .desc { color: #166534; }
  .prog-table .status { font-size: 8px; color: #64748b; }
  .prog-table .limite td { background: #dcfce7; font-weight: 700; }
  .prog-table .limite .status { color: #166534; }
  .prog-legal { font-size: 8px; color: #166534; line-height: 1.4; margin-top: 8px; }
  .total-geral-card { margin-top: 16px; background: linear-gradient(135deg, #0f1f0f, #1a3a1a); border-radius: 8px; padding: 18px; text-align: center; }
  .tg-tag { font-size: 9px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 1px; }
  .tg-value { font-size: 42px; font-weight: 800; color: #ffffff; letter-spacing: -1px; margin-top: 4px; }
  .tax-area { padding: 12px 16px; }
`;

function buildHeaderHTML(logoDataUrl: string | null): string {
  const logoHtml = logoDataUrl
    ? `<div class="header-logo"><img src="${logoDataUrl}" alt="Trevo Legaliza" /></div>`
    : `<div class="header-logo" style="font-size:12px;font-weight:800;color:#4C9F38;">TREVO LEGALIZA</div>`;
  return `
    <div class="stripe-top"></div>
    <div class="header">
      ${logoHtml}
      <div class="header-right">
        <div class="line1">${BRAND.nome}</div>
        <div class="line2">CNPJ ${BRAND.cnpj} • Atuação Nacional</div>
      </div>
    </div>
    <div class="gradient-bar"></div>
  `;
}

function buildPage1HTML(data: ExtratoData, steps: StepInfo[], selected: StepInfo[], logoDataUrl: string | null): string {
  const now = new Date();
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const emissao = now.toLocaleDateString('pt-BR');
  const mesNum = String(now.getMonth() + 1).padStart(2, '0');

  const totalHon = selected.reduce((s, st) => s + st.valorFinal, 0);
  const totalTaxas = Object.values(data.valoresAdicionais).flat().reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHon + totalTaxas;
  const economia = steps.filter(s => !s.isManual).reduce((s, st) => s + st.desconto, 0);
  const descPct = data.cliente.desconto_progressivo ?? 0;

  return `
    <div class="page" id="page1">
      ${buildHeaderHTML(logoDataUrl)}
      <div class="client-block">
        <div class="client-tag">EXTRATO DE FATURAMENTO</div>
        <div class="client-name">${data.cliente.nome}</div>
        ${data.cliente.cnpj ? `<div class="client-cnpj">${data.cliente.cnpj}</div>` : ''}
        <div class="client-meta">Relatório de Performance: 01/${mesNum}/${now.getFullYear()} até ${emissao}</div>
        <div class="client-meta">Emissão: ${emissao} • ${data.processos.length} processo(s) cobrado(s)</div>
      </div>

      <div class="fin-section">
        <div class="total-card">
          <div class="total-tag">HONORÁRIOS DO PROCESSO</div>
          <div class="total-label">TOTAL</div>
          <div class="total-value"><span class="total-prefix">R$ </span>${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          <div class="total-ctx">${selected.length} processo(s) • Competência ${mesRef}</div>
        </div>

        <div class="kpi-row">
          <div class="kpi-card">
            <div class="kpi-label">SUBTOTAL HONORÁRIOS</div>
            <div class="kpi-value">${fmt(totalHon)}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-label">SUBTOTAL TAXAS</div>
            <div class="kpi-value">${fmt(totalTaxas)}</div>
          </div>
          <div class="kpi-card eco">
            <div class="kpi-label">ECONOMIA NO MÊS</div>
            <div class="kpi-value">${economia > 0 ? fmt(economia) : 'N/A'}</div>
          </div>
        </div>

        <div class="vol-block">
          <div class="vol-text">Volume Acumulado (01/${mesNum} até ${emissao}): ${data.allCompetencia.length} processo(s)</div>
          <div class="vol-text">Valor Base: ${fmt(data.cliente.valor_base ?? 580)} • Desc. Contratual: ${descPct > 0 ? descPct + '% progressivo' : 'N/A'}</div>
        </div>
      </div>

      <div class="footer-contact">${BRAND.email} • ${BRAND.telefone} • trevolegaliza.com</div>
      <div class="gradient-bottom"></div>
      <div class="page-footer">
        <span>${BRAND.fantasia} • ${BRAND.cnpj} • ${BRAND.endereco}</span>
        <span>PÁGINA 1 DE {TOTAL_PAGES}</span>
      </div>
    </div>
  `;
}

function buildPage2HTML(data: ExtratoData, steps: StepInfo[], selected: StepInfo[], logoDataUrl: string | null, totalPages: number): string {
  const totalHon = selected.reduce((s, st) => s + st.valorFinal, 0);
  const totalTaxas = Object.values(data.valoresAdicionais).flat().reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHon + totalTaxas;
  const descPct = data.cliente.desconto_progressivo ?? 0;

  let processCardsHTML = '';
  for (const step of selected) {
    const p = step.processo;
    const pTaxas = data.valoresAdicionais[p.id] || [];
    const taxTotal = pTaxas.reduce((s, va) => s + Number(va.valor), 0);
    const blockTotal = step.valorFinal + taxTotal;

    let discountLine = '';
    if (!step.isManual && step.desconto > 0) {
      discountLine = `<div class="ph-discount">Desc. progressivo: -${fmt(step.desconto)}</div>`;
    }

    let manualBadge = '';
    if (step.isManual && step.label) {
      manualBadge = `<span class="manual-badge">${step.label}</span>`;
    }

    let baseRef = '';
    if (!step.isManual && step.desconto > 0) {
      baseRef = `<div class="ph-base">Base: ${fmt(step.valorBase)}</div>`;
    }

    let taxTableHTML = '';
    if (pTaxas.length > 0) {
      const rows = pTaxas.map((va, i) => `
        <tr>
          <td class="td-date">${fmtDate(va.created_at)}</td>
          <td class="td-desc">${va.descricao}</td>
          <td class="td-val"><span class="prefix">R$ </span>${Number(va.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        </tr>
      `).join('');

      taxTableHTML = `
        <div class="tax-area">
          <table class="tax-table">
            <thead><tr><th>Data</th><th>Taxa / Reembolso</th><th>Valor</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="subtotal-row">
          Subtotal: ${fmt(step.valorFinal)} (Hon.) + ${fmt(taxTotal)} (Taxas) = <span class="bold">${fmt(blockTotal)}</span>
        </div>
      `;
    }

    processCardsHTML += `
      <div class="process-card" style="page-break-inside: avoid;">
        <div class="process-header">
          <div class="ph-left">
            <div class="ph-badge">${step.index}º</div>
            <div class="ph-info">
              <div class="ph-title">${p.tipo.toUpperCase()} — ${p.razao_social}${manualBadge}</div>
              <div class="ph-date">${fmtDate(p.created_at)}</div>
              ${discountLine}
            </div>
          </div>
          <div class="ph-right">
            <div class="ph-value">${fmt(step.valorFinal)}</div>
            ${baseRef}
          </div>
        </div>
        ${taxTableHTML}
      </div>
    `;
  }

  // Progressão table
  let progHTML = '';
  if (descPct > 0 && steps.length > 0) {
    const progRows = steps.map(s => {
      let status = '—';
      let desc = '—';
      const isLimite = data.cliente.valor_limite_desconto && s.valorFinal <= (data.cliente.valor_limite_desconto ?? 0);
      if (s.isManual) {
        status = s.label || 'Valor Manual';
      } else if (s.desconto > 0) {
        desc = `-${descPct}%`;
        status = isLimite ? 'Limite atingido' : 'Desconto acumulado';
      }
      return `<tr class="${isLimite ? 'limite' : ''}">
        <td>${s.index}º</td>
        <td class="val">${fmt(s.valorFinal)}</td>
        <td class="desc">${desc}</td>
        <td class="status">${status}</td>
      </tr>`;
    }).join('');

    const legalText = `Regra: Desconto composto de ${descPct}% a cada processo na mesma competência mensal${
      data.cliente.valor_limite_desconto ? `, limite mínimo ${fmt(data.cliente.valor_limite_desconto)}` : ''
    }. No mês seguinte, retorna ao valor base.`;

    progHTML = `
      <div class="prog-block">
        <div class="prog-title">PROGRESSÃO DE INCENTIVO POR VOLUME</div>
        <table class="prog-table">
          <thead><tr><th>Proc.</th><th>Valor</th><th>Desc.</th><th>Status</th></tr></thead>
          <tbody>${progRows}</tbody>
        </table>
        <div class="prog-legal">${legalText}</div>
      </div>
    `;
  }

  return `
    <div class="page" id="page2">
      ${buildHeaderHTML(logoDataUrl)}
      <div class="section-banner">
        <div class="section-banner-text">DETALHAMENTO UNITÁRIO — HONORÁRIOS E TAXAS</div>
      </div>

      <div style="padding: 16px 30px;">
        ${processCardsHTML}
        ${progHTML}
        <div class="total-geral-card">
          <div class="tg-tag">TOTAL GERAL</div>
          <div class="tg-value"><span class="total-prefix">R$ </span>${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div class="gradient-bottom"></div>
      <div class="page-footer">
        <span>${BRAND.fantasia} • ${BRAND.cnpj} • ${BRAND.endereco}</span>
        <span>PÁGINA 2 DE ${totalPages}</span>
      </div>
    </div>
  `;
}

// ═══ RENDER ENGINE ═══
async function renderPageToCanvas(html: string, styles: string): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 at 96dpi
  container.innerHTML = `<style>${styles}</style>${html}`;
  document.body.appendChild(container);

  // Wait for fonts and images to load
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 300));

  const pageEl = container.querySelector('.page') as HTMLElement;
  const canvas = await html2canvas(pageEl, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    allowTaint: true,
  });

  document.body.removeChild(container);
  return canvas;
}

// ═══ LOGO PRELOADER ═══
let _logoData: string | null = null;
async function preloadLogo(): Promise<string | null> {
  if (_logoData) return _logoData;
  try {
    const r = await fetch(LOGO_URL, { mode: 'cors' });
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => { _logoData = fr.result as string; res(_logoData); };
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ═══ MAIN EXPORT ═══
export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  // Ensure DM Sans is loaded
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap';
  document.head.appendChild(fontLink);
  await new Promise(r => setTimeout(r, 500));
  await document.fonts.ready;

  const logoDataUrl = await preloadLogo();

  const steps = buildEscadinha(data);
  const selected = steps.filter(s => s.isSelected);

  // Determine total pages (2 base + attachments)
  const attCount = countAttachments(data);
  const totalPages = 2 + attCount;

  // Page 1
  const page1Html = buildPage1HTML(data, steps, selected, logoDataUrl).replace('{TOTAL_PAGES}', String(totalPages));
  const canvas1 = await renderPageToCanvas(page1Html, GLOBAL_STYLES);

  // Page 2
  const page2Html = buildPage2HTML(data, steps, selected, logoDataUrl, totalPages);
  const canvas2 = await renderPageToCanvas(page2Html, GLOBAL_STYLES);

  // Create PDF
  const doc = new jsPDF('p', 'mm', 'a4');
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();

  // Add page 1
  const img1 = canvas1.toDataURL('image/png');
  doc.addImage(img1, 'PNG', 0, 0, pdfW, pdfH);

  // Add page 2
  doc.addPage();
  const img2 = canvas2.toDataURL('image/png');
  doc.addImage(img2, 'PNG', 0, 0, pdfW, pdfH);

  // Attachments
  await renderAttachments(doc, data, totalPages);

  return doc;
}

function countAttachments(data: ExtratoData): number {
  let count = 0;
  for (const p of data.processos) {
    const l = p.lancamento;
    if (l?.boleto_url) count++;
    if (l?.url_recibo_taxa) count++;
    if (l?.comprovante_url) count++;
  }
  const allVAs = Object.values(data.valoresAdicionais).flat();
  for (const va of allVAs) {
    if (va.comprovante_url) count++;
    if (va.anexo_url) count++;
  }
  return count;
}

async function renderAttachments(doc: jsPDF, data: ExtratoData, totalPages: number) {
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();

  const atts: { label: string; url: string }[] = [];
  for (const p of data.processos) {
    const l = p.lancamento;
    if (l?.boleto_url) atts.push({ label: `Boleto — ${p.razao_social}`, url: l.boleto_url });
    if (l?.url_recibo_taxa) atts.push({ label: `Guia/Recibo Taxa — ${p.razao_social}`, url: l.url_recibo_taxa });
    if (l?.comprovante_url) atts.push({ label: `Comprovante — ${p.razao_social}`, url: l.comprovante_url });
  }
  const allVAs = Object.values(data.valoresAdicionais).flat();
  for (const va of allVAs) {
    if (va.comprovante_url) atts.push({ label: `Comprovante — ${va.descricao}`, url: va.comprovante_url });
    if (va.anexo_url) atts.push({ label: `Anexo — ${va.descricao}`, url: va.anexo_url });
  }

  let pageNum = 3;
  for (const att of atts) {
    try {
      const imgData = await loadImageBase64(att.url);
      if (!imgData) continue;

      const attHtml = `
        <div class="page">
          <div class="stripe-top"></div>
          <div style="background:#0f1f0f;padding:10px 30px;">
            <div style="font-size:8px;font-weight:700;color:#4ade80;text-transform:uppercase;letter-spacing:1px;">ANEXO DE COMPROVANTE</div>
            <div style="font-size:11px;font-weight:700;color:#ffffff;margin-top:4px;">${att.label}</div>
          </div>
          <div class="gradient-bar"></div>
          <div style="padding:16px 30px;text-align:center;">
            <img src="${imgData}" style="max-width:100%;max-height:900px;object-fit:contain;" />
          </div>
          <div class="gradient-bottom"></div>
          <div class="page-footer">
            <span>${BRAND.fantasia} • ${BRAND.cnpj} • ${BRAND.endereco}</span>
            <span>PÁGINA ${pageNum} DE ${totalPages}</span>
          </div>
        </div>
      `;

      const canvas = await renderPageToCanvas(attHtml, GLOBAL_STYLES);
      doc.addPage();
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfW, pdfH);
      pageNum++;
    } catch {
      // Skip failed attachments
    }
  }
}

async function loadImageBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => res(fr.result as string);
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ═══ DATA FETCHERS ═══
export async function fetchValoresAdicionaisMulti(processoIds: string[]): Promise<Record<string, ValorAdicional[]>> {
  const { data, error } = await supabase
    .from('valores_adicionais')
    .select('*')
    .in('processo_id', processoIds)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const map: Record<string, ValorAdicional[]> = {};
  (data || []).forEach((va: any) => {
    if (!map[va.processo_id]) map[va.processo_id] = [];
    map[va.processo_id].push(va);
  });
  return map;
}

export async function fetchCompetenciaProcessos(clienteId: string): Promise<ProcessoFinanceiro[]> {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('processos')
    .select('*, cliente:clientes(*)')
    .eq('cliente_id', clienteId)
    .gte('created_at', first)
    .lte('created_at', last)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const ids = (data || []).map((p: any) => p.id);
  const { data: lancs } = await supabase
    .from('lancamentos')
    .select('*')
    .eq('tipo', 'receber')
    .in('processo_id', ids);

  const lancMap = new Map<string, any>();
  (lancs || []).forEach((l: any) => {
    if (!lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l);
  });

  return (data || []).map((p: any) => ({
    ...p,
    lancamento: lancMap.get(p.id) || null,
    etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
  }));
}
