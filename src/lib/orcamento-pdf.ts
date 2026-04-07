import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  type OrcamentoItem, type OrcamentoPacote, type OrcamentoSecao,
  type OrcamentoModo, getItemValor, DEFAULT_SECOES,
} from '@/components/orcamentos/types';

export interface OrcamentoPDFData {
  modo: OrcamentoModo;
  modoContador?: boolean;
  prospect_nome: string;
  prospect_cnpj: string | null;
  itens: OrcamentoItem[];
  pacotes: OrcamentoPacote[];
  secoes: OrcamentoSecao[];
  contexto: string;
  ordem_execucao: string;
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
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

const HEADER = (numero: number, data: string) => `
  <div style="background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%); padding: 32px 40px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <div style="font-size: 22px; font-weight: 800; color: white; letter-spacing: -0.5px;">
          <span style="color: #4ade80;">Trevo</span> <span style="color: rgba(255,255,255,0.7);">Legaliza</span>
        </div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 4px;">CNPJ 39.969.412/0001-70</div>
        <div style="font-size: 8px; color: rgba(255,255,255,0.3); margin-top: 2px;">Assessoria societária com atuação em todo o território nacional</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Proposta #${String(numero).padStart(3, '0')}</div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 4px;">${data}</div>
      </div>
    </div>
  </div>
  <div style="height: 4px; background: linear-gradient(90deg, #22c55e, #86efac, #22c55e);"></div>
`;

const FOOTER = `
  <div style="padding: 16px 40px; border-top: 1px solid #e2e8f0; background: #f8fafc; text-align: center;">
    <div style="font-size: 10px; color: #94a3b8;">
      Trevo Legaliza · CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP · administrativo@trevolegaliza.com.br · (11) 93492-7001 · trevolegaliza.com.br
    </div>
  </div>
`;

function buildSimplesHTML(d: OrcamentoPDFData): string {
  const itensHtml = d.itens.map((item, idx) => `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 14px 0; ${idx > 0 ? 'border-top: 1px solid #e2e8f0;' : ''}">
      <div style="flex: 1; padding-right: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: #1a1a2e;">${idx + 1}. ${esc(item.descricao)}${item.quantidade > 1 ? ` (×${item.quantidade})` : ''}</div>
        ${item.detalhes ? `<div style="font-size: 11px; color: #64748b; margin-top: 4px; line-height: 1.4;">${esc(item.detalhes)}</div>` : ''}
      </div>
      <div style="font-size: 14px; font-weight: 800; color: #166534; white-space: nowrap;">${fmt(getItemValor(item) * item.quantidade)}</div>
    </div>
  `).join('');

  const descontoHtml = d.desconto_pct > 0
    ? `<div style="display: flex; justify-content: space-between; padding: 10px 0; border-top: 1px solid #e2e8f0; font-size: 12px;">
        <span style="color: #64748b;">Desconto (${d.desconto_pct}%)</span>
        <span style="color: #dc2626; font-weight: 600;">- ${fmt(d.subtotal * d.desconto_pct / 100)}</span>
       </div>` : '';

  const observacoesHtml = d.observacoes
    ? `<div style="margin-top: 20px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${esc(d.observacoes)}</div>
       </div>` : '';

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${HEADER(d.numero, d.data_emissao)}
      <div style="padding: 24px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Preparada para</div>
        <div style="font-size: 18px; font-weight: 800; color: #1a1a2e;">${esc(d.prospect_nome)}</div>
        ${d.prospect_cnpj ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Válida por ${d.validade_dias} dias</div>
      </div>
      <div style="padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
        ${itensHtml}
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="border-top: 2px solid #e2e8f0; padding-top: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; padding: 6px 0;">
            <span>Subtotal</span><span style="font-weight: 600;">${fmt(d.subtotal)}</span>
          </div>
          ${descontoHtml}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 8px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Total</span>
            <span style="font-size: 28px; font-weight: 900; color: #166534;">${fmt(d.total)}</span>
          </div>
        </div>
      </div>
      <div style="padding: 0 40px 24px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.pagamento || 'A combinar')}</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao || 'A combinar')}</div>
          </div>
        </div>
        ${observacoesHtml}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
    </div>
  `;
}

function buildDetalhadoPages(d: OrcamentoPDFData): string[] {
  const pages: string[] = [];
  const secoes = d.secoes.length > 0 ? d.secoes : DEFAULT_SECOES;

  // --- PAGE 1: Cover ---
  pages.push(`
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; height: 1123px; background: white; position: relative; display: flex; flex-direction: column;">
      ${HEADER(d.numero, d.data_emissao)}
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 60px;">
        <div style="font-size: 10px; color: #4ade80; text-transform: uppercase; letter-spacing: 4px; font-weight: 700; margin-bottom: 20px;">Proposta Comercial</div>
        <div style="font-size: 32px; font-weight: 900; color: #1a1a2e; text-align: center; margin-bottom: 16px;">${esc(d.prospect_nome)}</div>
        ${d.prospect_cnpj ? `<div style="font-size: 14px; color: #64748b;">CNPJ: ${esc(d.prospect_cnpj)}</div>` : ''}
        <div style="margin-top: 40px; padding: 20px 40px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 16px; text-align: center;">
          <div style="font-size: 10px; color: #166534; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px;">Investimento Estimado</div>
          <div style="font-size: 36px; font-weight: 900; color: #166534;">${fmt(d.total)}</div>
        </div>
        <div style="margin-top: 24px; font-size: 12px; color: #94a3b8;">
          Emissão: ${d.data_emissao} · Válida por ${d.validade_dias} dias
        </div>
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
    </div>
  `);

  // --- PAGE 2: Context (if filled) ---
  if (d.contexto || d.ordem_execucao) {
    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${HEADER(d.numero, d.data_emissao)}
        <div style="padding: 30px 40px;">
          ${d.contexto ? `
            <div style="margin-bottom: 30px;">
              <div style="font-size: 10px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid #f0fdf4; padding-bottom: 8px;">Cenário e Oportunidade</div>
              <div style="font-size: 12px; color: #334155; line-height: 1.7;">${esc(d.contexto)}</div>
            </div>
          ` : ''}
          ${d.ordem_execucao ? `
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #4ade80; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 2px solid #f0fdf4; padding-bottom: 8px;">Ordem Sugerida de Execução</div>
              <div style="font-size: 12px; color: #334155; line-height: 1.7; background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #e2e8f0;">${esc(d.ordem_execucao)}</div>
            </div>
          ` : ''}
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
      </div>
    `);
  }

