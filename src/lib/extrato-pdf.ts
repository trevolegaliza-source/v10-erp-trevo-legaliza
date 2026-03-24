/**
 * Relatório de Performance Societária — TREVO ENGINE V16
 * REESCRITA TOTAL. Regras invioláveis:
 * 1. Valor Manual/Urgência → SOBERANO (sem progressão)
 * 2. Progressão -5% cumulativa apenas para processos sem override
 * 3. Estética: Header verde escuro, cards brancos limpos, valores gigantes
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// ═══ COLORS ═══
const C = {
  GREEN:     [76, 159, 56] as const,   // #4C9F38
  DARK:      [15, 31, 15] as const,    // #0f1f0f
  WHITE:     [255, 255, 255] as const,
  BLACK:     [0, 0, 0] as const,
  SLATE:     [100, 116, 139] as const, // #64748b
  DARK_TEXT: [30, 41, 59] as const,    // #1e293b
  BG:        [248, 250, 252] as const, // #f8fafc
  BORDER:    [226, 232, 240] as const, // #e2e8f0
  GREEN_LT:  [240, 253, 244] as const,
  ORANGE:    [234, 88, 12] as const,   // #ea580c
  GREEN_ACC: [74, 222, 128] as const,
  LIME:      [163, 230, 53] as const,
};

const M = 15; // margin

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
  label: string; // display label for badge
}

// ═══ JGVCO LOGIC ═══
// Priority: 1) Manual value (SOVEREIGN) 2) Urgência (+50%) 3) Progressive -5%
function buildEscadinha(data: ExtratoData): StepInfo[] {
  const base = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;
  const selectedIds = new Set(data.processos.map(p => p.id));

  const sorted = [...data.allCompetencia].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const steps: StepInfo[] = [];
  let slot = 0; // progressive position counter

  for (const p of sorted) {
    const notas = (p.notas || '').toLowerCase();
    const isMudancaUF = notas.includes('mudança de uf') || notas.includes('mudanca de uf');
    const isUrgencia = notas.includes('urgência') || notas.includes('urgencia');

    // STRICT manual detection: only explicit flags
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

      // PRIORITY 1: Manual value — USE EXACT VALUE, NO DISCOUNT
      if (hasManualFlag && s === 0) {
        valorFinal = Number(p.valor) || base;
        isManual = true;
        label = 'VALOR MANUAL';
      }
      // PRIORITY 2: Urgência — +50% on base
      else if (isUrgencia && !hasManualFlag && s === 0) {
        valorFinal = base * 1.5;
        isManual = true;
        label = 'MÉTODO TREVO / URGÊNCIA';
      }
      // PRIORITY 3: Progressive discount
      else {
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
        index: slot,
        processo: p,
        valorBase: isManual ? valorFinal : base,
        desconto: Math.round(desconto * 100) / 100,
        valorFinal,
        isSelected: selectedIds.has(p.id),
        isMudancaUF: isMudancaUF && s === 0,
        isManual,
        isUrgencia,
        label,
      });
    }
  }
  return steps;
}

// ═══ DRAWING HELPERS ═══
function pw(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function ph(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }
function w(doc: jsPDF) { return pw(doc) - M * 2; }

function drawGradient(doc: jsPDF, y: number, h = 2) {
  const total = w(doc);
  const n = 80;
  for (let i = 0; i < n; i++) {
    const r = i / n;
    doc.setFillColor(
      Math.round(76 + (163 - 76) * r),
      Math.round(159 + (230 - 159) * r),
      Math.round(56 + (53 - 56) * r),
    );
    const sw = total / n;
    doc.rect(M + sw * i, y, sw + 0.3, h, 'F');
  }
}

// Logo preload
const LOGO_URL = 'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png';
let _logo: string | null = null;
async function loadLogo(): Promise<string | null> {
  if (_logo) return _logo;
  try {
    const r = await fetch(LOGO_URL);
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise(res => {
      const fr = new FileReader();
      fr.onloadend = () => { _logo = fr.result as string; res(_logo); };
      fr.onerror = () => res(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Dark header bar with logo
function drawHeader(doc: jsPDF, y: number, logo: string | null): number {
  const p = pw(doc);
  doc.setFillColor(...C.DARK);
  doc.rect(0, y, p, 18, 'F');

  if (logo) {
    try { doc.addImage(logo, 'PNG', M, y + 2, 28, 14, undefined, 'FAST'); } catch {}
  }

  const tx = logo ? M + 32 : M;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.WHITE);
  doc.text(BRAND.fantasia, tx, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...C.LIME);
  doc.text(`CNPJ ${BRAND.cnpj}  •  ${BRAND.endereco}`, tx, y + 13);

  drawGradient(doc, y + 18, 2);
  return y + 22;
}

// Section banner (green text on dark bg) — like image_fec2ac
function drawSectionHeader(doc: jsPDF, y: number, text: string): number {
  const p = pw(doc);
  doc.setFillColor(...C.DARK);
  doc.rect(0, y, p, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.GREEN);
  doc.text(text, M + 4, y + 8);
  return y + 14;
}

function ensureSpace(doc: jsPDF, y: number, need: number, logo: string | null): number {
  if (y + need > ph(doc) - 22) {
    doc.addPage();
    return drawHeader(doc, 0, logo) + 2;
  }
  return y;
}

// ═══════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════
export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const logo = await loadLogo();
  const now = new Date();
  const pageW = pw(doc);
  const contentW = w(doc);

  const steps = buildEscadinha(data);
  const selected = steps.filter(s => s.isSelected);
  const descPct = data.cliente.desconto_progressivo ?? 0;

  const totalHon = selected.reduce((s, st) => s + st.valorFinal, 0);
  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHon + totalTaxas;
  const economia = steps.filter(s => !s.isManual).reduce((s, st) => s + st.desconto, 0);

  // ═══════════════════════════════════════
  // PAGE 1 — CAPA / RESUMO EXECUTIVO
  // ═══════════════════════════════════════
  let y = drawHeader(doc, 0, logo);
  y += 6;

  // Client name (big, clean)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...C.DARK_TEXT);
  const nameLines = doc.splitTextToSize(data.cliente.nome, contentW);
  doc.text(nameLines, M, y);
  y += nameLines.length * 8 + 2;

  if (data.cliente.cnpj) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...C.SLATE);
    doc.text(data.cliente.cnpj, M, y);
    y += 6;
  }

  // Green badge
  const badge = 'EXTRATO DE FATURAMENTO';
  doc.setFillColor(...C.GREEN);
  const bw = doc.getTextWidth(badge) + 14;
  doc.roundedRect(M, y, bw > 55 ? bw : 55, 7, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.WHITE);
  doc.text(badge, M + 4, y + 4.8);
  y += 14;

  // Competência
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...C.DARK_TEXT);
  doc.text(`Competência: ${mesRef}`, M, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.SLATE);
  doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}  •  ${data.processos.length} processo(s) cobrado(s)`, M, y);
  y += 12;

  // ── SECTION: HONORÁRIOS DO PROCESSO (image_fec2ac style) ──
  y = drawSectionHeader(doc, y, 'HONORÁRIOS DO PROCESSO');
  y += 4;

  // TOTAL card — big number, white, clean (like image_fec2ac)
  doc.setFillColor(...C.WHITE);
  doc.setDrawColor(...C.BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, contentW, 36, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...C.SLATE);
  doc.text('TOTAL', M + contentW / 2, y + 10, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(...C.BLACK);
  doc.text(fmt(totalGeral), M + contentW / 2, y + 27, { align: 'center' });
  y += 42;

  // ── KPI row: 3 cards ──
  const kpiW = (contentW - 6) / 3;
  const kpis = [
    { label: 'Subtotal Honorários', value: fmt(totalHon) },
    { label: 'Subtotal Taxas', value: fmt(totalTaxas) },
    { label: 'Economia no Mês', value: economia > 0 ? fmt(economia) : 'N/A' },
  ];
  kpis.forEach((kpi, i) => {
    const x = M + i * (kpiW + 3);
    const isEco = i === 2 && economia > 0;

    if (isEco) {
      doc.setFillColor(...C.GREEN);
      doc.roundedRect(x, y, kpiW, 18, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C.WHITE);
      doc.text(kpi.value, x + 5, y + 8);
      doc.setFontSize(6);
      doc.text(kpi.label, x + 5, y + 14);
    } else {
      doc.setFillColor(...C.BG);
      doc.setDrawColor(...C.BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, kpiW, 18, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...C.DARK_TEXT);
      doc.text(kpi.value, x + 5, y + 8);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.SLATE);
      doc.text(kpi.label, x + 5, y + 14);
    }
  });
  y += 24;

  // ── Volume + Base info ──
  const emissao = now.toLocaleDateString('pt-BR');
  const mesNum = String(now.getMonth() + 1).padStart(2, '0');

  doc.setFillColor(...C.BG);
  doc.setDrawColor(...C.BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, contentW, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.SLATE);
  doc.text(`Volume Acumulado (01/${mesNum} até ${emissao}): ${data.allCompetencia.length} processo(s)`, M + 5, y + 6);
  doc.text(`Valor Base: ${fmt(data.cliente.valor_base ?? 580)}  •  Desc. Contratual: ${descPct > 0 ? descPct + '% progressivo' : 'N/A'}`, M + 5, y + 11);
  y += 20;

  // Contact line
  doc.setDrawColor(...C.BORDER);
  doc.line(M, y, pageW - M, y);
  y += 1;
  doc.setFillColor(...C.BG);
  doc.rect(M, y, contentW, 8, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...C.SLATE);
  doc.text(`${BRAND.email}  •  ${BRAND.telefone}  •  trevolegaliza.com`, pageW / 2, y + 5, { align: 'center' });

  // ═══════════════════════════════════════
  // PAGE 2+ — DETALHAMENTO UNITÁRIO
  // ═══════════════════════════════════════
  doc.addPage();
  y = drawHeader(doc, 0, logo);
  y = drawSectionHeader(doc, y, 'DETALHAMENTO UNITÁRIO — HONORÁRIOS E TAXAS');
  y += 4;

  for (let pi = 0; pi < selected.length; pi++) {
    const step = selected[pi];
    const p = step.processo;
    const pTaxas = data.valoresAdicionais[p.id] || [];
    const taxTotal = pTaxas.reduce((s, va) => s + Number(va.valor), 0);
    const blockTotal = step.valorFinal + taxTotal;

    const neededH = 30 + (pTaxas.length > 0 ? 10 + pTaxas.length * 7 + 12 : 0);
    y = ensureSpace(doc, y, neededH, logo);

    // ── Process card ──
    doc.setFillColor(...C.BG);
    doc.setDrawColor(...C.BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, contentW, 26, 2, 2, 'FD');

    // Green left accent
    doc.setFillColor(...C.GREEN);
    doc.rect(M, y + 1, 2.5, 24, 'F');

    // Position badge
    doc.setFillColor(...C.DARK);
    doc.roundedRect(M + 6, y + 5, 14, 7, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.GREEN_ACC);
    const posText = `${step.index}º`;
    const posW = doc.getTextWidth(posText);
    doc.text(posText, M + 6 + (14 - posW) / 2, y + 10);

    // Service type UPPERCASE + company name
    const tipo = p.tipo.toUpperCase();
    let svcName = `${tipo} — ${p.razao_social}`;
    if (step.isMudancaUF) svcName += ' (MUDANÇA DE UF - 2 VAGAS)';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...C.DARK_TEXT);
    doc.text(svcName, M + 24, y + 10, { maxWidth: contentW - 80 });

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.SLATE);
    doc.text(`Data: ${fmtDate(p.created_at)}`, M + 24, y + 17);

    // Manual/Urgência badge — ONLY if explicitly flagged
    if (step.isManual && step.label) {
      const bx = M + 24 + doc.getTextWidth(`Data: ${fmtDate(p.created_at)}`) + 4;
      doc.setFillColor(...C.ORANGE);
      const labelW = doc.getTextWidth(step.label) + 8;
      doc.roundedRect(bx, y + 13.5, labelW, 5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5);
      doc.setTextColor(...C.WHITE);
      doc.text(step.label, bx + 4, y + 16.8);
    }

    // Discount info (only for progressive)
    if (!step.isManual && step.desconto > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(22, 101, 52);
      doc.text(`Desc. progressivo: -${fmt(step.desconto)}`, M + 24, y + 22);
    }

    // Value on right — BIG
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(step.isManual ? C.ORANGE[0] : C.DARK_TEXT[0], step.isManual ? C.ORANGE[1] : C.DARK_TEXT[1], step.isManual ? C.ORANGE[2] : C.DARK_TEXT[2]);
    doc.text(fmt(step.valorFinal), pageW - M - 5, y + 12, { align: 'right' });

    // Base reference
    if (!step.isManual && step.desconto > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...C.SLATE);
      doc.text(`Base: ${fmt(step.valorBase)}`, pageW - M - 5, y + 18, { align: 'right' });
    }

    y += 28;

    // ── Taxas sub-table ──
    if (pTaxas.length > 0) {
      const taxRows = pTaxas.map(va => [
        fmtDate(va.created_at),
        va.descricao,
        fmt(Number(va.valor)),
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Taxa / Reembolso', 'Valor']],
        body: taxRows,
        theme: 'striped',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [...C.SLATE],
          fontSize: 6.5,
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [...C.BORDER],
        },
        bodyStyles: { fontSize: 7, textColor: [...C.DARK_TEXT] },
        alternateRowStyles: { fillColor: [...C.BG] },
        columnStyles: {
          0: { cellWidth: 22 },
          2: { halign: 'right' as const, fontStyle: 'bold', textColor: [22, 101, 52] },
        },
        margin: { left: M + 8, right: M },
        tableWidth: contentW - 8,
      });

      y = (doc as any).lastAutoTable.finalY + 1;

      // Subtotal line
      doc.setFillColor(...C.GREEN_LT);
      doc.roundedRect(M + 8, y, contentW - 8, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(22, 101, 52);
      doc.text(
        `Subtotal: ${fmt(step.valorFinal)} (Hon.) + ${fmt(taxTotal)} (Taxas) = ${fmt(blockTotal)}`,
        M + 12, y + 4.5
      );
      y += 9;
    }

    y += 5;
  }

  // ── Non-selected (contabilizado) ──
  const nonSelected = steps.filter(s => !s.isSelected);
  if (nonSelected.length > 0) {
    y = ensureSpace(doc, y, 16 + nonSelected.length * 7, logo);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...C.SLATE);
    doc.text('PROCESSOS CONTABILIZADOS (JÁ FATURADOS ANTERIORMENTE)', M, y);
    y += 4;

    const rows = nonSelected.map(s => [
      `${s.index}º`,
      fmtDate(s.processo.created_at),
      `${s.processo.tipo.toUpperCase()} — ${s.processo.razao_social}`,
      s.isManual ? s.label : fmt(s.valorFinal),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Data', 'Descrição', 'Valor']],
      body: rows,
      theme: 'striped',
      headStyles: { fillColor: [...C.BORDER], textColor: [...C.SLATE], fontSize: 6.5 },
      bodyStyles: { fontSize: 7, textColor: [...C.SLATE], fontStyle: 'italic' },
      alternateRowStyles: { fillColor: [...C.BG] },
      columnStyles: { 0: { halign: 'center' as const, cellWidth: 12 }, 3: { halign: 'right' as const } },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── PROGRESSÃO DE INCENTIVO ──
  if (descPct > 0 && steps.length > 0) {
    y = ensureSpace(doc, y, 18 + steps.length * 7 + 12, logo);

    y = drawSectionHeader(doc, y, 'PROGRESSÃO DE INCENTIVO POR VOLUME');
    y += 2;

    const progRows = steps.map(s => {
      let status = '—';
      let desc = '—';
      if (s.isManual) {
        status = s.label || 'Valor Manual';
      } else if (s.desconto > 0) {
        desc = `-${descPct}%`;
        const lim = data.cliente.valor_limite_desconto;
        status = (lim && s.valorFinal <= lim) ? 'Limite atingido' : 'Desconto acumulado';
      }
      return [`${s.index}º`, fmt(s.valorFinal), desc, status];
    });

    autoTable(doc, {
      startY: y,
      head: [['Proc.', 'Valor', 'Desc.', 'Status']],
      body: progRows,
      theme: 'striped',
      headStyles: { fillColor: [...C.GREEN], textColor: [...C.WHITE], fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: [...C.DARK_TEXT] },
      alternateRowStyles: { fillColor: [...C.BG] },
      columnStyles: {
        0: { halign: 'center' as const, cellWidth: 16, fontStyle: 'bold' },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' as const, cellWidth: 18, textColor: [22, 101, 52] },
        3: { fontStyle: 'italic', textColor: [...C.SLATE] },
      },
      margin: { left: M, right: M },
    });
    y = (doc as any).lastAutoTable.finalY + 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...C.SLATE);
    const rule = `Regra: Desconto composto de ${descPct}% a cada processo na mesma competência mensal` +
      (data.cliente.valor_limite_desconto ? `, limite mínimo ${fmt(data.cliente.valor_limite_desconto)}` : '') +
      '. No mês seguinte, retorna ao valor base.';
    const rLines = doc.splitTextToSize(rule, contentW - 4);
    doc.text(rLines, M + 2, y + 3);
    y += rLines.length * 3.5 + 6;
  }

  // ── TOTAL GERAL (dark bar) ──
  y = ensureSpace(doc, y, 20, logo);
  doc.setFillColor(...C.DARK);
  doc.roundedRect(M, y, contentW, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.GREEN_ACC);
  doc.text('TOTAL GERAL', M + 6, y + 7);
  doc.setFontSize(18);
  doc.setTextColor(...C.WHITE);
  doc.text(fmt(totalGeral), pageW - M - 6, y + 12, { align: 'right' });

  // ── Attachments ──
  await renderAttachments(doc, data, logo);

  // ── Footer on all pages ──
  const pages = doc.getNumberOfPages();
  const pageH = ph(doc);
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    drawGradient(doc, pageH - 12, 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(...C.SLATE);
    doc.text(`${BRAND.fantasia}  •  ${BRAND.cnpj}  •  ${BRAND.endereco}`, M, pageH - 6);
    doc.text(`PÁGINA ${i} DE ${pages}`, pageW - M, pageH - 6, { align: 'right' });
  }

  return doc;
}

// ═══ ATTACHMENTS ═══
async function renderAttachments(doc: jsPDF, data: ExtratoData, logo: string | null) {
  const pageW = pw(doc);
  const pageH = ph(doc);
  const contentW = w(doc);

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

  for (const att of atts) {
    try {
      const imgData = await loadImageBase64(att.url);
      if (!imgData) continue;
      doc.addPage();
      doc.setFillColor(...C.DARK);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...C.GREEN_ACC);
      doc.text('ANEXO DE COMPROVANTE', M, 5.5);
      doc.setFontSize(8);
      doc.setTextColor(...C.WHITE);
      doc.text(att.label, M, 11);
      drawGradient(doc, 14, 1.5);
      doc.addImage(imgData, 'JPEG', M, 20, contentW, pageH - 40, undefined, 'FAST');
    } catch {
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Anexo indisponível: ${att.label}`, M, 30);
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
