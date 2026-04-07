import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface OrcamentoItem {
  descricao: string;
  detalhes: string;
  valor: number;
  quantidade: number;
}

export interface OrcamentoPDFData {
  prospect_nome: string;
  prospect_cnpj: string | null;
  itens: OrcamentoItem[];
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

function buildHTML(d: OrcamentoPDFData): string {
  const itensHtml = d.itens
    .filter(i => i.descricao)
    .map((item, idx) => `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 0; ${idx > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
        <div style="flex: 1; padding-right: 20px;">
          <div style="font-size: 13px; font-weight: 700; color: #1a1a2e;">${idx + 1}. ${item.descricao}${item.quantidade > 1 ? ` (×${item.quantidade})` : ''}</div>
          ${item.detalhes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${item.detalhes}</div>` : ''}
        </div>
        <div style="font-size: 14px; font-weight: 800; color: #166534; white-space: nowrap;">${fmt(item.valor * item.quantidade)}</div>
      </div>
    `)
    .join('');

  const descontoHtml = d.desconto_pct > 0
    ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e2e8f0; font-size: 12px;">
        <span style="color: #64748b;">Desconto (${d.desconto_pct}%)</span>
        <span style="color: #dc2626; font-weight: 600;">- ${fmt(d.subtotal * d.desconto_pct / 100)}</span>
       </div>`
    : '';

  const observacoesHtml = d.observacoes
    ? `<div style="margin-top: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${d.observacoes.replace(/\n/g, '<br/>')}</div>
       </div>`
    : '';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); padding: 32px 40px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <div style="font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">
              <span style="color: #4ade80;">Trevo</span> <span style="color: rgba(255,255,255,0.7);">Legaliza</span>
            </div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px;">CNPJ 39.969.412/0001-70</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Proposta #${String(d.numero).padStart(3, '0')}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;">${d.data_emissao}</div>
          </div>
        </div>
      </div>
      <div style="height: 4px; background: linear-gradient(90deg, #22c55e, #86efac, #22c55e);"></div>

      <!-- Client Info -->
      <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preparada para</div>
        <div style="font-size: 18px; font-weight: 800; color: #1a1a2e;">${d.prospect_nome}</div>
        ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">CNPJ: ${d.prospect_cnpj}</div>` : ''}
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Válida por ${d.validade_dias} dias</div>
      </div>

      <!-- Items -->
      <div style="padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
        ${itensHtml}
      </div>

      <!-- Totals -->
      <div style="padding: 0 40px 24px;">
        <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding: 6px 0;">
            <span>Subtotal</span>
            <span style="font-weight: 600;">${fmt(d.subtotal)}</span>
          </div>
          ${descontoHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 8px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Total</span>
            <span style="font-size: 28px; font-weight: 900; color: #166534;">${fmt(d.total)}</span>
          </div>
        </div>
      </div>

      <!-- Conditions -->
      <div style="padding: 0 40px 24px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${d.pagamento || 'A combinar'}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${d.prazo_execucao || 'A combinar'}</div>
          </div>
        </div>
        ${observacoesHtml}
      </div>

      <!-- Footer -->
      <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
        <div style="font-size: 10px; color: #94a3b8;">
          Trevo Legaliza · CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP · administrativo@trevolegaliza.com.br · (11) 93492-7001 · trevolegaliza.com.br
        </div>
      </div>
    </div>
  `;
}

export async function gerarOrcamentoPDF(data: OrcamentoPDFData): Promise<jsPDF> {
  const html = buildHTML(data);

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const pageEl = container.firstElementChild as HTMLElement;
    const canvas = await html2canvas(pageEl, { scale: 2, useCORS: true });
    const doc = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(imgHeight, 297));
    return doc;
  } finally {
    document.body.removeChild(container);
  }
}