  // --- ITEMS PAGES (grouped by section) ---
  const grouped = secoes
    .map(s => ({ ...s, items: d.itens.filter(i => i.secao === s.key).sort((a, b) => a.ordem - b.ordem) }))
    .filter(g => g.items.length > 0);

  let itemsHtml = '';
  for (const group of grouped) {
    if (group.key !== 'geral') {
      itemsHtml += `<div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 2px; margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #f0fdf4;">${esc(group.label)} (${group.items.length})</div>`;
    }
    for (const item of group.items) {
      const valorExibido = d.modoContador && item.honorario_contador > 0
        ? item.honorario_contador
        : (getItemValor(item) || 0);
      const valorTotal = valorExibido * item.quantidade;
      const totalMin = valorTotal + item.taxa_min;
      const totalMax = valorTotal + item.taxa_max;
      const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
      const secaoLabel = secoes.find(s => s.key === item.secao)?.label || '';
      const honorarioLabel = d.modoContador ? 'Investimento' : 'Honorário Trevo';

      itemsHtml += `
        <div style="border: 1px solid #e5e7eb; border-radius: 16px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid;">
          <div style="display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%);">
            <div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.15); color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0;">${item.ordem || idx + 1}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 12px; font-weight: 700; color: #ffffff; line-height: 1.3;">${esc(item.descricao)}</div>
              ${secaoLabel && secaoLabel !== 'Geral' ? `<div style="display: inline-block; margin-top: 4px; padding: 2px 8px; border-radius: 999px; background: rgba(34,197,94,0.2); color: #86efac; font-size: 7px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">${esc(secaoLabel)}</div>` : ''}
            </div>
            <div style="font-size: 16px; font-weight: 800; color: #ffffff; white-space: nowrap;">${fmt(valorTotal)}</div>
          </div>
          ${item.detalhes ? `<div style="padding: 12px 18px; font-size: 9.5px; line-height: 1.6; color: #6b7280; border-bottom: 1px solid #f3f4f6;">${esc(item.detalhes)}</div>` : ''}
          ${(item.prazo || item.docs_necessarios) ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #f3f4f6; border-bottom: 1px solid #f3f4f6;">
              <div style="padding: 10px 18px; background: #ffffff;">
                <div style="font-size: 7px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Prazo</div>
                <div style="font-size: 9px; color: #374151; font-weight: 500;">${esc(item.prazo || 'A definir')}</div>
              </div>
              <div style="padding: 10px 18px; background: #ffffff;">
                <div style="font-size: 7px; font-weight: 800; color: #9ca3af; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px;">Documentos necessários</div>
                <div style="font-size: 9px; color: #374151; font-weight: 500;">${esc(item.docs_necessarios || '—')}</div>
              </div>
            </div>
          ` : ''}
          <div style="padding: 12px 18px; background: #fafafa;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 9px;">
              <span style="color: #6b7280;">${honorarioLabel}</span>
              <span style="font-weight: 700; color: #1a1a2e;">${fmt(valorTotal)}</span>
            </div>
            ${hasTaxa ? `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 9px;">
                <span style="color: #6b7280;">Taxas externas (estimativa)</span>
                <span style="font-weight: 500; color: #92400e;">${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 9px;">
                <span style="font-weight: 700; color: #1a1a2e;">Total estimado</span>
                <span style="font-size: 11px; font-weight: 700; color: #166534;">${fmt(totalMin)} a ${fmt(totalMax)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  }

  pages.push(`
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${HEADER(d.numero, d.data_emissao)}
      <div style="padding: 24px 40px;">
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Escopo dos Serviços</div>
        ${itemsHtml}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
    </div>
  `);

  // --- PACKAGES PAGE ---
  const validPacotes = d.pacotes.filter(p => p.nome && p.itens_ids.length > 0);
  if (validPacotes.length > 0) {
    let pacotesRows = '';
    for (const pac of validPacotes) {
      const selected = d.itens.filter(i => pac.itens_ids.includes(i.id));
      const honorario = selected.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0);
      const honorarioDesc = honorario * (1 - pac.desconto_pct / 100);
      const taxaMin = selected.reduce((s, i) => s + i.taxa_min, 0);
      const taxaMax = selected.reduce((s, i) => s + i.taxa_max, 0);

      pacotesRows += `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: 700; color: #166534;">${esc(pac.nome)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #64748b;">${esc(pac.descricao || `${selected.length} itens`)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">
            <div style="text-decoration: line-through; font-size: 10px; color: #94a3b8;">${fmt(honorario)}</div>
            <div style="font-weight: 700; color: #166534;">${fmt(honorarioDesc)} <span style="font-size: 10px; color: #4ade80;">(-${pac.desconto_pct}%)</span></div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 11px; color: #b45309;">${fmt(taxaMin)} a ${fmt(taxaMax)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 800; color: #1a1a2e;">${fmt(honorarioDesc + taxaMin)} a ${fmt(honorarioDesc + taxaMax)}</td>
        </tr>
      `;
    }

    pages.push(`
      <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
        ${HEADER(d.numero, d.data_emissao)}
        <div style="padding: 24px 40px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Pacotes Disponíveis</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f0fdf4;">
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Pacote</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 9px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Inclui</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Honorário</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Taxas Est.</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 9px; color: #166534; text-transform: uppercase; letter-spacing: 1px;">Investimento</th>
              </tr>
            </thead>
            <tbody>${pacotesRows}</tbody>
          </table>
        </div>
        <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
      </div>
    `);
  }

  // --- TOTALS + CONDITIONS PAGE ---
  const totalHonorarios = d.itens.reduce((s, i) => {
    const v = d.modoContador && i.honorario_contador > 0 ? i.honorario_contador : getItemValor(i);
    return s + v * i.quantidade;
  }, 0);
  const totalTaxaMin = d.itens.reduce((s, i) => s + i.taxa_min, 0);
  const totalTaxaMax = d.itens.reduce((s, i) => s + i.taxa_max, 0);
  const descontoValor = totalHonorarios * (d.desconto_pct / 100);
  const honorarioFinal = totalHonorarios - descontoValor;
  const hasTaxas = totalTaxaMin > 0 || totalTaxaMax > 0;

  pages.push(`
    <div style="font-family: Arial, Helvetica, sans-serif; width: 794px; min-height: 1123px; background: white; position: relative;">
      ${HEADER(d.numero, d.data_emissao)}
      <div style="padding: 30px 40px;">
        <!-- Totals -->
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Resumo do Investimento</div>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
          <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0;">
            <span style="color: #64748b;">${d.modoContador ? 'Investimento' : 'Honorários Trevo'}</span>
            <span style="font-weight: 600;">${fmt(totalHonorarios)}</span>
          </div>
          ${d.desconto_pct > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; color: #dc2626;">
              <span>Desconto (${d.desconto_pct}%)</span>
              <span style="font-weight: 600;">- ${fmt(descontoValor)}</span>
            </div>
          ` : ''}
          ${hasTaxas ? `
            <div style="display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-top: 1px solid #e2e8f0;">
              <span style="color: #64748b;">Taxas externas estimadas</span>
              <span style="color: #b45309; font-weight: 600;">${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; margin-top: 10px; background: #f0fdf4; border: 2px solid #22c55e; border-radius: 12px;">
            <span style="font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 1px;">${hasTaxas ? 'Investimento Total' : 'Total'}</span>
            <span style="font-size: 28px; font-weight: 900; color: #166534;">
              ${hasTaxas ? `${fmt(honorarioFinal + totalTaxaMin)} a ${fmt(honorarioFinal + totalTaxaMax)}` : fmt(d.total)}
            </span>
          </div>
        </div>

        <!-- Conditions -->
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Condições</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Validade</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${d.validade_dias} dias</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Prazo de Execução</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.prazo_execucao || 'A combinar')}</div>
          </div>
        </div>
        ${d.pagamento ? `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <div style="font-size: 9px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px;">Condições de Pagamento</div>
            <div style="font-size: 12px; font-weight: 600; color: #1e293b; margin-top: 4px;">${esc(d.pagamento)}</div>
          </div>
        ` : ''}
        ${d.observacoes ? `
          <div style="margin-top: 16px;">
            <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Observações</div>
            <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px; font-size: 11px; color: #92400e; line-height: 1.5;">${esc(d.observacoes)}</div>
          </div>
        ` : ''}
      </div>
      <div style="position: absolute; bottom: 0; left: 0; right: 0;">${FOOTER}</div>
    </div>
  `);

  return pages;
}

async function renderPageToCanvas(html: string): Promise<HTMLCanvasElement> {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    const el = container.firstElementChild as HTMLElement;
    return await html2canvas(el, { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
  } finally {
    document.body.removeChild(container);
  }
}

export async function gerarOrcamentoPDF(data: OrcamentoPDFData): Promise<jsPDF> {
  const isDetalhado = data.modo === 'detalhado' ||
    data.itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios) ||
    !!data.contexto;

  if (!isDetalhado) {
    // Simple mode: single page
    const html = buildSimplesHTML(data);
    const canvas = await renderPageToCanvas(html);
    const doc = new jsPDF('p', 'mm', 'a4');
    const doc = new jsPDF('p', 'mm', 'a4');
    addCanvasToDoc(doc, canvas);
    return doc;
  }

  // Detailed mode: multiple pages
  const pagesHtml = buildDetalhadoPages(data);
  const doc = new jsPDF('p', 'mm', 'a4');

  for (let i = 0; i < pagesHtml.length; i++) {
    if (i > 0) doc.addPage();
    const canvas = await renderPageToCanvas(pagesHtml[i]);
    addCanvasToDoc(doc, canvas);
  }

  return doc;
}

function addCanvasToDoc(doc: jsPDF, canvas: HTMLCanvasElement) {
  const pdfW = doc.internal.pageSize.getWidth();
  const pdfH = doc.internal.pageSize.getHeight();
  const imgData = canvas.toDataURL('image/jpeg', 0.82);
  let imgW = pdfW;
  let imgH = (canvas.height / canvas.width) * pdfW;
  if (imgH > pdfH) {
    const scale = pdfH / imgH;
    imgW = pdfW * scale;
    imgH = pdfH;
  }
  const offsetX = (pdfW - imgW) / 2;
  doc.addImage(imgData, 'JPEG', offsetX, 0, imgW, imgH);
}
