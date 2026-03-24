/**
 * Relatório de Performance Societária – TREVO ENGINE V10
 * Layout de elite com master-detail (por processo + sub-tabela de taxas).
 * Fonte única: Code.gs V10 (cores, branding, regra JGVCO).
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

// ── Brand ──
const GREEN = '#4C9F38';
const DARK = '#0f1f0f';
const BG_BLOCK = '#f8fafc';
const BRAND = {
  nome: 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  fantasia: 'TREVO LEGALIZA',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  site: 'trevolegaliza.com',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

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
}

// ── Progressive discount staircase ──
function buildEscadinha(data: ExtratoData): StepInfo[] {
  const valorBase = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;
  const selectedIds = new Set(data.processos.map(p => p.id));

  const sorted = [...data.allCompetencia].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const steps: StepInfo[] = [];
  let stepIdx = 0;

  for (const p of sorted) {
    const isMudancaUF = (p.notas || '').includes('Mudança de UF');
    const notas = p.notas || '';
    const isUrgencia = notas.toLowerCase().includes('urgência') || notas.toLowerCase().includes('urgencia');
    // Manual value: processo.valor exists AND differs from progressive calculation OR notes indicate manual
    const hasManualValue = p.valor != null && p.valor > 0 && (
      notas.includes('Valor Manual') || notas.includes('VALOR MANUAL') ||
      notas.includes('is_manual') || isUrgencia ||
      // If valor doesn't match the base, treat as manual
      Math.abs(p.valor - valorBase) > 1
    );
    const slots = isMudancaUF ? 2 : 1;

    for (let slot = 0; slot < slots; slot++) {
      stepIdx++;

      let valorAtual: number;
      let isManual = false;
      let desconto = 0;

      if (hasManualValue && slot === 0) {
        // PRIORITY 1: Manual value is sovereign - use exactly what was set
        valorAtual = p.valor!;
        isManual = true;
        desconto = 0;
      } else if (isUrgencia && !hasManualValue) {
        // PRIORITY 2: Urgency = +50% on base
        valorAtual = valorBase * 1.5;
        isManual = true;
        desconto = 0;
      } else {
        // PRIORITY 3: Progressive discount
        valorAtual = valorBase;
        if (descPct > 0 && stepIdx > 1) {
          for (let i = 1; i < stepIdx; i++) {
            valorAtual = valorAtual * (1 - descPct / 100);
          }
        }
        if (limite > 0 && valorAtual < limite) valorAtual = limite;
        desconto = valorBase - valorAtual;
      }
      valorAtual = Math.round(valorAtual * 100) / 100;

      steps.push({
        index: stepIdx,
        processo: p,
        valorBase: isManual ? valorAtual : valorBase,
        desconto,
        valorFinal: valorAtual,
        isSelected: selectedIds.has(p.id),
        isMudancaUF: isMudancaUF && slot === 0,
        isManual,
        isUrgencia,
      });
    }
  }
  return steps;
}

// ── Shared constants ──
const MARGIN = 15;

function getContentW(doc: jsPDF) {
  return doc.internal.pageSize.getWidth() - MARGIN * 2;
}

// ── Draw gradient rule ──
function drawGradientRule(doc: jsPDF, y: number) {
  const contentW = getContentW(doc);
  const steps = 80;
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const r = Math.round(76 + (163 - 76) * ratio);
    const g = Math.round(159 + (230 - 159) * ratio);
    const b = Math.round(56 + (53 - 56) * ratio);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(1.2);
    const segW = contentW / steps;
    doc.line(MARGIN + segW * i, y, MARGIN + segW * (i + 1), y);
  }
}

// ── Header (reused on every page) ──
function drawHeader(doc: jsPDF, yStart: number): number {
  const pageW = doc.internal.pageSize.getWidth();

  // Gradient rule at very top
  drawGradientRule(doc, yStart);

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(76, 159, 56);
  doc.text('TREVO LEGALIZA', MARGIN, yStart + 10);

  // Company block right
  const rightX = pageW - MARGIN;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(BRAND.nome, rightX, yStart + 5, { align: 'right' });
  doc.text(`CNPJ ${BRAND.cnpj} • Atuação Nacional`, rightX, yStart + 9, { align: 'right' });
  doc.text(BRAND.endereco, rightX, yStart + 13, { align: 'right' });

  // Second gradient
  drawGradientRule(doc, yStart + 17);

  return yStart + 21;
}

// ── Dark banner ──
function drawBanner(doc: jsPDF, y: number, tag: string, title: string): number {
  const contentW = getContentW(doc);
  doc.setFillColor(15, 31, 15);
  doc.rect(MARGIN, y, contentW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(74, 222, 128);
  doc.text(tag, MARGIN + 5, y + 5);
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(title, MARGIN + 5, y + 11);
  return y + 18;
}

// ── Ensure space, add page if needed ──
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 20) {
    doc.addPage();
    return drawHeader(doc, MARGIN + 2);
  }
  return y;
}

// ═══════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════

export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = getContentW(doc);
  const now = new Date();

  const steps = buildEscadinha(data);
  const selectedSteps = steps.filter(s => s.isSelected);
  const descPct = data.cliente.desconto_progressivo ?? 0;

  const totalHonorarios = selectedSteps.reduce((s, st) => s + st.valorFinal, 0);
  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHonorarios + totalTaxas;
  const economiaMes = steps.reduce((s, st) => s + st.desconto, 0);
  const economiaSelected = selectedSteps.reduce((s, st) => s + st.desconto, 0);

  // ═══════════════════════════════════════════════
  // PAGE 1 — CAPA / RESUMO EXECUTIVO
  // ═══════════════════════════════════════════════
  let y = drawHeader(doc, MARGIN + 2);
  y = drawBanner(doc, y, 'RELATÓRIO DE PERFORMANCE SOCIETÁRIA', 'Extrato de Faturamento');

  // Client info box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, contentW, 28, 2, 2, 'FD');
  doc.setFillColor(76, 159, 56);
  doc.rect(MARGIN, y, 1.2, 28, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(76, 159, 56);
  doc.text('CONTRATANTE', MARGIN + 5, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(data.cliente.nome, MARGIN + 5, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (data.cliente.cnpj) doc.text(`CNPJ: ${data.cliente.cnpj}`, MARGIN + 5, y + 17);
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.text(`Competência: ${mesRef}  •  Emissão: ${now.toLocaleDateString('pt-BR')}`, MARGIN + 5, y + 23);

  // Total on right
  const rightX = pageW - MARGIN - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(76, 159, 56);
  doc.text(fmt(totalGeral), rightX, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('VALOR TOTAL DO EXTRATO', rightX, y + 19, { align: 'right' });
  y += 34;

  // KPI row
  const kpiW = (contentW - 9) / 4;
  const kpis = [
    { label: 'Processos Cobrados', value: String(data.processos.length) },
    { label: 'Total no Mês', value: String(data.allCompetencia.length) },
    { label: 'Valor Base Unitário', value: fmt(data.cliente.valor_base ?? 580) },
    { label: 'Desc. Contratual', value: descPct > 0 ? `${descPct}% progressivo` : 'N/A' },
  ];
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, kpiW, 18, 2, 2, 'FD');
    doc.setFillColor(76, 159, 56);
    doc.rect(x, y, kpiW, 0.8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(76, 159, 56);
    doc.text(kpi.label, x + 4, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(kpi.value, x + 4, y + 14);
  });
  y += 24;

  // ── PERFORMANCE DE ECONOMIA ──
  if (descPct > 0 && steps.length > 0) {
    const progH = Math.min(8 + steps.length * 5.5 + 16, 100);
    y = ensureSpace(doc, y, progH + 4);

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, contentW, progH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.text('PERFORMANCE DE ECONOMIA — PROGRESSÃO NO MÊS', MARGIN + 5, y + 6);

    let py = y + 12;
    const barMaxW = contentW - 60;

    for (const step of steps) {
      if (py > y + progH - 14) break;
      const ratio = step.valorFinal / step.valorBase;
      const barW = barMaxW * ratio;

      // Background
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(MARGIN + 28, py - 2.5, barMaxW, 3.5, 1, 1, 'F');

      // Filled bar
      doc.setFillColor(step.isSelected ? 76 : 148, step.isSelected ? 159 : 163, step.isSelected ? 56 : 184);
      doc.roundedRect(MARGIN + 28, py - 2.5, barW, 3.5, 1, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(step.isSelected ? 22 : 148, step.isSelected ? 101 : 163, step.isSelected ? 52 : 184);
      doc.text(`${step.index}º`, MARGIN + 5, py);

      // Value
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(fmt(step.valorFinal), MARGIN + 28 + barMaxW + 2, py);

      py += 5.5;
    }

    // Economy badge
    if (economiaMes > 0) {
      const badgeY = y + progH - 10;
      doc.setFillColor(76, 159, 56);
      doc.roundedRect(MARGIN + 5, badgeY, contentW - 10, 7, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `ECONOMIA ACUMULADA NO MÊS: ${fmt(economiaMes)}`,
        pageW / 2, badgeY + 4.5, { align: 'center' }
      );
    }

    y += progH + 4;
  }

  // Contacts footer on cover
  y = ensureSpace(doc, y, 16);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, contentW, 12, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${BRAND.site}  •  ${BRAND.email}  •  ${BRAND.telefone}`,
    pageW / 2, y + 7.5, { align: 'center' }
  );

  // ═══════════════════════════════════════════════
  // PAGE 2+ — DETALHAMENTO MASTER-DETAIL
  // ═══════════════════════════════════════════════
  doc.addPage();
  y = drawHeader(doc, MARGIN + 2);
  y = drawBanner(doc, y, 'DETALHAMENTO UNITÁRIO', 'Honorários e Taxas por Processo');

  // For each selected process, render a box + sub-table of taxes
  for (let pi = 0; pi < selectedSteps.length; pi++) {
    const step = selectedSteps[pi];
    const p = step.processo;
    const pTaxas = data.valoresAdicionais[p.id] || [];
    const boxH = 22;
    const taxTableH = pTaxas.length > 0 ? 8 + pTaxas.length * 6.5 : 0;
    const totalNeeded = boxH + taxTableH + 8;

    y = ensureSpace(doc, y, totalNeeded);

    // Process box with green left border
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, contentW, boxH, 2, 2, 'FD');
    doc.setFillColor(76, 159, 56);
    doc.rect(MARGIN, y, 1.5, boxH, 'F');

    // Process number badge
    doc.setFillColor(26, 58, 26);
    doc.roundedRect(MARGIN + 5, y + 3, 14, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(74, 222, 128);
    doc.text(`${step.index}º`, MARGIN + 12, y + 8, { align: 'center' });

    // Service name
    const tipo = p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1);
    let serviceName = `${tipo} — ${p.razao_social}`;
    if (step.isMudancaUF) serviceName += ' (Mudança de UF - 2 vagas)';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(serviceName, MARGIN + 22, y + 8, { maxWidth: contentW - 70 });

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(`Data: ${fmtDate(p.created_at)}`, MARGIN + 22, y + 14);

    // Discount info
    if (step.desconto > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(22, 101, 52);
      doc.text(`Desc. Progressivo: -${fmt(step.desconto)}`, MARGIN + 22, y + 19);
    }

    // Value on the right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(76, 159, 56);
    doc.text(fmt(step.valorFinal), pageW - MARGIN - 5, y + 10, { align: 'right' });

    // Base value reference if discounted
    if (step.desconto > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Base: ${fmt(step.valorBase)}`, pageW - MARGIN - 5, y + 16, { align: 'right' });
    }

    y += boxH + 1;

    // Sub-table: Taxas vinculadas a este processo
    if (pTaxas.length > 0) {
      const taxRows = pTaxas.map(va => [
        fmtDate(va.created_at),
        va.descricao,
        fmt(Number(va.valor)),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descrição da Taxa', 'Valor']],
        body: taxRows,
        theme: 'grid',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [100, 116, 139],
          fontSize: 6.5,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [30, 41, 59],
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          2: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] },
        },
        margin: { left: MARGIN + 6, right: MARGIN },
        tableWidth: contentW - 6,
      });

      y = (doc as any).lastAutoTable.finalY + 2;
    }

    y += 4;
  }

  // ── Non-selected (contabilizado) summary ──
  const nonSelected = steps.filter(s => !s.isSelected);
  if (nonSelected.length > 0) {
    y = ensureSpace(doc, y, 20 + nonSelected.length * 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('PROCESSOS CONTABILIZADOS (JÁ FATURADOS ANTERIORMENTE)', MARGIN, y);
    y += 4;

    const contabRows = nonSelected.map(s => {
      const tipo = s.processo.tipo.charAt(0).toUpperCase() + s.processo.tipo.slice(1);
      return [`${s.index}º`, fmtDate(s.processo.created_at), `${tipo} — ${s.processo.razao_social}`, fmt(s.valorFinal)];
    });

    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Data', 'Descrição', 'Valor Progressivo']],
      body: contabRows,
      theme: 'grid',
      headStyles: { fillColor: [226, 232, 240], textColor: [148, 163, 184], fontSize: 6.5 },
      bodyStyles: { fontSize: 7, textColor: [148, 163, 184], fontStyle: 'italic' },
      columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 3: { halign: 'right' } },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── TOTALIZADOR FINAL ──
  y = ensureSpace(doc, y, 40);

  // Subtotals
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, contentW, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal Honorários:', MARGIN + 5, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(fmt(totalHonorarios), pageW / 2 - 5, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Subtotal Taxas Reembolsáveis:', MARGIN + 5, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(fmt(totalTaxas), pageW / 2 - 5, y + 14, { align: 'right' });

  // Economy on right side
  if (economiaSelected > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.text('Economia neste extrato:', pageW / 2 + 10, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.text(fmt(economiaSelected), pageW - MARGIN - 5, y + 7, { align: 'right' });
  }

  y += 24;

  // Total bar
  doc.setFillColor(15, 31, 15);
  doc.roundedRect(MARGIN, y, contentW, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(74, 222, 128);
  doc.text('TOTAL GERAL', MARGIN + 6, y + 7);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(fmt(totalGeral), pageW - MARGIN - 6, y + 12, { align: 'right' });
  y += 22;

  // Discount rule note
  if (descPct > 0) {
    y = ensureSpace(doc, y, 16);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(22, 101, 52);
    doc.text('REGRA DE DESCONTO PROGRESSIVO (CLÁUSULA CONTRATUAL)', MARGIN + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Desconto composto de ${descPct}% a cada processo na mesma competência mensal. ` +
      `No mês seguinte, o valor retorna ao valor base de ${fmt(data.cliente.valor_base ?? 580)}.` +
      (data.cliente.valor_limite_desconto ? ` Limite mínimo: ${fmt(data.cliente.valor_limite_desconto)}.` : ''),
      MARGIN + 4, y + 10
    );
  }

  // ── Attachment pages ──
  await renderAttachmentPages(doc, data);

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(76, 159, 56);
    doc.setLineWidth(0.4);
    doc.line(MARGIN, pageH - 12, pageW - MARGIN, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `${BRAND.fantasia} — Extrato gerado em ${now.toLocaleDateString('pt-BR')} — Página ${i}/${totalPages}`,
      pageW / 2, pageH - 7, { align: 'center' }
    );
  }

  return doc;
}

// ── Render attachment images as extra pages ──
async function renderAttachmentPages(doc: jsPDF, data: ExtratoData) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = getContentW(doc);

  const attachments: { label: string; url: string }[] = [];

  for (const p of data.processos) {
    const lanc = p.lancamento;
    if (lanc?.boleto_url) attachments.push({ label: `Boleto — ${p.razao_social}`, url: lanc.boleto_url });
    if (lanc?.url_recibo_taxa) attachments.push({ label: `Guia/Recibo Taxa — ${p.razao_social}`, url: lanc.url_recibo_taxa });
    if (lanc?.comprovante_url) attachments.push({ label: `Comprovante — ${p.razao_social}`, url: lanc.comprovante_url });
  }

  const allVAs = Object.values(data.valoresAdicionais).flat();
  for (const va of allVAs) {
    if (va.comprovante_url) attachments.push({ label: `Comprovante de Taxa — ${va.descricao}`, url: va.comprovante_url });
    if (va.anexo_url) attachments.push({ label: `Anexo — ${va.descricao}`, url: va.anexo_url });
  }

  if (attachments.length === 0) return;

  for (const att of attachments) {
    try {
      const imgData = await loadImageAsBase64(att.url);
      if (!imgData) continue;

      doc.addPage();
      doc.setFillColor(15, 31, 15);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(74, 222, 128);
      doc.text('ANEXO', MARGIN, 6);
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(att.label, MARGIN, 11);

      doc.addImage(imgData, 'JPEG', MARGIN, 20, contentW, pageH - 40, undefined, 'FAST');
    } catch {
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Anexo não disponível: ${att.label}`, MARGIN, 30);
    }
  }
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Data fetchers ──

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
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from('processos')
    .select('*, cliente:clientes(*)')
    .eq('cliente_id', clienteId)
    .gte('created_at', firstDay)
    .lte('created_at', lastDay)
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
