/**
 * Relatório de Performance Societária — TREVO ENGINE V15
 * Estilo visual baseado na PROPOSTA CERTA ASSESSORIA (PDF anexo).
 * Regra JGVCO: Valor Manual > Urgência > Progressão -5% cumulativa.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

const LOGO_PUBLIC_URL = 'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png';
const NEON_GREEN = [57, 255, 20] as const; // #39FF14

// ── Brand constants (PROPOSTA style) ──
const GREEN = [76, 159, 56] as const;     // #4C9F38
const DARK = [15, 31, 15] as const;        // #0f1f0f
const SLATE = [100, 116, 139] as const;    // #64748b
const DARK_TEXT = [30, 41, 59] as const;   // #1e293b
const BG_BLOCK = [248, 250, 252] as const; // #f8fafc
const GREEN_LIGHT = [240, 253, 244] as const;
const BORDER = [226, 232, 240] as const;
const GREEN_ACCENT = [74, 222, 128] as const;
const WHITE = [255, 255, 255] as const;
const ORANGE = [234, 88, 12] as const;

const BRAND = {
  nome: 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  fantasia: 'TREVO LEGALIZA',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  site: 'trevolegaliza.com',
  slogan: 'LÍDER NACIONAL EM ASSESSORIA SOCIETÁRIA',
};

const MARGIN = 15;

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

// ── Progressive discount staircase (JGVCO Rule) ──
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
    // ONLY mark as manual if explicitly flagged — never infer from value difference
    const hasManualValue = notas.includes('Valor Manual') || notas.includes('VALOR MANUAL') ||
      notas.includes('is_manual') || notas.includes('IS_MANUAL');
    const slots = isMudancaUF ? 2 : 1;

    for (let slot = 0; slot < slots; slot++) {
      stepIdx++;
      let valorAtual: number;
      let isManual = false;
      let desconto = 0;

      if (hasManualValue && slot === 0) {
        valorAtual = p.valor!;
        isManual = true;
      } else if (isUrgencia && !hasManualValue) {
        valorAtual = valorBase * 1.5;
        isManual = true;
      } else {
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

// ── Helpers ──
function getW(doc: jsPDF) { return doc.internal.pageSize.getWidth() - MARGIN * 2; }
function getPageW(doc: jsPDF) { return doc.internal.pageSize.getWidth(); }
function getPageH(doc: jsPDF) { return doc.internal.pageSize.getHeight(); }

// Gradient line (green #4C9F38 → #a3e635)
function drawGradientLine(doc: jsPDF, y: number, h = 2.5) {
  const w = getW(doc);
  const steps = 100;
  for (let i = 0; i < steps; i++) {
    const ratio = i / steps;
    const r = Math.round(76 + (163 - 76) * ratio);
    const g = Math.round(159 + (230 - 159) * ratio);
    const b = Math.round(56 + (53 - 56) * ratio);
    doc.setFillColor(r, g, b);
    const segW = w / steps;
    doc.rect(MARGIN + segW * i, y, segW + 0.2, h, 'F');
  }
}

// Dark header bar with LOGO from Supabase Storage
let _cachedLogoBase64: string | null = null;

async function preloadLogo(): Promise<string | null> {
  if (_cachedLogoBase64) return _cachedLogoBase64;
  try {
    const resp = await fetch(LOGO_PUBLIC_URL);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { _cachedLogoBase64 = reader.result as string; resolve(_cachedLogoBase64); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

function drawDarkHeaderBar(doc: jsPDF, y: number, logoBase64?: string | null): number {
  const pw = getPageW(doc);

  // Dark bar
  doc.setFillColor(...DARK);
  doc.rect(0, y, pw, 18, 'F');

  // Logo on the left (if loaded)
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', MARGIN, y + 2, 28, 14, undefined, 'FAST');
    } catch { /* fallback to text */ }
  }

  const textX = logoBase64 ? MARGIN + 32 : MARGIN;

  // Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text(BRAND.fantasia, textX, y + 7);

  // Slogan
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(163, 230, 53); // lime
  doc.text(`${BRAND.slogan}  •  CNPJ ${BRAND.cnpj}`, textX, y + 13);

  // Gradient line below
  drawGradientLine(doc, y + 18, 2);

  return y + 22;
}

// Spaced letter section header (like "P R O P O S T A  P R E P A R A D A")
function drawSpacedHeader(doc: jsPDF, y: number, text: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GREEN);
  const spaced = text.split('').join(' ');
  doc.text(spaced, MARGIN, y);
  return y + 6;
}

