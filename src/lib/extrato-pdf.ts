/**
 * Geração de Extrato de Faturamento em PDF – Layout Trevo Engine V10
 * Com "Memória do Mês": busca todos os processos da competência para
 * exibir a escadinha completa de desconto progressivo.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

// ── Brand Constants ──
const GREEN = '#4C9F38';
const DARK_BG = '#0f1f0f';
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

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

export interface ExtratoData {
  processos: ProcessoFinanceiro[];           // selected for billing
  allCompetencia: ProcessoFinanceiro[];      // ALL client processes this month
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
  index: number;       // 1-based
  processo: ProcessoFinanceiro;
  valorBase: number;
  desconto: number;
  valorFinal: number;
  isSelected: boolean;
  isMudancaUF: boolean;
}

/**
 * Build the progressive discount "staircase" for ALL processes in the month.
 */
function buildEscadinha(data: ExtratoData): StepInfo[] {
  const valorBase = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;
  const selectedIds = new Set(data.processos.map(p => p.id));

  // Sort all competência processes by creation date
  const sorted = [...data.allCompetencia].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const steps: StepInfo[] = [];
  let stepIdx = 0;

  for (const p of sorted) {
    const isMudancaUF = (p.notas || '').includes('Mudança de UF');
    const slots = isMudancaUF ? 2 : 1;

    for (let slot = 0; slot < slots; slot++) {
      stepIdx++;
      let valorAtual = valorBase;
      // Apply progressive discount for steps > 1
      if (descPct > 0 && stepIdx > 1) {
        for (let i = 1; i < stepIdx; i++) {
          valorAtual = valorAtual * (1 - descPct / 100);
        }
      }
      // Respect floor limit
      if (limite > 0 && valorAtual < limite) valorAtual = limite;
      valorAtual = Math.round(valorAtual * 100) / 100;

      const desconto = valorBase - valorAtual;
      steps.push({
        index: stepIdx,
        processo: p,
        valorBase,
        desconto,
        valorFinal: valorAtual,
        isSelected: selectedIds.has(p.id),
        isMudancaUF: isMudancaUF && slot === 0,
      });
    }
  }
  return steps;
}

