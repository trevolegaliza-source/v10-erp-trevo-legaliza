/**
 * Geração de Extrato de Faturamento em PDF – Layout Trevo Engine V10
 * Fonte da Verdade: Code.gs TREVO ENGINE V10
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

// ── Brand Constants (from .gs) ──
const GREEN = '#4C9F38';
const DARK_GREEN = '#0f1f0f';
const BG_BLOCK = '#f8fafc';
const DARK = '#1e293b';
const BRAND = {
  nome: 'TREVO ASSESSORIA SOCIETÁRIA LTDA',
  fantasia: 'TREVO LEGALIZA',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
  site: 'trevolegaliza.com',
  logoUrl: 'https://trevolegaliza.com/wp-content/uploads/2021/11/TREVO-LEGALIZA-1.png',
};

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

export interface ExtratoData {
  processos: ProcessoFinanceiro[];
  valoresAdicionais: Record<string, ValorAdicional[]>;
  cliente: {
    nome: string;
    cnpj: string | null;
    apelido: string | null;
    valor_base: number | null;
    desconto_progressivo: number | null;
  };
}

export async function gerarExtratoPDF(data: ExtratoData): Promise<jsPDF> {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  // ─── Header (mirrors .gs page-header + hdr-green-rule) ───
  function drawHeader(yStart: number) {
    // Top dark stripe (4pt ≈ 1.4mm)
    doc.setFillColor(26, 58, 26); // #1a3a1a
    doc.rect(0, yStart - 2, pageW, 1.5, 'F');

    // Company name left – TREVO LEGALIZA
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(GREEN);
    doc.text('TREVO LEGALIZA', margin, yStart + 8);

    // Company info right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139); // #64748b
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
      const segW = contentW / gradSteps;
      doc.setLineWidth(0.8);
      doc.line(margin + segW * i, lineY, margin + segW * (i + 1), lineY);
    }

    return lineY + 4;
  }

  // ─── Page 1 – Capa / Resumo ───
  let y = drawHeader(margin + 2);

  // Banner section (dark background block)
  doc.setFillColor(15, 31, 15); // #0f1f0f
  doc.rect(margin, y, contentW, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(74, 222, 128); // #4ade80
  doc.text('EXTRATO DE FATURAMENTO', margin + 5, y + 6);
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Detalhamento de Cobrança', margin + 5, y + 13);
  y += 22;

  // Client info block (box with green left border)
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 30, 2, 2, 'FD');
  // Green left accent (3pt ≈ 1mm)
  doc.setFillColor(76, 159, 56); // #4C9F38
  doc.rect(margin, y, 1.2, 30, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(76, 159, 56);
  doc.text('CONTRATANTE', margin + 5, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59); // DARK
  doc.text(data.cliente.nome, margin + 5, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (data.cliente.cnpj) {
    doc.text(`CNPJ: ${data.cliente.cnpj}`, margin + 5, y + 18);
  }
  const now = new Date();
  const mesRef = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  doc.text(`Competência: ${mesRef}`, margin + 5, y + 24);
  doc.text(`Emissão: ${now.toLocaleDateString('pt-BR')}`, margin + 5, y + 28);

  // Summary values on right side
  const totalHonorarios = data.processos.reduce((sum, p) => {
    return sum + Number(p.lancamento?.valor ?? p.valor ?? 0);
  }, 0);
  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((sum, va) => sum + Number(va.valor), 0);
  const totalGeral = totalHonorarios + totalTaxas;

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

  // KPI boxes (3 columns)
  const kpiW = (contentW - 6) / 3;
  const kpis = [
    { label: 'Qtd. Processos', value: String(data.processos.length) },
    { label: 'Desconto Contratual', value: `${data.cliente.desconto_progressivo ?? 0}%` },
    { label: 'Valor Base Unitário', value: formatBRL(data.cliente.valor_base ?? 0) },
  ];
  kpis.forEach((kpi, i) => {
    const x = margin + i * (kpiW + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, kpiW, 18, 2, 2, 'FD');
    // Top green accent
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

  // Contatos Trevo (footer da capa)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const contactLine = `${BRAND.site}  •  ${BRAND.email}  •  ${BRAND.telefone}`;
  doc.text(contactLine, pageW / 2, y + 9, { align: 'center' });

  // ─── Page 2 – Detalhamento ───
  doc.addPage();
  y = drawHeader(margin + 2);

  // Banner
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

  // Section title: Honorários
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(76, 159, 56);
  doc.text('TABELA 1 — HONORÁRIOS (ESCADINHA DE DESCONTO)', margin, y);
  y += 4;

  // Build honorarios table with progressive discount breakdown
  const valorBase = data.cliente.valor_base ?? 0;
  const descPct = data.cliente.desconto_progressivo ?? 0;

  const honorariosRows = data.processos.map((p, idx) => {
    const valorFinal = Number(p.lancamento?.valor ?? p.valor ?? 0);
    const desconto = valorBase - valorFinal;
    const descontoLabel = desconto > 0
      ? `-${descPct}% (${formatBRL(desconto)})`
      : '—';
    return [
      String(idx + 1) + 'º',
      formatDate(p.created_at),
      `${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)} — ${p.razao_social}`,
      formatBRL(valorBase),
      descontoLabel,
      formatBRL(valorFinal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Proc.', 'Data', 'Descrição', 'Valor Base', 'Desc. Progressivo', 'Valor Final']],
    body: honorariosRows,
    theme: 'grid',
    headStyles: {
      fillColor: [22, 101, 52], // #166534
      textColor: 255,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 22 },
      3: { halign: 'right' },
      4: { halign: 'center', textColor: [22, 101, 52] },
      5: { halign: 'right', fontStyle: 'bold', textColor: [22, 101, 52] },
    },
    alternateRowStyles: { fillColor: [240, 253, 244] }, // #f0fdf4
    margin: { left: margin, right: margin },
    foot: [['', '', '', '', 'Subtotal Honorários', formatBRL(totalHonorarios)]],
    footStyles: {
      fillColor: [220, 252, 231], // #dcfce7
      textColor: [22, 101, 52],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'right',
    },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Table 2 – Taxas / Reembolsos
  if (allTaxas.length > 0) {
    if (y > pageH - 60) {
      doc.addPage();
      y = drawHeader(margin + 2) + 6;
    }

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
      headStyles: {
        fillColor: [22, 101, 52],
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
      },
      bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
      columnStyles: {
        2: { halign: 'right', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: margin, right: margin },
      foot: [['', 'Subtotal Taxas', formatBRL(totalTaxas)]],
      footStyles: {
        fillColor: [220, 252, 231],
        textColor: [22, 101, 52],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'right',
      },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Total Geral bar
  if (y > pageH - 30) {
    doc.addPage();
    y = drawHeader(margin + 2) + 6;
  }

  doc.setFillColor(15, 31, 15); // #0f1f0f
  doc.roundedRect(margin, y, contentW, 16, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(74, 222, 128);
  doc.text('TOTAL GERAL', margin + 6, y + 7);
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text(formatBRL(totalGeral), pageW - margin - 6, y + 12, { align: 'right' });

  y += 22;

  // Progressive discount legal note
  if (descPct > 0 && y < pageH - 30) {
    doc.setFillColor(240, 253, 244); // light green
    doc.setDrawColor(134, 239, 172); // #86efac
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentW, 14, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(22, 101, 52);
    doc.text('REGRA DE DESCONTO PROGRESSIVO', margin + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.text(
      `Desconto composto de ${descPct}% a cada processo na mesma competência mensal. No mês seguinte, o valor retorna ao valor base de ${formatBRL(valorBase)}.`,
      margin + 4, y + 10
    );
  }

  // ─── Attachment pages (comprovantes) ───
  await renderAttachmentPages(doc, data);

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Bottom green line
    doc.setDrawColor(76, 159, 56);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 12, pageW - margin, pageH - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // #94a3b8
    doc.text(
      `Extrato gerado em ${now.toLocaleDateString('pt-BR')} — ${BRAND.fantasia} — Página ${i}/${totalPages}`,
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    );
  }

  return doc;
}

/** Render attachment images (boletos, guias) as extra pages */
async function renderAttachmentPages(doc: jsPDF, data: ExtratoData) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;

  // Collect all attachment URLs
  const attachments: { label: string; url: string }[] = [];

  for (const p of data.processos) {
    const lanc = p.lancamento;
    if (lanc?.boleto_url) {
      attachments.push({ label: `Boleto — ${p.razao_social}`, url: lanc.boleto_url });
    }
    if (lanc?.url_recibo_taxa) {
      attachments.push({ label: `Guia/Recibo Taxa — ${p.razao_social}`, url: lanc.url_recibo_taxa });
    }
    if (lanc?.comprovante_url) {
      attachments.push({ label: `Comprovante — ${p.razao_social}`, url: lanc.comprovante_url });
    }
  }

  // Also check valores_adicionais attachments
  const allVAs = Object.values(data.valoresAdicionais).flat();
  for (const va of allVAs) {
    if (va.comprovante_url) {
      attachments.push({ label: `Comprovante Taxa — ${va.descricao}`, url: va.comprovante_url });
    }
    if (va.anexo_url) {
      attachments.push({ label: `Anexo — ${va.descricao}`, url: va.anexo_url });
    }
  }

  if (attachments.length === 0) return;

  for (const att of attachments) {
    try {
      // Try to load image
      const imgData = await loadImageAsBase64(att.url);
      if (!imgData) continue;

      doc.addPage();
      // Simple header
      doc.setFillColor(15, 31, 15);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(74, 222, 128);
      doc.text('ANEXO', margin, 6);
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(att.label, margin, 11);

      // Render image centered
      const maxW = contentW;
      const maxH = pageH - 40;
      doc.addImage(imgData, 'JPEG', margin, 20, maxW, maxH, undefined, 'FAST');
    } catch {
      // If image fails, add a text note
      doc.addPage();
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`Anexo não disponível: ${att.label}`, margin, 30);
      doc.text(`URL: ${att.url}`, margin, 38);
    }
  }
}

/** Load image from URL as base64 data URL */
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

/** Fetch valores_adicionais for multiple processos in one go */
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
