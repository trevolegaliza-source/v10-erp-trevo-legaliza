import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import type { ValorAdicional } from '@/hooks/useValoresAdicionais';
import { supabase } from '@/integrations/supabase/client';

const BRAND = {
  nome: 'TREVO LEGALIZA LTDA',
  fantasia: 'Trevo Legaliza',
  cnpj: '39.969.412/0001-70',
  endereco: 'Rua Brasil, nº 1170, Rudge Ramos, SBC/SP',
  email: 'administrativo@trevolegaliza.com.br',
  telefone: '(11) 93492-7001',
};

const LOGO_URL = 'https://gwyinucaeaayuckvevma.supabase.co/storage/v1/object/public/documentos/logo%2Ftrevo-legaliza.png';

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function monthKeyFromDate(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (char) => char.toUpperCase());
}

function truncateText(value: string | null | undefined, max = 50) {
  const safe = (value ?? '').trim();
  return safe.length > max ? `${safe.slice(0, max - 1)}…` : safe;
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
    telefone: string | null;
    email: string | null;
    nome_contador: string | null;
    dia_cobranca: number | null;
    dia_vencimento_mensal: number | null;
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
  isBoasVindas: boolean;
  isCortesia: boolean;
  label: string;
  slotsUsados: number;
  mes: string;
}