export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const now = new Date();

  const steps = buildEscadinha(data);
  const selectedSteps = steps.filter(s => s.isSelected);
  const totalHonorarios = selectedSteps.reduce((s, st) => s + st.valorFinal, 0);
  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((s, va) => s + Number(va.valor), 0);
  const totalGeral = totalHonorarios + totalTaxas;
  const economiaTotal = selectedSteps.reduce((s, st) => s + st.desconto, 0);
  const economiaMes = steps.reduce((s, st) => s + st.desconto, 0);

  // ─── Header ───
  function drawHeader(yStart: number) {
    doc.setFillColor(26, 58, 26);
    doc.rect(0, yStart - 2, pageW, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(76, 159, 56);
    doc.text('TREVO LEGALIZA', margin, yStart + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const rightX = pageW - margin;
    doc.text(BRAND.nome, rightX, yStart + 4, { align: 'right' });
    doc.text(`CNPJ ${BRAND.cnpj} • Atuação Nacional`, rightX, yStart + 8, { align: 'right' });
    doc.text(BRAND.endereco, rightX, yStart + 12, { align: 'right' });

    // Green gradient rule
    const lineY = yStart + 16;
    const gradSteps = 100;
    for (let i = 0; i < gradSteps; i++) {
      const ratio = i / gradSteps;
      const r = Math.round(76 + (163 - 76) * ratio);
      const g = Math.round(159 + (230 - 159) * ratio);
      const b = Math.round(56 + (53 - 56) * ratio);
      doc.setDrawColor(r, g, b);
      doc.setLineWidth(0.8);
      const segW = contentW / gradSteps;
      doc.line(margin + segW * i, lineY, margin + segW * (i + 1), lineY);
    }
    return lineY + 4;
  }

  // ─── Page 1 – Capa / Resumo ───
  let y = drawHeader(margin + 2);

  // Banner
  doc.setFillColor(15, 31, 15);
  doc.rect(margin, y, contentW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(74, 222, 128);
  doc.text('EXTRATO DE FATURAMENTO', margin + 5, y + 6);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Detalhamento de Cobrança', margin + 5, y + 13);
  y += 22;

  // Client info block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 30, 2, 2, 'FD');
  doc.setFillColor(76, 159, 56);
  doc.rect(margin, y, 1.2, 30, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(76, 159, 56);
  doc.text('CONTRATANTE', margin + 5, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(data.cliente.nome, margin + 5, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (data.cliente.cnpj) doc.text(`CNPJ: ${data.cliente.cnpj}`, margin + 5, y + 18);
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.text(`Competência: ${mesRef}`, margin + 5, y + 24);
  doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}`, margin + 5, y + 28);

  // Total on right
  const rightX = pageW - margin - 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(76, 159, 56);
  doc.text(formatBRL(totalGeral), rightX, y + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Honorários: ${formatBRL(totalHonorarios)}`, rightX, y + 20, { align: 'right' });
  doc.text(`Taxas/Reembolsos: ${formatBRL(totalTaxas)}`, rightX, y + 25, { align: 'right' });
  y += 36;

  // KPI boxes
  const kpiW = (contentW - 6) / 3;
  const kpis = [
    { label: 'Processos Cobrados', value: String(data.processos.length) },
    { label: 'Total no Mês', value: String(data.allCompetencia.length) },
    { label: 'Valor Base Unitário', value: formatBRL(data.cliente.valor_base ?? 580) },
  ];
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, kpiW, 18, 2, 2, 'FD');
    doc.setFillColor(76, 159, 56);
    doc.rect(x, y, kpiW, 0.8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(76, 159, 56);
    doc.text(kpi.label, x + 5, y + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 41, 59);
    doc.text(kpi.value, x + 5, y + 14);
  });
  y += 24;

  // ── "SEU PROGRESSO NESTE MÊS" progress block ──
  const descPct = data.cliente.desconto_progressivo ?? 0;
  if (descPct > 0 && steps.length > 0) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    const progH = 8 + steps.length * 6 + 14;
    doc.roundedRect(margin, y, contentW, progH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(22, 101, 52);
    doc.text('📊 SEU PROGRESSO NESTE MÊS', margin + 5, y + 6);

    let py = y + 12;
    const barMaxW = contentW - 60;

    for (const step of steps) {
      const ratio = step.valorFinal / step.valorBase;
      const barW = barMaxW * ratio;

      // Bar background
      doc.setFillColor(220, 252, 231);
      doc.roundedRect(margin + 30, py - 2.5, barMaxW, 4, 1, 1, 'F');

      // Filled bar
      if (step.isSelected) {
        doc.setFillColor(76, 159, 56);
      } else {
        doc.setFillColor(148, 163, 184); // grey for already accounted
      }
      doc.roundedRect(margin + 30, py - 2.5, barW, 4, 1, 1, 'F');

      // Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(step.isSelected ? 22 : 148, step.isSelected ? 101 : 163, step.isSelected ? 52 : 184);
      doc.text(`${step.index}º`, margin + 5, py);

      // Value at end of bar
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text(formatBRL(step.valorFinal), margin + 30 + barMaxW + 2, py);

      py += 6;
    }

    // Economy badge
    if (economiaMes > 0) {
      doc.setFillColor(76, 159, 56);
      doc.roundedRect(margin + 5, py, contentW - 10, 8, 2, 2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `ECONOMIA ACUMULADA NO MÊS: ${formatBRL(economiaMes)}`,
        pageW / 2, py + 5.5,
        { align: 'center' }
      );
    }

    y += progH + 4;
  }

  // Contacts footer on cover
  if (y < pageH - 20) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `${BRAND.site}  •  ${BRAND.email}  •  ${BRAND.telefone}`,
      pageW / 2, y + 9, { align: 'center' }
    );
  }

  // ─── Page 2 – Detalhamento ───
  doc.addPage();
  y = drawHeader(margin + 2);

  doc.setFillColor(15, 31, 15);
  doc.rect(margin, y, contentW, 12, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(74, 222, 128);
  doc.text('DETALHAMENTO', margin + 5, y + 5);
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('Honorários e Taxas', margin + 5, y + 10);
  y += 16;

  // Section: Honorários with full staircase
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(76, 159, 56);
  doc.text('TABELA 1 — HONORÁRIOS (ESCADINHA DE DESCONTO)', margin, y);
  y += 4;

  const honorariosRows = steps.map((step) => {
    const descLabel = step.desconto > 0
      ? `-${descPct}% (${formatBRL(step.desconto)})`
      : '—';
    const tipo = step.processo.tipo.charAt(0).toUpperCase() + step.processo.tipo.slice(1);
    let desc = `${tipo} — ${step.processo.razao_social}`;
    if (step.isMudancaUF) desc += ' (Mudança de UF - 2 vagas)';
    if (!step.isSelected) desc += ' [Contabilizado]';
    return [
      `${step.index}º`,
      formatDate(step.processo.created_at),
      desc,
      formatBRL(step.valorBase),
      descLabel,
      formatBRL(step.valorFinal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Proc.', 'Data', 'Descrição', 'Valor Base', 'Desc. Progressivo', 'Valor Final']],
    body: honorariosRows,
    theme: 'grid',
    headStyles: {
      fillColor: [22, 101, 52],
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    didParseCell: function (hookData: any) {
      if (hookData.section === 'body') {
        const stepInfo = steps[hookData.row.index];
        if (stepInfo && !stepInfo.isSelected) {
          // Grey out non-selected (already accounted) rows
          hookData.cell.styles.textColor = [148, 163, 184];
          hookData.cell.styles.fontStyle = 'italic';
        }
      }
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 22 },
      3: { halign: 'right' },
      4: { halign: 'center', textColor: [22, 101, 52] },
      5: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] },
    },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    margin: { left: margin, right: margin },
    foot: [['', '', '', '', 'Subtotal Cobrado', formatBRL(totalHonorarios)]],
    footStyles: {
      fillColor: [220, 252, 231],
      textColor: [22, 101, 52],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right',
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Table 2 – Taxas / Reembolsos
  if (allTaxas.length > 0) {
    if (y > pageH - 60) { doc.addPage(); y = drawHeader(margin + 2) + 6; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(76, 159, 56);
    doc.text('TABELA 2 — TAXAS E REEMBOLSOS', margin, y);
    y += 4;

    const taxaRows = allTaxas.map(va => [
      formatDate(va.created_at),
      va.descricao,
      formatBRL(Number(va.valor)),
    ]);

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Descrição', 'Valor']],
      body: taxaRows,
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255, fontSize: 7, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: margin, right: margin },
      foot: [['', 'Subtotal Taxas', formatBRL(totalTaxas)]],
      footStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 8, halign: 'right' },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Total Geral bar
  if (y > pageH - 30) { doc.addPage(); y = drawHeader(margin + 2) + 6; }

  doc.setFillColor(15, 31, 15);
  doc.roundedRect(margin, y, contentW, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(74, 222, 128);
  doc.text('TOTAL GERAL', margin + 6, y + 7);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(formatBRL(totalGeral), pageW - margin - 6, y + 12, { align: 'right' });
  y += 22;

  // Discount rule note
  if (descPct > 0 && y < pageH - 30) {
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(134, 239, 172);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(22, 101, 52);
    doc.text('REGRA DE DESCONTO PROGRESSIVO', margin + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(
      `Desconto composto de ${descPct}% a cada processo na mesma competência mensal. No mês seguinte, o valor retorna ao valor base de ${formatBRL(data.cliente.valor_base ?? 580)}.`,
      margin + 4, y + 10
    );
  }

  // ─── Attachment pages ───
  await renderAttachmentPages(doc, data);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(76, 159, 56);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Extrato gerado em ${now.toLocaleDateString('pt-BR')} — ${BRAND.fantasia} — Página ${i}/${totalPages}`,
      pageW / 2, pageH - 7, { align: 'center' }
    );
  }

  return doc;
}

/** Render attachment images as extra pages */
async function renderAttachmentPages(doc: jsPDF, data: ExtratoData) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

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
      doc.text('ANEXO', margin, 6);
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(att.label, margin, 11);

      doc.addImage(imgData, 'JPEG', margin, 20, contentW, pageH - 40, undefined, 'FAST');
    } catch {
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Anexo não disponível: ${att.label}`, margin, 30);
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

/** Fetch valores_adicionais for multiple processos */
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

/** Fetch all processes for a client in the current month */
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

  // Fetch lancamentos for these
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