// Dark section banner (like PROPOSTA "INVESTIMENTO" banner)
function drawSectionBanner(doc: jsPDF, y: number, tag: string, title: string): number {
  const pw = getPageW(doc);
  doc.setFillColor(...DARK);
  doc.rect(0, y, pw, 18, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...GREEN_ACCENT);
  doc.text(tag, MARGIN, y + 6);

  doc.setFontSize(13);
  doc.setTextColor(...WHITE);
  doc.text(title, MARGIN, y + 14);

  return y + 22;
}

// Ensure space, add page if needed
function ensureSpace(doc: jsPDF, y: number, needed: number, logoBase64?: string | null): number {
  if (y + needed > getPageH(doc) - 25) {
    doc.addPage();
    return drawDarkHeaderBar(doc, 0, logoBase64) + 4;
  }
  return y;
}

// ═══════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════

export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pw = getPageW(doc);
  const ph = getPageH(doc);
  const w = getW(doc);
  const now = new Date();

  // Preload logo from Supabase Storage
  const logoBase64 = await preloadLogo();

  const steps = buildEscadinha(data);
  const selectedSteps = steps.filter(s => s.isSelected);
  const descPct = data.cliente.desconto_progressivo ?? 0;

  const totalHonorarios = selectedSteps.reduce((s, st) => s + st.valorFinal, 0);
  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHonorarios + totalTaxas;
  const economiaMes = steps.reduce((s, st) => s + st.desconto, 0);

  // ═══════════════════════════════════════════════
  // PAGE 1 — CAPA (Estilo PROPOSTA)
  // ═══════════════════════════════════════════════

  // Dark header with logo
  let y = drawDarkHeaderBar(doc, 0, logoBase64);
  y += 4;

  // Spaced section title
  y = drawSpacedHeader(doc, y, 'RELATÓRIO DE PERFORMANCE SOCIETÁRIA');
  y += 2;

  // Client name (large, like PROPOSTA)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...DARK_TEXT);
  const clientName = data.cliente.nome;
  const splitName = doc.splitTextToSize(clientName, w);
  doc.text(splitName, MARGIN, y);
  y += splitName.length * 9 + 2;

  // CNPJ
  if (data.cliente.cnpj) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...SLATE);
    doc.text(data.cliente.cnpj, MARGIN, y);
    y += 6;
  }

  // Badge "EXTRATO DE FATURAMENTO"
  const badgeText = 'EXTRATO DE FATURAMENTO';
  doc.setFillColor(...GREEN);
  const badgeW = doc.getTextWidth(badgeText) * 1.4 + 10;
  doc.roundedRect(MARGIN, y, badgeW > 60 ? badgeW : 60, 8, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...WHITE);
  doc.text(badgeText, MARGIN + 4, y + 5.5);
  y += 16;

  // ── Big white section (like PROPOSTA hero text area) ──
  // Divider line
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pw - MARGIN, y);
  y += 8;

  // Competência text
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...DARK_TEXT);
  doc.text(`Competência: ${mesRef}`, MARGIN, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE);
  doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}  •  ${data.processos.length} processo(s) cobrado(s)  •  ${data.allCompetencia.length} no mês`, MARGIN, y);
  y += 14;

  // ── CONTACT BAR (like PROPOSTA "ENTRE EM CONTATO") ──
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, pw - MARGIN, y);
  y += 1;
  doc.setFillColor(...BG_BLOCK);
  doc.rect(MARGIN, y, w, 10, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text(`${BRAND.site}     ${BRAND.email}     ${BRAND.telefone}`, pw / 2, y + 6, { align: 'center' });
  y += 14;

  // ── KPI STATS ROW (like "12 Anos | 26 Estados" row) ──
  const kpiW = (w - 9) / 4;
  const kpis = [
    { label: 'Processos Cobrados', value: String(data.processos.length) },
    { label: 'Total no Mês', value: String(data.allCompetencia.length) },
    { label: 'Valor Base', value: fmt(data.cliente.valor_base ?? 580) },
    { label: 'Desc. Contratual', value: descPct > 0 ? `${descPct}% progressivo` : 'N/A' },
  ];
  doc.setDrawColor(...BORDER);
  kpis.forEach((kpi, i) => {
    const x = MARGIN + i * (kpiW + 3);
    doc.setFillColor(...BG_BLOCK);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, kpiW, 22, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...DARK_TEXT);
    doc.text(kpi.value, x + 5, y + 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE);
    doc.text(kpi.label, x + 5, y + 17);
  });
  y += 28;

  // ── VALOR TOTAL HIGHLIGHT (like PROPOSTA R$ 600,00 big) ──
  y = ensureSpace(doc, y, 50);

  // Left: total amount
  doc.setFillColor(...BG_BLOCK);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, w * 0.48, 40, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...GREEN);
  doc.text('VALOR TOTAL DO EXTRATO', MARGIN + 8, y + 9);

  doc.setFontSize(26);
  doc.setTextColor(...DARK_TEXT);
  doc.text(fmt(totalGeral), MARGIN + 8, y + 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('Honorários + Taxas Reembolsáveis', MARGIN + 8, y + 34);

  // Right: breakdown cards
  const rightX = MARGIN + w * 0.52;
  const rightW = w * 0.48;
  const cardH = 18;

  doc.setFillColor(...BG_BLOCK);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightX, y, rightW, cardH, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('Subtotal Honorários', rightX + 5, y + 7);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text(fmt(totalHonorarios), rightX + rightW - 5, y + 7, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...SLATE);
  doc.text('Subtotal Taxas Reembolsáveis', rightX + 5, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK_TEXT);
  doc.text(fmt(totalTaxas), rightX + rightW - 5, y + 14, { align: 'right' });

  // Economy card below
  if (economiaMes > 0) {
    doc.setFillColor(...GREEN);
    doc.roundedRect(rightX, y + cardH + 2, rightW, cardH, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...WHITE);
    doc.text('ECONOMIA ACUMULADA NO MÊS', rightX + 5, y + cardH + 9);
    doc.setFontSize(12);
    doc.text(fmt(economiaMes), rightX + rightW - 5, y + cardH + 15, { align: 'right' });
  }

  y += 48;

  // ── Footer expiry line (like PROPOSTA "EXPIRA EM") ──
  y = ensureSpace(doc, y, 12);
  doc.setDrawColor(...BORDER);
  doc.line(MARGIN, y, pw - MARGIN, y);
  y += 1;
  doc.setFillColor(245, 245, 245);
  doc.rect(MARGIN, y, w, 8, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...SLATE);
  doc.text(`Reconhecida nacionalmente • 12 anos de mercado • @trevolegaliza`, MARGIN + 3, y + 5);

  // Green short line accent (like PROPOSTA)
  const shortLineW = 22;
  drawGradientLine(doc, y + 10, 1.5);

  // ═══════════════════════════════════════════════
  // PAGE 2+ — DETALHAMENTO (Master-Detail)
  // ═══════════════════════════════════════════════
  doc.addPage();
  y = drawDarkHeaderBar(doc, 0);
  y = drawSectionBanner(doc, y, 'DETALHAMENTO UNITÁRIO', 'Honorários e Taxas por Processo');
  y += 2;

  for (let pi = 0; pi < selectedSteps.length; pi++) {
    const step = selectedSteps[pi];
    const p = step.processo;
    const pTaxas = data.valoresAdicionais[p.id] || [];
    const boxH = 24;
    const taxTableH = pTaxas.length > 0 ? 10 + pTaxas.length * 7 : 0;
    const subtotalH = pTaxas.length > 0 ? 10 : 0;

    y = ensureSpace(doc, y, boxH + taxTableH + subtotalH + 10);

    // ── Process box with green left border ──
    doc.setFillColor(...BG_BLOCK);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(MARGIN, y, w, boxH, 2, 2, 'FD');
    // Green left accent
    doc.setFillColor(...GREEN);
    doc.rect(MARGIN, y + 1, 2, boxH - 2, 'F');

    // Process number badge
    doc.setFillColor(...DARK);
    doc.roundedRect(MARGIN + 6, y + 4, 16, 8, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GREEN_ACCENT);
    doc.text(`${step.index}º`, MARGIN + 14, y + 9.5, { align: 'center' });

    // Service name in UPPERCASE
    const tipo = p.tipo.toUpperCase();
    let serviceName = `${tipo} — ${p.razao_social}`;
    if (step.isMudancaUF) serviceName += ' (MUDANÇA DE UF - 2 VAGAS)';

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...DARK_TEXT);
    doc.text(serviceName, MARGIN + 25, y + 9, { maxWidth: w - 75 });

    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text(`Data: ${fmtDate(p.created_at)}`, MARGIN + 25, y + 16);

    // Manual/Urgência badge
    if (step.isManual || step.isUrgencia) {
      const badgeLabel = step.isUrgencia ? 'MÉTODO TREVO / URGÊNCIA' : 'VALOR MANUAL';
      const bx = MARGIN + 25 + doc.getTextWidth(`Data: ${fmtDate(p.created_at)}`) + 4;
      doc.setFillColor(...ORANGE);
      doc.roundedRect(bx, y + 12.5, doc.getTextWidth(badgeLabel) + 8, 5.5, 1.5, 1.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(...WHITE);
      doc.text(badgeLabel, bx + 4, y + 16);
    }

    // Discount info
    if (step.desconto > 0 && !step.isManual) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(22, 101, 52);
      doc.text(`Desc. Progressivo: -${fmt(step.desconto)}`, MARGIN + 25, y + 21);
    }

    // Value on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(step.isManual ? ORANGE[0] : GREEN[0], step.isManual ? ORANGE[1] : GREEN[1], step.isManual ? ORANGE[2] : GREEN[2]);
    doc.text(fmt(step.valorFinal), pw - MARGIN - 5, y + 11, { align: 'right' });

    // Base reference
    if (step.desconto > 0 && !step.isManual) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...SLATE);
      doc.text(`Base: ${fmt(step.valorBase)}`, pw - MARGIN - 5, y + 17, { align: 'right' });
    }

    y += boxH + 1;

    // ── Sub-table: Taxas linked to this process ──
    if (pTaxas.length > 0) {
      const taxRows = pTaxas.map(va => [
        fmtDate(va.created_at),
        va.descricao,
        fmt(Number(va.valor)),
      ]);

      const subtotalTaxas = pTaxas.reduce((s, va) => s + Number(va.valor), 0);

      autoTable(doc, {
        startY: y,
        head: [['Data', 'Descrição da Taxa / Reembolso', 'Valor']],
        body: taxRows,
        theme: 'striped',
        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [...SLATE],
          fontSize: 6.5,
          fontStyle: 'bold',
          lineWidth: 0.2,
          lineColor: [...BORDER],
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [...DARK_TEXT],
        },
        alternateRowStyles: {
          fillColor: [...BG_BLOCK],
        },
        columnStyles: {
          0: { cellWidth: 22 },
          2: { halign: 'right' as const, fontStyle: 'bold', textColor: [22, 101, 52] },
        },
        margin: { left: MARGIN + 8, right: MARGIN },
        tableWidth: w - 8,
      });

      y = (doc as any).lastAutoTable.finalY + 1;

      // Subtotal line for this process
      doc.setFillColor(240, 253, 244);
      doc.roundedRect(MARGIN + 8, y, w - 8, 7, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(22, 101, 52);
      doc.text(`Subtotal Processo: ${fmt(step.valorFinal)} (Hon.) + ${fmt(subtotalTaxas)} (Taxas) = ${fmt(step.valorFinal + subtotalTaxas)}`, MARGIN + 12, y + 4.5);

      y += 9;
    }

    y += 4;
  }

  // ── Non-selected (contabilizado) summary ──
  const nonSelected = steps.filter(s => !s.isSelected);
  if (nonSelected.length > 0) {
    y = ensureSpace(doc, y, 20 + nonSelected.length * 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE);
    doc.text('PROCESSOS CONTABILIZADOS (JÁ FATURADOS ANTERIORMENTE)', MARGIN, y);
    y += 4;

    const contabRows = nonSelected.map(s => {
      const tipo = s.processo.tipo.toUpperCase();
      return [`${s.index}º`, fmtDate(s.processo.created_at), `${tipo} — ${s.processo.razao_social}`, fmt(s.valorFinal)];
    });

    autoTable(doc, {
      startY: y,
      head: [['Pos.', 'Data', 'Descrição', 'Valor Progressivo']],
      body: contabRows,
      theme: 'striped',
      headStyles: { fillColor: [...BORDER], textColor: [...SLATE], fontSize: 6.5 },
      bodyStyles: { fontSize: 7, textColor: [...SLATE], fontStyle: 'italic' },
      alternateRowStyles: { fillColor: [...BG_BLOCK] },
      columnStyles: { 0: { halign: 'center' as const, cellWidth: 12 }, 3: { halign: 'right' as const } },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ── PROGRESSÃO DE INCENTIVO POR VOLUME (like PROPOSTA page 3 table) ──
  if (descPct > 0 && steps.length > 0) {
    y = ensureSpace(doc, y, 20 + steps.length * 7 + 14);

    doc.setFillColor(...BG_BLOCK);
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.5);
    doc.roundedRect(MARGIN, y, w, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...GREEN);
    doc.text('PROGRESSÃO DE INCENTIVO POR VOLUME — MESMA COMPETÊNCIA', MARGIN + 5, y + 7.5);
    y += 14;

    const progRows = steps.map(s => {
      const descStr = s.isManual ? '—' : (s.desconto > 0 ? `-${descPct}%` : '—');
      let status = '—';
      if (s.isManual) status = s.isUrgencia ? 'Método Trevo / Urgência' : 'Valor Manual';
      else if (s.desconto > 0) {
        const limite = data.cliente.valor_limite_desconto;
        status = (limite && s.valorFinal <= limite) ? 'Limite atingido' : 'Desconto acumulado';
      }
      return [`${s.index}º`, fmt(s.valorFinal), descStr, status];
    });

    autoTable(doc, {
      startY: y,
      head: [['Proc.', 'Valor', 'Desc.', 'Status']],
      body: progRows,
      theme: 'striped',
      headStyles: {
        fillColor: [...GREEN],
        textColor: [...WHITE],
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [...DARK_TEXT],
      },
      alternateRowStyles: { fillColor: [...BG_BLOCK] },
      columnStyles: {
        0: { halign: 'center' as const, cellWidth: 16, fontStyle: 'bold' },
        1: { fontStyle: 'bold' },
        2: { halign: 'center' as const, cellWidth: 18, textColor: [22, 101, 52] },
        3: { fontStyle: 'italic', textColor: [...SLATE] },
      },
      margin: { left: MARGIN, right: MARGIN },
    });

    y = (doc as any).lastAutoTable.finalY + 3;

    // Rule note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...SLATE);
    const ruleText = `Regra: Desconto composto de ${descPct}% a cada processo na mesma competência mensal` +
      (data.cliente.valor_limite_desconto ? `, até atingir o limite mínimo de ${fmt(data.cliente.valor_limite_desconto)}` : '') +
      `. No mês seguinte, o valor retorna automaticamente ao valor base.`;
    const ruleSplit = doc.splitTextToSize(ruleText, w - 4);
    doc.text(ruleSplit, MARGIN + 2, y + 3);
    y += ruleSplit.length * 3.5 + 6;
  }

  // ── TOTALIZADOR FINAL (dark bar like PROPOSTA) ──
  y = ensureSpace(doc, y, 20);

  doc.setFillColor(...DARK);
  doc.roundedRect(MARGIN, y, w, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...GREEN_ACCENT);
  doc.text('TOTAL GERAL', MARGIN + 6, y + 7);
  doc.setFontSize(18);
  doc.setTextColor(...WHITE);
  doc.text(fmt(totalGeral), pw - MARGIN - 6, y + 12, { align: 'right' });
  y += 22;

  // ── Attachment pages ──
  await renderAttachmentPages(doc, data);

  // ── Footer on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Short gradient accent
    drawGradientLine(doc, ph - 14, 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...SLATE);
    doc.text(
      `${BRAND.fantasia} • ${BRAND.slogan}`,
      MARGIN, ph - 8
    );
    doc.text(
      `PÁGINA ${i} DE ${totalPages}`,
      pw - MARGIN, ph - 8, { align: 'right' }
    );
  }

  return doc;
}

// ── Render attachment images as extra pages ──
async function renderAttachmentPages(doc: jsPDF, data: ExtratoData) {
  const pw = getPageW(doc);
  const ph = getPageH(doc);
  const w = getW(doc);

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

      // Dark banner header
      doc.setFillColor(...DARK);
      doc.rect(0, 0, pw, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...GREEN_ACCENT);
      doc.text('ANEXO DE COMPROVANTE', MARGIN, 6);
      doc.setFontSize(9);
      doc.setTextColor(...WHITE);
      doc.text(att.label, MARGIN, 12);

      drawGradientLine(doc, 16, 2);

      doc.addImage(imgData, 'JPEG', MARGIN, 24, w, ph - 50, undefined, 'FAST');
    } catch {
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
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