const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
  :root {
    --trevo: 142 71% 45%;
    --trevo-dark: 145 49% 12%;
    --trevo-deep: 150 28% 9%;
    --trevo-soft: 138 67% 96%;
    --ink: 152 18% 12%;
    --muted: 215 16% 47%;
    --line: 214 32% 91%;
    --surface: 0 0% 100%;
    --surface-soft: 210 40% 98%;
    --warning-bg: 48 100% 96%;
    --warning-fg: 28 89% 32%;
    --danger-bg: 0 86% 97%;
    --danger-fg: 0 74% 42%;
    --info-bg: 215 100% 97%;
    --info-fg: 215 70% 40%;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body, div, span, p, td, th { font-family: 'DM Sans', sans-serif; color: hsl(var(--ink)); }
  body { background: hsl(var(--surface-soft)); }
  .page { width: 794px; min-height: 1123px; background: hsl(var(--surface)); position: relative; overflow: visible; }
  .page-inner { padding: 22px 34px 126px; }
  .top-accent { width: 100%; height: 6px; background: linear-gradient(90deg, hsl(var(--trevo)) 0%, hsl(89 80% 55%) 100%); }
  .pdf-header { display: flex; justify-content: space-between; align-items: center; padding: 18px 34px 16px; border-bottom: 1px solid hsl(var(--line)); background: hsl(var(--surface)); }
  .header-logo img { width: 190px; height: auto; object-fit: contain; display: block; }
  .header-fallback { font-size: 14px; font-weight: 800; color: hsl(var(--trevo)); }
  .header-right { text-align: right; }
  .header-right .line1 { font-size: 10px; font-weight: 800; color: hsl(var(--ink)); text-transform: uppercase; letter-spacing: 0.8px; }
  .header-right .line2 { font-size: 9px; color: hsl(var(--muted)); margin-top: 2px; }
  .hero { margin-top: 18px; background: linear-gradient(135deg, hsl(var(--trevo-deep)) 0%, hsl(var(--trevo-dark)) 100%); border-radius: 24px; padding: 26px; position: relative; overflow: hidden; }
  .hero::after { content: ''; position: absolute; right: -60px; bottom: -80px; width: 240px; height: 240px; border-radius: 999px; background: radial-gradient(circle, hsla(142, 71%, 45%, 0.32), transparent 70%); }
  .hero > * { position: relative; z-index: 1; }
  .eyebrow { font-size: 9px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: hsl(var(--trevo)); }
  .hero-title { font-size: 30px; line-height: 1.08; font-weight: 800; color: hsl(0 0% 100%); margin-top: 8px; max-width: 82%; }
  .hero-subtitle { font-size: 11px; line-height: 1.5; color: hsl(0 0% 100% / 0.74); margin-top: 8px; }
  .hero-meta-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 7px 11px; border-radius: 999px; background: hsl(0 0% 100% / 0.1); color: hsl(0 0% 100%); font-size: 9px; font-weight: 600; }
  .pill.warning { background: hsl(var(--warning-bg)); color: hsl(var(--warning-fg)); }
  .summary-grid { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 12px; margin-top: 16px; }
  .summary-card { border: 1px solid hsl(var(--line)); border-radius: 20px; padding: 18px; background: hsl(var(--surface)); min-height: 124px; }
  .summary-card.total { background: linear-gradient(135deg, hsl(var(--trevo-deep)) 0%, hsl(var(--trevo-dark)) 100%); border-color: transparent; }
  .summary-card.total .summary-label, .summary-card.total .summary-sub, .summary-card.total .summary-value { color: hsl(0 0% 100%); }
  .summary-label { font-size: 9px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: hsl(var(--muted)); }
  .summary-value { font-size: 28px; font-weight: 800; line-height: 1.1; color: hsl(var(--ink)); margin-top: 10px; }
  .summary-sub { font-size: 10px; line-height: 1.5; color: hsl(var(--muted)); margin-top: 8px; }
  .summary-split { display: grid; gap: 8px; margin-top: 10px; }
  .summary-row { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; }
  .summary-row strong { color: hsl(var(--ink)); }
  .pix-box { margin-top: 12px; padding: 10px 12px; border-radius: 14px; background: hsl(var(--trevo-soft)); }
  .pix-key { font-size: 14px; font-weight: 800; color: hsl(var(--trevo-dark)); margin-top: 4px; }
  .section-card { margin-top: 16px; border: 1px solid hsl(var(--line)); border-radius: 22px; background: hsl(var(--surface)); padding: 18px 20px; }
  .section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
  .section-title { font-size: 18px; line-height: 1.15; font-weight: 800; color: hsl(var(--ink)); margin-top: 3px; }
  .section-counter { flex-shrink: 0; padding: 8px 12px; border-radius: 999px; background: hsl(var(--trevo-soft)); color: hsl(var(--trevo-dark)); font-size: 10px; font-weight: 700; }
  .process-row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid hsl(214 32% 95%); }
  .process-row:last-child { border-bottom: none; }
  .process-left { display: flex; gap: 10px; flex: 1; min-width: 0; }
  .process-slot { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 36px; height: 28px; padding: 0 8px; border-radius: 10px; background: hsl(var(--trevo-soft)); color: hsl(var(--trevo-dark)); font-size: 10px; font-weight: 800; }
  .process-copy { flex: 1; min-width: 0; }
  .process-title { font-size: 11px; font-weight: 800; color: hsl(var(--ink)); line-height: 1.4; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .process-meta { font-size: 9px; color: hsl(var(--muted)); margin-top: 4px; }
  .process-value { font-size: 15px; font-weight: 800; color: hsl(var(--trevo-deep)); text-align: right; white-space: nowrap; }
  .badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 3px 8px; font-size: 7px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; }
  .badge.manual { background: hsl(var(--warning-bg)); color: hsl(var(--warning-fg)); }
  .badge.urgent { background: hsl(var(--danger-bg)); color: hsl(var(--danger-fg)); }
  .badge.bv { background: hsl(var(--trevo-soft)); color: hsl(var(--trevo-dark)); }
  .badge.info { background: hsl(var(--info-bg)); color: hsl(var(--info-fg)); }
  .month-divider { display: flex; align-items: center; gap: 10px; margin: 14px 0 4px; }
  .month-divider .line { flex: 1; height: 1px; background: hsl(var(--line)); }
  .month-divider .text { font-size: 9px; font-weight: 700; color: hsl(var(--muted)); letter-spacing: 1.2px; text-transform: uppercase; }
  .section-note { margin-top: 10px; font-size: 9px; color: hsl(var(--muted)); }
  .next-card { margin-top: 16px; border-radius: 20px; border: 1px solid hsl(138 55% 84%); background: linear-gradient(135deg, hsl(var(--trevo-soft)) 0%, hsl(0 0% 100%) 100%); padding: 16px 18px; }
  .next-card-title { font-size: 9px; font-weight: 800; color: hsl(var(--trevo)); letter-spacing: 1.2px; text-transform: uppercase; }
  .next-card-main { font-size: 15px; line-height: 1.45; color: hsl(var(--trevo-dark)); margin-top: 6px; }
  .next-card-sub { font-size: 9px; line-height: 1.5; color: hsl(var(--muted)); margin-top: 6px; }
  .progress-card { margin-top: 16px; border-radius: 22px; border: 1px solid hsl(var(--line)); background: hsl(var(--surface)); padding: 18px 20px; }
  .progress-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  .progress-table thead th { background: hsl(var(--trevo-deep)); color: hsl(0 0% 100%); font-size: 8px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; padding: 9px 10px; text-align: left; }
  .progress-table td { font-size: 9px; padding: 8px 10px; border-bottom: 1px solid hsl(214 32% 94%); color: hsl(var(--ink)); }
  .progress-table .value-cell { font-weight: 800; color: hsl(var(--trevo-dark)); }
  .progress-table .desc-cell { color: hsl(var(--muted)); }
  .progress-table .month-row td { background: hsl(var(--surface-soft)); color: hsl(var(--muted)); font-size: 8px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding-top: 10px; }
  .progress-table .next-row td { background: hsl(var(--trevo-soft)); }
  .progress-legal { font-size: 8.5px; line-height: 1.55; color: hsl(var(--muted)); margin-top: 10px; }
  .detail-banner { margin-top: 18px; border-radius: 22px; background: linear-gradient(135deg, hsl(var(--trevo-deep)) 0%, hsl(var(--trevo-dark)) 100%); padding: 18px 22px; }
  .detail-banner .section-title { color: hsl(0 0% 100%); }
  .detail-banner .eyebrow { color: hsl(var(--trevo)); }
  .detail-banner-meta { font-size: 9px; color: hsl(0 0% 100% / 0.72); margin-top: 6px; }
  .detail-list { margin-top: 16px; display: grid; gap: 14px; }
  .detail-card { border: 1px solid hsl(var(--line)); border-radius: 20px; overflow: hidden; background: hsl(var(--surface)); page-break-inside: avoid; }
  .detail-card-head { display: flex; justify-content: space-between; gap: 12px; padding: 16px 18px; background: linear-gradient(135deg, hsl(var(--trevo-deep)) 0%, hsl(var(--trevo-dark)) 100%); }
  .detail-left { display: flex; gap: 12px; flex: 1; min-width: 0; }
  .detail-index { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 42px; height: 36px; padding: 0 10px; border-radius: 12px; background: hsl(0 0% 100%); color: hsl(var(--trevo-dark)); font-size: 11px; font-weight: 800; }
  .detail-title { font-size: 11px; line-height: 1.45; font-weight: 800; color: hsl(0 0% 100%); text-transform: uppercase; }
  .detail-meta { font-size: 8.5px; line-height: 1.55; color: hsl(0 0% 100% / 0.72); margin-top: 5px; }
  .detail-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .detail-value { text-align: right; min-width: 128px; }
  .detail-value-main { font-size: 18px; font-weight: 800; color: hsl(0 0% 100%); }
  .detail-value-sub { font-size: 8px; color: hsl(0 0% 100% / 0.72); margin-top: 4px; }
  .detail-body { padding: 14px 18px 16px; }
  .detail-body-row { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; color: hsl(var(--muted)); margin-bottom: 10px; }
  .detail-body-row strong { color: hsl(var(--ink)); }
  .tax-table { width: 100%; border-collapse: collapse; border: 1px solid hsl(var(--line)); border-radius: 14px; overflow: hidden; }
  .tax-table th { background: hsl(var(--surface-soft)); font-size: 8px; font-weight: 800; color: hsl(var(--muted)); letter-spacing: 0.6px; text-transform: uppercase; padding: 8px 10px; text-align: left; }
  .tax-table th:last-child, .tax-table td:last-child { text-align: right; }
  .tax-table td { font-size: 9px; padding: 8px 10px; border-top: 1px solid hsl(214 32% 94%); }
  .tax-total { margin-top: 10px; display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 14px; background: hsl(var(--surface-soft)); font-size: 10px; }
  .tax-total strong { color: hsl(var(--trevo-dark)); }
  .transparency-note { margin-top: 12px; padding: 9px 12px; border-radius: 14px; background: hsl(var(--warning-bg)); color: hsl(var(--warning-fg)); font-size: 8.5px; line-height: 1.5; }
  .footer-contact { position: absolute; left: 34px; right: 34px; bottom: 34px; border-top: 1px solid hsl(var(--line)); padding-top: 12px; display: flex; justify-content: space-between; gap: 16px; font-size: 8.5px; color: hsl(var(--muted)); }
  .footer-contact strong { color: hsl(var(--ink)); }
  .page-footer { position: absolute; left: 34px; right: 34px; bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; color: hsl(var(--muted)); }
