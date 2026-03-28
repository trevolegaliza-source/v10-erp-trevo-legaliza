import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface OrcamentoPDFData {
  prospect_nome: string;
  prospect_cnpj: string | null;
  tipo_contrato: string;
  servicos: string[];
  naturezas: string[];
  escopo: string[];
  valor_base: number;
  valor_final: number;
  desconto_pct: number;
  qtd_processos: number;
  desconto_progressivo_ativo: boolean;
  desconto_progressivo_pct: number;
  desconto_progressivo_limite: number;
  validade_dias: number;
  pagamento: string | null;
  sla: string | null;
  observacoes: string | null;
  numero: number;
  data_emissao: string;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function renderCSS(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    .page { width: 794px; min-height: 1123px; background: white; position: relative; overflow: hidden; }
    .header { background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); padding: 40px; color: white; }
    .header-tag { font-size: 10px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 12px; }
    .header-title { font-size: 28px; font-weight: 800; line-height: 1.2; }
    .header-sub { font-size: 13px; color: rgba(255,255,255,0.6); margin-top: 8px; }
    .accent-bar { height: 4px; background: linear-gradient(90deg, #22c55e, #86efac, #22c55e); }
    .section { padding: 28px 40px; }
    .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 600; margin: 3px; }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-gray { background: #f1f5f9; color: #475569; }
    .check-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 12px; color: #334155; }
    .check-icon { width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; flex-shrink: 0; }
    .check-yes { background: #dcfce7; color: #16a34a; }
    .check-no { background: #f1f5f9; color: #94a3b8; }
    .valor-box { background: #f0fdf4; border: 2px solid #22c55e; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 20px; }
    .valor-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    .valor-amount { font-size: 36px; font-weight: 800; color: #166534; margin-top: 4px; }
    .valor-sub { font-size: 12px; color: #64748b; margin-top: 4px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
    .info-label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
    .info-value { font-size: 13px; font-weight: 600; color: #1e293b; margin-top: 4px; }
    .footer { padding: 16px 40px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; position: absolute; bottom: 0; left: 0; right: 0; }
    .prog-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 12px; }
    .prog-table th { text-align: left; padding: 6px 10px; background: #f1f5f9; color: #64748b; font-size: 10px; text-transform: uppercase; }
    .prog-table td { padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    .obs-box { background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 14px; font-size: 12px; color: #92400e; margin-top: 16px; }
  `;
}

function renderPage1(d: OrcamentoPDFData): string {
  return `
    <div class="page">
      <div class="header">
        <div class="header-tag">Proposta Comercial #${String(d.numero).padStart(3, '0')}</div>
        <div class="header-title">${d.prospect_nome}</div>
        <div class="header-sub">${d.prospect_cnpj || ''} · ${d.tipo_contrato === 'mensal' ? 'Contrato Mensal' : 'Serviço Avulso'}</div>
        <div style="margin-top: 24px; font-size: 16px; color: rgba(255,255,255,0.8); font-style: italic;">
          "Regularize sua empresa com quem entende de legalização."
        </div>
      </div>
      <div class="accent-bar"></div>
      <div class="section">
        <div class="section-title">Por que a Trevo Legaliza?</div>
        <div class="info-grid">
          <div class="info-card"><div class="info-label">Experiência</div><div class="info-value">12+ anos no mercado</div></div>
          <div class="info-card"><div class="info-label">Abrangência</div><div class="info-value">26 estados + DF</div></div>
          <div class="info-card"><div class="info-label">Processos</div><div class="info-value">200+ processos/mês</div></div>
          <div class="info-card"><div class="info-label">Tecnologia</div><div class="info-value">Plataforma proprietária</div></div>
        </div>
      </div>
      <div class="footer">Trevo Legaliza 🍀 · administrativo@trevolegaliza.com.br · (11) 93492-7001 · Emitido em ${d.data_emissao}</div>
    </div>
  `;
}

function renderPage2(d: OrcamentoPDFData): string {
  const allEscopo = [
    'Plataforma Trevo', 'Minuta Padrão Junta', 'Minuta Redação Própria',
    'Registro', 'Acompanhamento Deferimento', 'MAT',
    'Inscrição Municipal/Estadual', 'Alvarás e Licenças', 'Conselho de Classe',
  ];
  const escopoItems = allEscopo.map(e => {
    const included = d.escopo.includes(e);
    return `<div class="check-item"><div class="check-icon ${included ? 'check-yes' : 'check-no'}">${included ? '✓' : '—'}</div><span>${e}</span></div>`;
  }).join('');

  return `
    <div class="page">
      <div style="background: #0f1f0f; padding: 20px 40px; color: white;">
        <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 2px;">Escopo dos Serviços</div>
      </div>
      <div class="accent-bar"></div>
      <div class="section">
        <div class="section-title">Serviços Societários</div>
        <div>${d.servicos.map(s => `<span class="badge badge-green">${s}</span>`).join('')}</div>
      </div>
      <div class="section" style="padding-top: 0;">
        <div class="section-title">Natureza Jurídica</div>
        <div>${d.naturezas.map(n => `<span class="badge badge-blue">${n}</span>`).join('')}</div>
      </div>
      <div class="section" style="padding-top: 0;">
        <div class="section-title">Escopo Técnico</div>
        ${escopoItems}
      </div>
      <div class="footer">Proposta #${String(d.numero).padStart(3, '0')} · ${d.prospect_nome} · Página 2/3</div>
    </div>
  `;
}

function renderPage3(d: OrcamentoPDFData): string {
  let progressivoHtml = '';
  if (d.desconto_progressivo_ativo) {
    let rows = '';
    let val = d.valor_base;
    for (let i = 1; i <= 5; i++) {
      if (i > 1) val = Math.max(val * (1 - d.desconto_progressivo_pct / 100), d.desconto_progressivo_limite);
      rows += `<tr><td>${i}º processo</td><td>${fmt(val)}</td><td>${i > 1 ? `-${d.desconto_progressivo_pct}%` : '—'}</td></tr>`;
    }
    progressivoHtml = `
      <div style="margin-top: 16px;">
        <div class="section-title">Desconto Progressivo</div>
        <table class="prog-table"><thead><tr><th>Processo</th><th>Valor</th><th>Desconto</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="font-size: 10px; color: #64748b; margin-top: 6px;">Valor mínimo: ${fmt(d.desconto_progressivo_limite)}</div>
      </div>
    `;
  }

  const obsHtml = d.observacoes ? `<div class="obs-box"><strong>Observações:</strong><br/>${d.observacoes.replace(/\n/g, '<br/>')}</div>` : '';

  return `
    <div class="page">
      <div style="background: #0f1f0f; padding: 20px 40px; color: white;">
        <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 2px;">Investimento</div>
      </div>
      <div class="accent-bar"></div>
      <div class="section">
        <div class="valor-box">
          <div class="valor-label">${d.tipo_contrato === 'mensal' ? 'Investimento Mensal' : 'Investimento por Processo'}</div>
          <div class="valor-amount">${fmt(d.valor_final)}</div>
          ${d.desconto_pct > 0 ? `<div class="valor-sub">De ${fmt(d.valor_base)} por ${fmt(d.valor_final)} (${d.desconto_pct}% off)</div>` : ''}
          ${d.tipo_contrato === 'mensal' ? `<div class="valor-sub">${d.qtd_processos} processo(s) inclusos</div>` : ''}
        </div>
        <div class="info-grid">
          <div class="info-card"><div class="info-label">Validade</div><div class="info-value">${d.validade_dias} dias</div></div>
          <div class="info-card"><div class="info-label">Pagamento</div><div class="info-value">${d.pagamento || 'A combinar'}</div></div>
        </div>
        ${d.sla ? `<div class="info-card" style="margin-top: 12px;"><div class="info-label">SLA</div><div class="info-value" style="font-weight: 400; font-size: 12px;">${d.sla}</div></div>` : ''}
        ${progressivoHtml}
        ${obsHtml}
      </div>
      <div class="footer">Proposta #${String(d.numero).padStart(3, '0')} · ${d.prospect_nome} · Página 3/3</div>
    </div>
  `;
}

async function renderPageToPDF(html: string, css: string): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.innerHTML = `<style>${css}</style>${html}`;
  document.body.appendChild(container);
  try {
    return await html2canvas(container.querySelector('.page') as HTMLElement, { scale: 2, useCORS: true });
  } finally {
    document.body.removeChild(container);
  }
}

export async function gerarOrcamentoPDF(data: OrcamentoPDFData): Promise<jsPDF> {
  const css = renderCSS();
  const pages = [renderPage1(data), renderPage2(data), renderPage3(data)];
  const doc = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) doc.addPage();
    const canvas = await renderPageToPDF(pages[i], css);
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 297));
  }

  return doc;
}
