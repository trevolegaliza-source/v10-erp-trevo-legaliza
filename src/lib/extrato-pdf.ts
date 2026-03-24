/**
 * Geração de Extrato de Faturamento em PDF – Layout Trevo Engine V10
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

const GREEN = '#4C9F38';
const LIGHT_GREEN = '#a3e635';
const BG_BLOCK = '#f8fafc';
const DARK = '#1e293b';

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

export interface ExtratoData {
  processos: ProcessoFinanceiro[];
  valoresAdicionais: Record<string, ValorAdicional[]>; // keyed by processo_id
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

  // ─── Header ───
  function drawHeader(yStart: number) {
    // Gradient line
    const gradSteps = 80;
    const lineY = yStart + 18;
    for (let i = 0; i < gradSteps; i++) {
      const ratio = i / gradSteps;
      const r = Math.round(76 + (163 - 76) * ratio);
      const g = Math.round(159 + (230 - 159) * ratio);
      const b = Math.round(56 + (53 - 56) * ratio);
      doc.setDrawColor(r, g, b);
      const segW = contentW / gradSteps;
      doc.setLineWidth(1.2);
      doc.line(margin + segW * i, lineY, margin + segW * (i + 1), lineY);
    }

    // Company name left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(GREEN);
    doc.text('TREVO CONTABILIDADE', margin, yStart + 10);

    // Company info right
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100);
    doc.text('CNPJ: 00.000.000/0001-00', pageW - margin, yStart + 6, { align: 'right' });
    doc.text('contato@trevocontabilidade.com.br', pageW - margin, yStart + 10, { align: 'right' });
    doc.text('Tel: (11) 0000-0000', pageW - margin, yStart + 14, { align: 'right' });

    return lineY + 4;
  }

  // ─── Page 1 – Capa / Resumo ───
  let y = drawHeader(margin);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(DARK);
  y += 8;
  doc.text('EXTRATO DE FATURAMENTO', pageW / 2, y, { align: 'center' });
  y += 10;

  // Client info block
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(GREEN);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, y, contentW, 28, 2, 2, 'FD');
  doc.line(margin, y, margin, y + 28); // left accent
  doc.setLineWidth(0.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text('CONTRATANTE', margin + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text(data.cliente.nome, margin + 5, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80);
  if (data.cliente.cnpj) {
    doc.text(`CNPJ: ${data.cliente.cnpj}`, margin + 5, y + 19);
  }
  const periodoText = `Período: ${formatDate(new Date().toISOString())}`;
  doc.text(periodoText, margin + 5, y + 25);

  // Summary on right
  const totalHonorarios = data.processos.reduce((sum, p) => {
    const lanc = p.lancamento;
    return sum + Number(lanc?.valor ?? p.valor ?? 0);
  }, 0);

  const allTaxas = Object.values(data.valoresAdicionais).flat();
  const totalTaxas = allTaxas.reduce((sum, va) => sum + Number(va.valor), 0);
  const totalGeral = totalHonorarios + totalTaxas;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(GREEN);
  doc.text(`Total: ${formatBRL(totalGeral)}`, pageW - margin - 5, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`Honorários: ${formatBRL(totalHonorarios)}`, pageW - margin - 5, y + 19, { align: 'right' });
  doc.text(`Taxas: ${formatBRL(totalTaxas)}`, pageW - margin - 5, y + 25, { align: 'right' });

  y += 36;

  // Summary KPIs
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentW / 3 - 3, 18, 2, 2, 'F');
  doc.roundedRect(margin + contentW / 3 + 1, y, contentW / 3 - 3, 18, 2, 2, 'F');
  doc.roundedRect(margin + (contentW / 3) * 2 + 2, y, contentW / 3 - 3, 18, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100);
  doc.text('Qtd. Processos', margin + 5, y + 6);
  doc.text('Desconto Contratual', margin + contentW / 3 + 6, y + 6);
  doc.text('Valor Base', margin + (contentW / 3) * 2 + 7, y + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(DARK);
  doc.text(String(data.processos.length), margin + 5, y + 14);
  doc.text(`${data.cliente.desconto_progressivo ?? 0}%`, margin + contentW / 3 + 6, y + 14);
  doc.text(formatBRL(data.cliente.valor_base ?? 0), margin + (contentW / 3) * 2 + 7, y + 14);

  y += 26;

  // ─── Page 2 – Detalhamento ───
  doc.addPage();
  y = drawHeader(margin);
  y += 6;

  // Table 1 – Honorários
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(DARK);
  doc.text('HONORÁRIOS', margin, y);
  y += 4;

  const honorariosRows = data.processos.map((p, idx) => {
    const valorBase = data.cliente.valor_base ?? 0;
    const valorFinal = Number(p.lancamento?.valor ?? p.valor ?? 0);
    const desconto = valorBase - valorFinal;
    return [
      formatDate(p.created_at),
      `${p.tipo.charAt(0).toUpperCase() + p.tipo.slice(1)} - ${p.razao_social}`,
      formatBRL(valorBase),
      desconto > 0 ? `${data.cliente.desconto_progressivo}% (-${formatBRL(desconto)})` : '-',
      formatBRL(valorFinal),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Data', 'Processo', 'Valor Base', 'Desc. Progressivo', 'Valor Final']],
    body: honorariosRows,
    theme: 'grid',
    headStyles: { fillColor: [76, 159, 56], textColor: 255, fontSize: 8, font: 'helvetica' },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59], font: 'helvetica' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
    foot: [['', '', '', 'Subtotal', formatBRL(totalHonorarios)]],
    footStyles: { fillColor: [240, 245, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // Table 2 – Taxas / Reembolsos
  if (allTaxas.length > 0) {
    if (y > pageH - 60) {
      doc.addPage();
      y = drawHeader(margin) + 6;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(DARK);
    doc.text('TAXAS E REEMBOLSOS', margin, y);
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
      headStyles: { fillColor: [76, 159, 56], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
      foot: [['', 'Subtotal Taxas', formatBRL(totalTaxas)]],
      footStyles: { fillColor: [240, 245, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 9 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Total Geral
  if (y > pageH - 30) {
    doc.addPage();
    y = drawHeader(margin) + 6;
  }

  doc.setFillColor(76, 159, 56);
  doc.roundedRect(margin, y, contentW, 14, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL GERAL', margin + 5, y + 9);
  doc.text(formatBRL(totalGeral), pageW - margin - 5, y + 9, { align: 'right' });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Extrato gerado em ${new Date().toLocaleDateString('pt-BR')} — Página ${i}/${totalPages}`,
      pageW / 2,
      pageH - 8,
      { align: 'center' }
    );
  }

  return doc;
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