`;

function buildEscadinha(data: ExtratoData): StepInfo[] {
  const base = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;
  const selectedIds = new Set(data.processos.map((processo) => processo.id));

  const unique = new Map<string, ProcessoFinanceiro>();
  [...data.allCompetencia, ...data.processos].forEach((processo) => {
    if (!unique.has(processo.id)) unique.set(processo.id, processo);
  });

  const porMes = new Map<string, ProcessoFinanceiro[]>();
  unique.forEach((processo) => {
    const key = monthKeyFromDate(processo.created_at);
    if (!porMes.has(key)) porMes.set(key, []);
    porMes.get(key)!.push(processo);
  });

  const steps: StepInfo[] = [];

  [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([mes, processosMes]) => {
      processosMes.sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        return timeA - timeB || a.id.localeCompare(b.id);
      });

      let slot = 0;

      processosMes.forEach((processo) => {
        const notasRaw = processo.notas || '';
        const notas = notasRaw.toLowerCase();
        const isMudancaUF = notas.includes('mudança de uf') || notas.includes('mudanca de uf');
        const isUrgencia = notas.includes('urgência') || notas.includes('urgencia');
        const hasManualFlag = notas.includes('valor manual') || notas.includes('is_manual');
        const hasBoasVindas = notas.includes('boas-vindas') || notas.includes('boas vindas');
        const hasCortesia = notas.includes('cortesia');

        const valorProcesso = processo.valor != null ? Number(processo.valor) : Number.NaN;
        const valorLancamento = (processo as any).lancamento?.valor != null ? Number((processo as any).lancamento.valor) : Number.NaN;
        const valorReal = Number.isFinite(valorProcesso)
          ? valorProcesso
          : (Number.isFinite(valorLancamento) ? valorLancamento : 0);

        if (isMudancaUF) {
          const startSlot = slot + 1;
          slot += 2;
          const valorFinal = round2(valorReal || 0);
          steps.push({
            index: startSlot,
            processo,
            valorBase: base,
            desconto: 0,
            valorFinal,
            isSelected: selectedIds.has(processo.id),
            isMudancaUF: true,
            isManual: false,
            isUrgencia: false,
            isBoasVindas: false,
            isCortesia: hasCortesia || valorFinal === 0,
            label: 'MUDANÇA DE UF',
            slotsUsados: 2,
            mes,
          });
          return;
        }

        slot += 1;

        if (hasManualFlag || hasBoasVindas || hasCortesia) {
          const matchBoasVindas = notasRaw.match(/[Bb]oas[- ]?[Vv]indas\s*(\d+)\s*%/);
          const valorFinal = round2(hasCortesia ? 0 : valorReal);
          steps.push({
            index: slot,
            processo,
            valorBase: base,
            desconto: 0,
            valorFinal,
            isSelected: selectedIds.has(processo.id),
            isMudancaUF: false,
            isManual: hasManualFlag || hasCortesia,
            isUrgencia: false,
            isBoasVindas: hasBoasVindas,
            isCortesia: hasCortesia || valorFinal === 0,
            label: hasCortesia
              ? 'CORTESIA'
              : hasManualFlag
                ? 'VALOR MANUAL'
                : (matchBoasVindas ? `BOAS-VINDAS ${matchBoasVindas[1]}%` : 'BOAS-VINDAS'),
            slotsUsados: 1,
            mes,
          });
          return;
        }

        let valorFinal = base;
        let desconto = 0;
        let label = '(base)';

        if (slot > 1 && descPct > 0) {
          const fator = Math.pow(1 - descPct / 100, slot - 1);
          valorFinal = base * fator;
          if (limite > 0 && valorFinal < limite) valorFinal = limite;
          desconto = Math.round((1 - valorFinal / base) * 100);
          label = `-${desconto}% sobre base`;
        }

        if (isUrgencia) {
          valorFinal *= 1.5;
          label += ' +50% URG';
        }

        steps.push({
          index: slot,
          processo,
          valorBase: base,
          desconto,
          valorFinal: round2(valorFinal),
          isSelected: selectedIds.has(processo.id),
          isMudancaUF: false,
          isManual: false,
          isUrgencia,
          isBoasVindas: false,
          isCortesia: false,
          label,
          slotsUsados: 1,
          mes,
        });
      });
    });

  return steps;
}

function groupStepsByMonth(steps: StepInfo[]) {
  const grouped = new Map<string, StepInfo[]>();
  steps.forEach((step) => {
    if (!grouped.has(step.mes)) grouped.set(step.mes, []);
    grouped.get(step.mes)!.push(step);
  });
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function calculateVencimento(cliente: ExtratoData['cliente'], emissionBase = new Date()) {
  const emissao = new Date(emissionBase);
  emissao.setHours(12, 0, 0, 0);

  let vencimento = new Date(emissao);
  if (cliente.dia_vencimento_mensal && cliente.dia_vencimento_mensal > 0) {
    vencimento = new Date(emissao.getFullYear(), emissao.getMonth(), cliente.dia_vencimento_mensal, 12, 0, 0, 0);
    if (vencimento.getTime() <= emissao.getTime()) vencimento.setMonth(vencimento.getMonth() + 1);
  } else if (cliente.dia_cobranca && cliente.dia_cobranca > 0) {
    vencimento.setDate(vencimento.getDate() + cliente.dia_cobranca);
  } else {
    vencimento.setDate(vencimento.getDate() + 2);
  }

  return vencimento;
}

function calculateNextStepValue(slotNumber: number, data: ExtratoData) {
  const base = data.cliente.valor_base ?? 580;
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const limite = data.cliente.valor_limite_desconto ?? 0;

  if (slotNumber <= 1 || descPct <= 0) return round2(base);

  let valorFinal = base * Math.pow(1 - descPct / 100, slotNumber - 1);
  if (limite > 0 && valorFinal < limite) valorFinal = limite;
  return round2(valorFinal);
}

function buildHeaderHTML(logoDataUrl: string | null) {
  const logoHtml = logoDataUrl
    ? `<div class="header-logo"><img src="${logoDataUrl}" alt="Trevo Legaliza" /></div>`
    : `<div class="header-fallback">Trevo Legaliza</div>`;

  return `
    <div class="pdf-header">
      ${logoHtml}
      <div class="header-right">
        <div class="line1">${BRAND.nome}</div>
        <div class="line2">CNPJ ${BRAND.cnpj} · Atuação nacional</div>
      </div>
    </div>
  `;
}

function buildFooterHTML(pageNumber: number, totalPages: number) {
  return `
    <div class="footer-contact">
      <div><strong>${escapeHtml(BRAND.fantasia)}</strong> · CNPJ ${escapeHtml(BRAND.cnpj)}</div>
      <div>${escapeHtml(BRAND.endereco)} · ${escapeHtml(BRAND.email)} · ${escapeHtml(BRAND.telefone)}</div>
    </div>
    <div class="page-footer">
      <span>Trevo Legaliza</span>
      <span>PÁGINA ${pageNumber} DE ${totalPages}</span>
    </div>
  `;
}

function buildStepBadges(step: StepInfo) {
  const badges: string[] = [];
  if (step.isManual && !step.isCortesia) badges.push('<span class="badge manual">Valor manual</span>');
  if (step.isBoasVindas) badges.push('<span class="badge bv">Boas-vindas</span>');
  if (step.isUrgencia) badges.push('<span class="badge urgent">Urgência +50%</span>');
  if (step.isMudancaUF) badges.push('<span class="badge info">Mudança de UF</span>');
  if (step.isCortesia) badges.push('<span class="badge bv">Cortesia</span>');
  return badges.join('');
}

function getStepStatusText(step: StepInfo) {
  if (step.isMudancaUF) return 'Mudança de UF';
  if (step.isCortesia) return 'Cortesia';
  if (step.isBoasVindas) return 'Boas-vindas';
  if (step.isManual) return 'Valor manual';
  if (step.isUrgencia) return 'Urgência +50%';
  return '—';
}

function getStepDiscountText(step: StepInfo) {
  return !step.isManual && !step.isMudancaUF && !step.isBoasVindas && step.desconto > 0 ? `-${step.desconto}%` : '—';
}

function buildSelectedProcessesHTML(selected: StepInfo[], maxVisible: number) {
  const visible = selected.slice(0, maxVisible);
  const groups = groupStepsByMonth(visible);

  return groups.map(([monthKey, monthSteps], index) => `
    ${index > 0 ? `<div class="month-divider"><div class="line"></div><div class="text">Processos de ${escapeHtml(formatMonthLabel(monthKey))}</div><div class="line"></div></div>` : ''}
    ${monthSteps.map((step) => `
      <div class="process-row">
        <div class="process-left">
          <div class="process-slot">${step.isMudancaUF ? `${step.index}º-${step.index + 1}º` : `${step.index}º`}</div>
          <div class="process-copy">
            <div class="process-title">
              <span>${escapeHtml(`${String(step.processo.tipo).toUpperCase()} — ${truncateText(step.processo.razao_social, 46)}`)}</span>
              ${buildStepBadges(step)}
            </div>
            <div class="process-meta">${fmtDate(step.processo.created_at)} · ${escapeHtml(step.label)}</div>
          </div>
        </div>
        <div class="process-value">${fmt(step.valorFinal)}</div>
      </div>
    `).join('')}
  `).join('');
}

function buildNextDiscountCardHTML(steps: StepInfo[], selected: StepInfo[], data: ExtratoData) {
  const descPct = data.cliente.desconto_progressivo ?? 0;
  const onlyManual = selected.length > 0 && selected.every((step) => step.isManual || step.isCortesia);
  if (descPct <= 0 || onlyManual || steps.length === 0) return '';

  const monthGroups = groupStepsByMonth(steps);
  const [latestMonthKey, latestSteps] = monthGroups[monthGroups.length - 1];
  const nextSlot = latestSteps.reduce((sum, step) => sum + step.slotsUsados, 0) + 1;
  const nextValue = calculateNextStepValue(nextSlot, data);
  const minimoTexto = data.cliente.valor_limite_desconto ? fmt(data.cliente.valor_limite_desconto) : 'não definido';

  return `
    <div class="next-card">
      <div class="next-card-title">Seu próximo desconto</div>
      <div class="next-card-main">
        Envie o <strong>${nextSlot}º processo</strong> em ${escapeHtml(formatMonthLabel(latestMonthKey))} e pague apenas
        <strong>${fmt(nextValue)}</strong>.
      </div>
      <div class="next-card-sub">
        Desconto composto de ${descPct}% · Mínimo ${minimoTexto} · Reinicia na competência seguinte.
      </div>
    </div>
  `;
}

function buildProgressionTableHTML(steps: StepInfo[], selected: StepInfo[], data: ExtratoData) {
  const descPct = data.cliente.desconto_progressivo ?? 0;
  if (descPct <= 0 || steps.length === 0) return '';

  const selectedIds = new Set(selected.map((step) => step.processo.id));
  const monthGroups = groupStepsByMonth(steps);
  const latestMonthKey = monthGroups[monthGroups.length - 1]?.[0];

  const rows = monthGroups.map(([monthKey, monthSteps]) => {
    const monthRows = monthSteps.map((step) => `
      <tr>
        <td>${step.isMudancaUF ? `${step.index}º-${step.index + 1}º` : `${step.index}º`}</td>
        <td class="value-cell">${fmt(step.valorFinal)}</td>
        <td class="desc-cell">${escapeHtml(getStepDiscountText(step))}</td>
        <td>${escapeHtml(getStepStatusText(step))}</td>
        <td>${selectedIds.has(step.processo.id) ? 'COBRADO' : '—'}</td>
      </tr>
    `).join('');

    const nextRow = monthKey === latestMonthKey
      ? (() => {
          const nextSlot = monthSteps.reduce((sum, step) => sum + step.slotsUsados, 0) + 1;
          const nextValue = calculateNextStepValue(nextSlot, data);
          return `
            <tr class="next-row">
              <td>${nextSlot}º</td>
              <td class="value-cell">${fmt(nextValue)}</td>
              <td class="desc-cell">-${descPct}%</td>
              <td>Próximo da competência</td>
              <td>PRÓXIMO</td>
            </tr>
          `;
        })()
      : '';

    return `
      <tr class="month-row"><td colspan="5">Processos de ${escapeHtml(formatMonthLabel(monthKey))}</td></tr>
      ${monthRows}
      ${nextRow}
    `;
  }).join('');

  const legalText = `Regra: desconto progressivo de ${descPct}% por processo dentro da mesma competência mensal${
    data.cliente.valor_limite_desconto ? `, respeitando o mínimo de ${fmt(data.cliente.valor_limite_desconto)}` : ''
  }. No mês seguinte, a contagem reinicia no valor base.`;

  return `
    <div class="progress-card">
      <div class="eyebrow">Progressão de incentivo por volume</div>
      <div class="section-title">Escadinha aplicada nesta cobrança</div>
      <table class="progress-table">
        <thead>
          <tr>
            <th>Proc</th>
            <th>Valor</th>
            <th>Desc</th>
            <th>Status</th>
            <th>Extrato</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="progress-legal">${escapeHtml(legalText)}</div>
    </div>
  `;
}

function shouldCreateDetailPages(selected: StepInfo[], data: ExtratoData) {
  return selected.length > 2 || selected.some((step) => (data.valoresAdicionais[step.processo.id] || []).length > 0);
}

function paginateDetailSteps(selected: StepInfo[], data: ExtratoData) {
  const pages: StepInfo[][] = [];
  let current: StepInfo[] = [];
  let currentWeight = 0;
  const pageCapacity = 5.8;

  selected.forEach((step) => {
    const taxas = data.valoresAdicionais[step.processo.id] || [];
    const weight = 1.2 + Math.min(1.8, taxas.length * 0.38);

    if (current.length > 0 && currentWeight + weight > pageCapacity) {
      pages.push(current);
      current = [step];
      currentWeight = weight;
      return;
    }

    current.push(step);
    currentWeight += weight;
  });

  if (current.length > 0) pages.push(current);
  return pages;
}

function buildPage1HTML(
  data: ExtratoData,
  steps: StepInfo[],
  selected: StepInfo[],
  logoDataUrl: string | null,
  totalPages: number,
  detailPageCount: number,
) {
  const emissaoDate = new Date();
  const emissao = emissaoDate.toLocaleDateString('pt-BR');
  const vencimento = calculateVencimento(data.cliente, emissaoDate).toLocaleDateString('pt-BR');
  const selectedIds = new Set(selected.map((step) => step.processo.id));
  const totalHon = selected.reduce((sum, step) => sum + step.valorFinal, 0);
  const totalTaxas = Object.entries(data.valoresAdicionais)
    .filter(([processoId]) => selectedIds.has(processoId))
    .flatMap(([, valores]) => valores)
    .reduce((sum, valorAdicional) => sum + Number(valorAdicional.valor), 0);
  const totalGeral = totalHon + totalTaxas;

  const datasSelecionadas = selected.map((step) => new Date(step.processo.created_at));
  const menorData = datasSelecionadas.length > 0 ? new Date(Math.min(...datasSelecionadas.map((date) => date.getTime()))) : emissaoDate;
  const maiorData = datasSelecionadas.length > 0 ? new Date(Math.max(...datasSelecionadas.map((date) => date.getTime()))) : emissaoDate;
  const periodoTexto = `${menorData.toLocaleDateString('pt-BR')} até ${maiorData.toLocaleDateString('pt-BR')}`;

  const previewCount = detailPageCount > 0 ? Math.min(selected.length, 4) : Math.min(selected.length, 6);
  const hiddenCount = Math.max(selected.length - previewCount, 0);

  return `
    <div class="page" id="page1">
      <div class="top-accent"></div>
      ${buildHeaderHTML(logoDataUrl)}
      <div class="page-inner">
        <div class="hero">
          <div class="eyebrow">Extrato de faturamento</div>
          <div class="hero-title">${escapeHtml(data.cliente.nome)}</div>
          <div class="hero-subtitle">${escapeHtml([
            data.cliente.cnpj,
            data.cliente.nome_contador ? `${data.cliente.nome_contador} (contador)` : null,
          ].filter(Boolean).join(' · '))}</div>
          <div class="hero-meta-row">
            <div class="pill">Período: ${escapeHtml(periodoTexto)}</div>
            <div class="pill">Emissão: ${escapeHtml(emissao)}</div>
            <div class="pill warning">Vencimento: ${escapeHtml(vencimento)}</div>
          </div>
          ${(data.cliente.telefone || data.cliente.email) ? `<div class="hero-subtitle">${escapeHtml([data.cliente.telefone, data.cliente.email].filter(Boolean).join(' · '))}</div>` : ''}
          <div class="hero-subtitle" style="margin-top: 14px; font-size: 8px; opacity: 0.5; letter-spacing: 1px; text-transform: uppercase;">Assessoria societária com atuação em todo o território nacional</div>
        </div>

        <div class="summary-grid">
          <div class="summary-card total">
            <div class="summary-label">Total geral</div>
            <div class="summary-value">${fmt(totalGeral)}</div>
            <div class="summary-sub">${selected.length} processo(s) cobrado(s) · ${escapeHtml(periodoTexto)}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Honorários / Taxas</div>
            <div class="summary-split">
              <div class="summary-row"><span>Honorários</span><strong>${fmt(totalHon)}</strong></div>
              <div class="summary-row"><span>Taxas</span><strong>${fmt(totalTaxas)}</strong></div>
            </div>
            <div class="summary-sub">Totais, contagem e período usam apenas os processos selecionados.</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">PIX (CNPJ)</div>
            <div class="pix-box">
              <div class="summary-sub">Banco C6 Bank</div>
              <div class="pix-key">${escapeHtml(BRAND.cnpj)}</div>
            </div>
            <div class="summary-sub">Se preferir boleto bancário, solicite ao time administrativo.</div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-head">
            <div>
              <div class="eyebrow">Processos cobrados</div>
              <div class="section-title">Resumo do extrato enviado</div>
            </div>
            <div class="section-counter">${selected.length} cobrado(s)</div>
          </div>
          ${buildSelectedProcessesHTML(selected, previewCount)}
          ${hiddenCount > 0 ? `<div class="section-note">+ ${hiddenCount} processo(s) detalhado(s) nas próximas páginas.</div>` : ''}
        </div>

        ${buildNextDiscountCardHTML(steps, selected, data)}
        ${buildProgressionTableHTML(steps, selected, data)}
        ${totalTaxas > 0 ? '<div class="transparency-note">Os comprovantes originais das taxas reembolsáveis continuam disponíveis para conferência na plataforma interna.</div>' : ''}
      </div>
      ${buildFooterHTML(1, totalPages)}
    </div>
  `;
}

function buildDetailPageHTML(
  data: ExtratoData,
  detailSteps: StepInfo[],
  logoDataUrl: string | null,
  pageNumber: number,
  totalPages: number,
  detailPageCount: number,
) {
  const detailCards = detailSteps.map((step) => {
    const processo = step.processo;
    const taxas = data.valoresAdicionais[processo.id] || [];
    const totalTaxas = taxas.reduce((sum, valorAdicional) => sum + Number(valorAdicional.valor), 0);
    const totalBloco = step.valorFinal + totalTaxas;

    const taxTable = taxas.length > 0 ? `
      <table class="tax-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Taxa / reembolso</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          ${taxas.map((valorAdicional) => `
            <tr>
              <td>${fmtDate(valorAdicional.created_at)}</td>
              <td>${escapeHtml(valorAdicional.descricao)}</td>
              <td>${fmt(Number(valorAdicional.valor))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="tax-total">
        <span>Honorários ${fmt(step.valorFinal)} + Taxas ${fmt(totalTaxas)}</span>
        <strong>Total do processo ${fmt(totalBloco)}</strong>
      </div>
    ` : '';

    return `
      <div class="detail-card">
        <div class="detail-card-head">
          <div class="detail-left">
            <div class="detail-index">${step.isMudancaUF ? `${step.index}º-${step.index + 1}º` : `${step.index}º`}</div>
            <div>
              <div class="detail-title">${escapeHtml(`${String(processo.tipo).toUpperCase()} — ${processo.razao_social}`)}</div>
              <div class="detail-meta">${fmtDate(processo.created_at)} · ${escapeHtml(formatMonthLabel(step.mes))} · ${escapeHtml(step.label)}</div>
              <div class="detail-badges">${buildStepBadges(step)}</div>
            </div>
          </div>
          <div class="detail-value">
            <div class="detail-value-main">${fmt(step.valorFinal)}</div>
            <div class="detail-value-sub">Honorários</div>
          </div>
        </div>
        <div class="detail-body">
          <div class="detail-body-row">
            <span>Razão social</span>
            <strong>${escapeHtml(processo.razao_social)}</strong>
          </div>
          <div class="detail-body-row">
            <span>Status aplicado</span>
            <strong>${escapeHtml(getStepStatusText(step))}</strong>
          </div>
          ${taxTable}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="page">
      <div class="top-accent"></div>
      ${buildHeaderHTML(logoDataUrl)}
      <div class="page-inner">
        <div class="detail-banner">
          <div class="eyebrow">Detalhamento unitário</div>
          <div class="section-title">Honorários e taxas por processo</div>
          <div class="detail-banner-meta">Página ${pageNumber - 1} de ${detailPageCount} do detalhamento</div>
        </div>
        <div class="detail-list">${detailCards}</div>
      </div>
      ${buildFooterHTML(pageNumber, totalPages)}
    </div>
  `;
}

function buildAttachmentPageHTML(label: string, imgData: string, logoDataUrl: string | null, pageNumber: number, totalPages: number) {
  return `
    <div class="page">
      <div class="top-accent"></div>
      ${buildHeaderHTML(logoDataUrl)}
      <div class="page-inner">
        <div class="detail-banner">
          <div class="eyebrow">Anexo de comprovante</div>
          <div class="section-title">${escapeHtml(label)}</div>
          <div class="detail-banner-meta">Arquivo complementar do extrato</div>
        </div>
        <div style="margin-top:18px;border:1px solid hsl(var(--line));border-radius:22px;padding:18px;background:hsl(var(--surface));text-align:center;">
          <img src="${imgData}" style="max-width:100%;max-height:760px;object-fit:contain;border-radius:12px;" />
        </div>
        <div class="transparency-note">Os comprovantes originais das taxas reembolsáveis continuam disponíveis para conferência na plataforma interna.</div>
      </div>
      ${buildFooterHTML(pageNumber, totalPages)}
    </div>
  `;
}

async function renderPageToCanvas(html: string, styles: string) {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.innerHTML = `<style>${styles}</style>${html}`;
  document.body.appendChild(container);

  await document.fonts.ready;
  await new Promise((resolve) => setTimeout(resolve, 300));

  const pageEl = container.querySelector('.page') as HTMLElement;
  window.scrollTo(0, 0);
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

let cachedLogoData: string | null = null;

async function preloadLogo() {
  if (cachedLogoData) return cachedLogoData;
  try {
    const response = await fetch(LOGO_URL, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogoData = reader.result as string;
        resolve(cachedLogoData);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export interface ExtratoResult {
  doc: jsPDF;
  totalHonorarios: number;
  totalTaxas: number;
  totalGeral: number;
  processCount: number;
}

function addCanvasToDoc(doc: jsPDF, canvas: HTMLCanvasElement) {
  const pdfWidth = doc.internal.pageSize.getWidth();
  const pdfHeight = doc.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/jpeg', 0.85);

  let imgWidth = pdfWidth;
  let imgHeight = (canvas.height / canvas.width) * pdfWidth;

  if (imgHeight > pdfHeight) {
    const scaleFactor = pdfHeight / imgHeight;
    imgWidth = pdfWidth * scaleFactor;
    imgHeight = pdfHeight;
  }

  const offsetX = (pdfWidth - imgWidth) / 2;
  doc.addImage(imgData, 'JPEG', offsetX, 0, imgWidth, imgHeight);
}

export async function gerarExtratoPDF(data: ExtratoData): Promise<ExtratoResult> {
  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap';
  document.head.appendChild(fontLink);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await document.fonts.ready;

  const logoDataUrl = await preloadLogo();
  const steps = buildEscadinha(data);
  const selected = steps.filter((step) => step.isSelected);

  const selectedIds = new Set(selected.map((step) => step.processo.id));
  const totalHonorarios = round2(selected.reduce((sum, step) => sum + step.valorFinal, 0));
  const totalTaxas = round2(Object.entries(data.valoresAdicionais)
    .filter(([processoId]) => selectedIds.has(processoId))
    .flatMap(([, valores]) => valores)
    .reduce((sum, valorAdicional) => sum + Number(valorAdicional.valor), 0));
  const totalGeral = round2(totalHonorarios + totalTaxas);

  const detailPageGroups = shouldCreateDetailPages(selected, data) ? paginateDetailSteps(selected, data) : [];
  const attachmentCount = countAttachments(data);
  const totalPages = 1 + detailPageGroups.length + attachmentCount;

  const doc = new jsPDF('p', 'mm', 'a4');

  const page1Html = buildPage1HTML(data, steps, selected, logoDataUrl, totalPages, detailPageGroups.length);
  const page1Canvas = await renderPageToCanvas(page1Html, GLOBAL_STYLES);
  addCanvasToDoc(doc, page1Canvas);

  for (let index = 0; index < detailPageGroups.length; index += 1) {
    const detailHtml = buildDetailPageHTML(data, detailPageGroups[index], logoDataUrl, index + 2, totalPages, detailPageGroups.length);
    const detailCanvas = await renderPageToCanvas(detailHtml, GLOBAL_STYLES);
    doc.addPage();
    addCanvasToDoc(doc, detailCanvas);
  }

  await renderAttachments(doc, data, totalPages, detailPageGroups.length + 2, logoDataUrl);

  return {
    doc,
    totalHonorarios,
    totalTaxas,
    totalGeral,
    processCount: selected.length,
  };
}

function countAttachments(data: ExtratoData) {
  let count = 0;

  for (const processo of data.processos) {
    const lancamento = processo.lancamento;
    if (lancamento?.boleto_url) count += 1;
    if (lancamento?.url_recibo_taxa) count += 1;
    if (lancamento?.comprovante_url) count += 1;
  }

  for (const processo of data.processos) {
    const valores = data.valoresAdicionais[processo.id] || [];
    valores.forEach((valorAdicional) => {
      if (valorAdicional.comprovante_url) count += 1;
      if (valorAdicional.anexo_url) count += 1;
    });
  }

  return count;
}

async function resolveStorageUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return pathOrUrl;

  const { data, error } = await supabase.storage
    .from('contratos')
    .createSignedUrl(pathOrUrl, 3600);

  if (error || !data?.signedUrl) throw new Error('Failed to generate signed URL');
  return data.signedUrl;
}

async function renderAttachments(
  doc: jsPDF,
  data: ExtratoData,
  totalPages: number,
  startPageNumber: number,
  logoDataUrl: string | null,
) {
  const attachments: Array<{ label: string; url: string }> = [];

  for (const processo of data.processos) {
    const lancamento = processo.lancamento;
    if (lancamento?.boleto_url) attachments.push({ label: `Boleto — ${processo.razao_social}`, url: lancamento.boleto_url });
    if (lancamento?.url_recibo_taxa) attachments.push({ label: `Guia/Recibo Taxa — ${processo.razao_social}`, url: lancamento.url_recibo_taxa });
    if (lancamento?.comprovante_url) attachments.push({ label: `Comprovante — ${processo.razao_social}`, url: lancamento.comprovante_url });

    const valores = data.valoresAdicionais[processo.id] || [];
    valores.forEach((valorAdicional) => {
      if (valorAdicional.comprovante_url) attachments.push({ label: `Comprovante — ${valorAdicional.descricao}`, url: valorAdicional.comprovante_url });
      if (valorAdicional.anexo_url) attachments.push({ label: `Anexo — ${valorAdicional.descricao}`, url: valorAdicional.anexo_url });
    });
  }

  let pageNumber = startPageNumber;
  for (const attachment of attachments) {
    try {
      const resolvedUrl = await resolveStorageUrl(attachment.url);
      const imgData = await loadImageBase64(resolvedUrl);
      if (!imgData) continue;

      const html = buildAttachmentPageHTML(attachment.label, imgData, logoDataUrl, pageNumber, totalPages);
      const canvas = await renderPageToCanvas(html, GLOBAL_STYLES);
      doc.addPage();
      addCanvasToDoc(doc, canvas);
      pageNumber += 1;
    } catch (error) {
      console.warn(`Erro ao renderizar anexo ${attachment.label}:`, error);
    }
  }
}

async function loadImageBase64(url: string) {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') && !blob.type.startsWith('application/pdf')) return null;

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function fetchValoresAdicionaisMulti(processoIds: string[]): Promise<Record<string, ValorAdicional[]>> {
  const { data, error } = await supabase
    .from('valores_adicionais')
    .select('*')
    .in('processo_id', processoIds)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const map: Record<string, ValorAdicional[]> = {};
  (data || []).forEach((valorAdicional: any) => {
    if (!map[valorAdicional.processo_id]) map[valorAdicional.processo_id] = [];
    map[valorAdicional.processo_id].push(valorAdicional);
  });

  return map;
}

export async function fetchCompetenciaProcessos(
  clienteId: string,
  processosSelecionados?: ProcessoFinanceiro[],
): Promise<ProcessoFinanceiro[]> {
  const mesesUnicos = new Set<string>();

  if (processosSelecionados && processosSelecionados.length > 0) {
    processosSelecionados.forEach((processo) => {
      const dataProcesso = new Date(processo.created_at);
      mesesUnicos.add(`${dataProcesso.getFullYear()}-${dataProcesso.getMonth()}`);
    });
  } else {
    const now = new Date();
    mesesUnicos.add(`${now.getFullYear()}-${now.getMonth()}`);
  }

  let todosProcessos: any[] = [];

  for (const mesKey of mesesUnicos) {
    const [ano, mes] = mesKey.split('-').map(Number);
    const first = new Date(ano, mes, 1).toISOString();
    const last = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('processos')
      .select('*, cliente:clientes(*)')
      .eq('cliente_id', clienteId)
      .gte('created_at', first)
      .lte('created_at', last)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (data) todosProcessos = [...todosProcessos, ...data];
  }

  const idsVistos = new Set<string>();
  todosProcessos = todosProcessos.filter((processo) => {
    if (idsVistos.has(processo.id)) return false;
    idsVistos.add(processo.id);
    return true;
  });

  todosProcessos.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const ids = todosProcessos.map((processo: any) => processo.id);
  if (ids.length === 0) return [];

  const { data: lancamentos } = await supabase
    .from('lancamentos')
    .select('*')
    .eq('tipo', 'receber')
    .in('processo_id', ids);

  const lancMap = new Map<string, any>();
  (lancamentos || []).forEach((lancamento: any) => {
    if (!lancMap.has(lancamento.processo_id)) lancMap.set(lancamento.processo_id, lancamento);
  });

  return todosProcessos.map((processo: any) => ({
    ...processo,
    lancamento: lancMap.get(processo.id) || null,
    etapa_financeiro: lancMap.get(processo.id)?.etapa_financeiro || 'solicitacao_criada',
  }));
}
