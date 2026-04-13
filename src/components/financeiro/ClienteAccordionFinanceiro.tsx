import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Send, Copy, Download, CheckCircle, AlertTriangle, Clock, Calendar, RefreshCw, Loader2, MoreHorizontal, Receipt, MessageCircle, Share2, Tags } from 'lucide-react';
import { EtiquetasEdit } from '@/components/EtiquetasBadges';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import DeferimentoModal from './DeferimentoModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ClienteFinanceiro, LancamentoFinanceiro, MensalistaSemFatura } from '@/hooks/useFinanceiroClientes';
import { isLancamentoVencidoReal, invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import { useExtratos } from '@/hooks/useExtratos';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { gerarMensagemCobranca } from '@/lib/mensagem-cobranca';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { downloadExtrato } from '@/lib/storage-utils';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}



function fmtDate(d: string | null | undefined) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('pt-BR');
}

function diasAtraso(vencimento: string): number {
  const diff = Date.now() - new Date(vencimento).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function diasParaVencer(vencimento: string): number {
  const diff = new Date(vencimento).getTime() - Date.now();
  return Math.floor(diff / 86400000);
}

function parseBadges(notas: string | null): string[] {
  if (!notas) return [];
  const badges: string[] = [];
  const lower = notas.toLowerCase();
  if (lower.includes('boas-vindas') || lower.includes('boas vindas')) badges.push('Boas-vindas');
  if (lower.includes('mudança de uf') || lower.includes('mudanca de uf')) badges.push('Mudança UF');
  if (lower.includes('urgência') || lower.includes('urgencia') || lower.includes('método trevo')) badges.push('Urgência');
  if (lower.includes('valor manual')) badges.push('Valor Manual');
  if (lower.includes('cortesia')) badges.push('Cortesia');
  return badges;
}

const BADGE_COLORS: Record<string, string> = {
  'Boas-vindas': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Mudança UF': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'Urgência': 'bg-red-500/15 text-red-500 border-red-500/30',
  'Valor Manual': 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  'Cortesia': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
};

function tipoLabel(c: ClienteFinanceiro): string {
  if (c.cliente_momento_faturamento === 'no_deferimento') return 'No deferimento';

  if (c.cliente_tipo === 'MENSALISTA') {
    return `Mensalista${c.cliente_dia_vencimento_mensal ? ` — dia ${c.cliente_dia_vencimento_mensal}` : ''}`;
  }

  if (c.cliente_tipo === 'PRE_PAGO') return 'Pré-Pago';

  // AVULSO_4D: verificar forma de cobrança
  if (c.cliente_dia_vencimento_mensal && c.cliente_dia_vencimento_mensal > 0 && !c.cliente_dia_cobranca) {
    return `Fatura mensal — dia ${c.cliente_dia_vencimento_mensal}`;
  }

  if (c.cliente_dia_cobranca && c.cliente_dia_cobranca > 0) {
    return `Avulso D+${c.cliente_dia_cobranca}`;
  }

  return 'Avulso';
}

// ══════════ HELPER: Client-level badge indicators ══════════
function ClienteHeaderBadges({ cliente }: { cliente: ClienteFinanceiro }) {
  const temMetodoTrevo = cliente.lancamentos.some(l => l.tem_etiqueta_metodo_trevo);
  const temPrioridade = cliente.lancamentos.some(l => l.tem_etiqueta_prioridade);
  const temAlertaTaxas = cliente.lancamentos.some(l =>
    (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0
  );
  const totalTaxas = cliente.lancamentos.reduce((s, l) => s + l.total_valores_adicionais, 0);

  return (
    <>
      {temMetodoTrevo && (
        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
          🍀 Método Trevo
        </Badge>
      )}
      {temPrioridade && (
        <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
          🔴 Prioridade
        </Badge>
      )}
      {temAlertaTaxas && (
        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
          ⚠️ Taxas pendentes
        </Badge>
      )}
      {totalTaxas > 0 && (
        <span className="text-[10px] text-muted-foreground">+ {fmt(totalTaxas)} taxas</span>
      )}
    </>
  );
}

// ══════════ TAB: FATURAR ══════════
export function ClientesFaturar({ clientes, mensalistasSemFatura = [] }: { clientes: ClienteFinanceiro[]; mensalistasSemFatura?: MensalistaSemFatura[] }) {
  const queryClient = useQueryClient();
  const [gerandoFatura, setGerandoFatura] = useState<string | null>(null);

  const handleGerarFaturaMensal = async (m: MensalistaSemFatura) => {
    setGerandoFatura(m.id);
    try {
      const now = new Date();
      const dia = m.dia_vencimento_mensal || 10;
      const vencimento = new Date(now.getFullYear(), now.getMonth(), dia);
      if (vencimento < now) {
        vencimento.setMonth(vencimento.getMonth() + 1);
      }
      const mesLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      const { error } = await supabase.from('lancamentos').insert({
        tipo: 'receber' as const,
        cliente_id: m.id,
        descricao: `Fatura mensal — ${mesLabel}`,
        valor: m.valor_base,
        data_vencimento: vencimento.toISOString().split('T')[0],
        status: 'pendente' as const,
        etapa_financeiro: 'solicitacao_criada',
      });
      if (error) throw error;
      toast.success(`Fatura mensal gerada para ${m.apelido || m.nome}!`);
      invalidateFinanceiro(queryClient);
    } catch (err: any) {
      toast.error('Erro ao gerar fatura: ' + (err?.message || 'Erro'));
    } finally {
      setGerandoFatura(null);
    }
  };

  const hasMensalistas = mensalistasSemFatura.length > 0;
  const hasClientes = clientes.length > 0;

  if (!hasMensalistas && !hasClientes) return <EmptyState text="Nenhum cliente aguardando geração de extrato." />;

  // Per-process split: for no_deferimento clients, baixa/avulso processes go to "prontos"
  const prontosMap = new Map<string, ClienteFinanceiro>();
  const aguardandoDefMap = new Map<string, ClienteFinanceiro>();

  for (const c of clientes) {
    if (c.cliente_momento_faturamento !== 'no_deferimento') {
      prontosMap.set(c.cliente_id, c);
      continue;
    }

    const lancProntos = c.lancamentos.filter(l => ['baixa', 'avulso'].includes(l.processo_tipo));
    const lancAguardando = c.lancamentos.filter(l => !['baixa', 'avulso'].includes(l.processo_tipo));

    if (lancProntos.length > 0) {
      prontosMap.set(c.cliente_id, {
        ...c,
        lancamentos: lancProntos,
        qtd_processos: lancProntos.length,
        total_faturado: lancProntos.reduce((s, l) => s + l.valor, 0),
        total_pendente: lancProntos.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
        qtd_sem_extrato: lancProntos.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
      });
    }

    if (lancAguardando.length > 0) {
      aguardandoDefMap.set(c.cliente_id, {
        ...c,
        lancamentos: lancAguardando,
        qtd_processos: lancAguardando.length,
        total_faturado: lancAguardando.reduce((s, l) => s + l.valor, 0),
        total_pendente: lancAguardando.filter(l => l.status !== 'pago').reduce((s, l) => s + l.valor, 0),
        qtd_sem_extrato: lancAguardando.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada').length,
      });
    }
  }

  const prontos = Array.from(prontosMap.values());
  const aguardandoDef = Array.from(aguardandoDefMap.values());

  return (
    <div className="space-y-6">
      {/* Mensalistas sem fatura */}
      {hasMensalistas && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">📋 Mensalistas sem fatura neste mês</h3>
          <div className="space-y-2">
            {mensalistasSemFatura.map(m => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5">
                <div>
                  <p className="text-sm font-medium">{m.apelido || m.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmt(m.valor_base)}/mês · Vencimento dia {m.dia_vencimento_mensal}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={gerandoFatura === m.id}
                  onClick={() => handleGerarFaturaMensal(m)}
                  className="text-xs"
                >
                  {gerandoFatura === m.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Receipt className="h-3 w-3 mr-1" />}
                  Gerar Fatura
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {prontos.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">✅ Prontos para cobrar</h3>
          <Accordion type="multiple" className="space-y-2">
            {prontos.map(c => <FaturarItem key={c.cliente_id} cliente={c} isDeferimento={false} />)}
          </Accordion>
        </div>
      )}
      {aguardandoDef.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">⏳ Aguardando deferimento — não cobrar ainda</h3>
          <Accordion type="multiple" className="space-y-2">
            {aguardandoDef.map(c => <FaturarItem key={c.cliente_id + '_def'} cliente={c} isDeferimento={true} />)}
          </Accordion>
        </div>
      )}
    </div>
  );
}

function FaturarItem({ cliente, isDeferimento = false }: { cliente: ClienteFinanceiro; isDeferimento?: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [taxaModalOpen, setTaxaModalOpen] = useState(false);
  const [taxaProcessoId, setTaxaProcessoId] = useState<string>('');
  const [taxaClienteApelido, setTaxaClienteApelido] = useState<string>('');
  const [deferimentoOpen, setDeferimentoOpen] = useState(false);
  const [deferimentoProcessos, setDeferimentoProcessos] = useState<Array<{
    processo_id: string;
    razao_social: string;
    tipo: string;
    data_deferimento_atual: string | null;
  }>>([]);
  const [extratoGerado, setExtratoGerado] = useState<{ blob: Blob; filename: string; clienteId: string; total: number } | null>(null);
  const { salvarExtrato } = useExtratos();
  const qc = useQueryClient();

  const lancSemExtrato = cliente.lancamentos.filter(l => l.status !== 'pago' && l.etapa_financeiro !== 'honorario_pago');
  const totalSelecionado = lancSemExtrato.filter(l => selected.has(l.id)).reduce((s, l) => s + l.valor, 0);

  function toggleAll() {
    if (selected.size === lancSemExtrato.length) setSelected(new Set());
    else setSelected(new Set(lancSemExtrato.map(l => l.id)));
  }

  async function handleGerarExtrato() {
    const selecionados = lancSemExtrato.filter(l => selected.has(l.id));
    if (selecionados.length === 0) { toast.warning('Selecione ao menos um processo.'); return; }

    const { data: clienteCheck } = await supabase
      .from('clientes')
      .select('momento_faturamento, nome')
      .eq('id', cliente.cliente_id)
      .single();

    if (clienteCheck?.momento_faturamento === 'no_deferimento') {
      const processoIds = selecionados.map(l => l.processo_id).filter(Boolean);
      const { data: processosData } = await supabase
        .from('processos')
        .select('id, razao_social, tipo, data_deferimento')
        .in('id', processoIds);

      setDeferimentoProcessos((processosData || []).map((p: any) => ({
        processo_id: p.id,
        razao_social: p.razao_social,
        tipo: p.tipo,
        data_deferimento_atual: p.data_deferimento || null,
      })));
      setDeferimentoOpen(true);
      return;
    }

    await executarGeracaoExtrato(selecionados);
  }

  async function handleDeferimentoConfirm(processoIdsDeferidos: string[]) {
    setDeferimentoOpen(false);
    const selecionadosDeferidos = lancSemExtrato.filter(
      l => selected.has(l.id) && processoIdsDeferidos.includes(l.processo_id!)
    );
    if (selecionadosDeferidos.length === 0) {
      toast.warning('Nenhum processo deferido selecionado.');
      return;
    }
    await executarGeracaoExtrato(selecionadosDeferidos);
  }

  async function executarGeracaoExtrato(selecionados: typeof lancSemExtrato) {
    setGenerating(true);
    try {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', cliente.cliente_id)
        .single();

      const processoIds = selecionados.map(l => l.processo_id).filter(Boolean);
      const { data: processosData } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .in('id', processoIds);

      const { data: lancamentosData } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*)')
        .eq('tipo', 'receber')
        .in('processo_id', processoIds);

      const lancMap = new Map<string, any>();
      (lancamentosData || []).forEach((l: any) => { if (!lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l); });

      const processosFinanceiro: ProcessoFinanceiro[] = (processosData || []).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(cliente.cliente_id),
      ]);

      const allCompetenciaFinanceiro: ProcessoFinanceiro[] = (allCompetencia as any[]).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const result = await gerarExtratoPDF({
        processos: processosFinanceiro,
        allCompetencia: allCompetenciaFinanceiro,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      const clienteName = clienteData?.apelido || clienteData?.nome || 'extrato';
      const filename = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Download (backup)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save
      const now = new Date();
      await salvarExtrato.mutateAsync({
        clienteId: cliente.cliente_id,
        pdfBlob: blob,
        filename,
        totalHonorarios: result.totalHonorarios,
        totalTaxas: result.totalTaxas,
        totalGeral: result.totalGeral,
        processoIds,
        competenciaMes: now.getMonth() + 1,
        competenciaAno: now.getFullYear(),
      });

      setSelected(new Set());
      invalidateFinanceiro(qc);

      // Show post-extrato action modal
      setExtratoGerado({ blob, filename, clienteId: cliente.cliente_id, total: result.totalGeral });
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleWhatsAppPosExtrato() {
    if (!extratoGerado) return;
    const lancamentosComProcesso = cliente.lancamentos.filter(l => l.processo_id);
    const processoIds = [...new Set(lancamentosComProcesso.map(l => l.processo_id).filter(Boolean))] as string[];
    const vaMap: Record<string, number> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds);
      if (vas) { for (const va of vas) { vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor; } }
    }
    const l = cliente.lancamentos[0];
    if (!l) return;
    const valorPrimeiro = l.valor + (l.processo_id ? (vaMap[l.processo_id] || 0) : 0);
    const adicionais = cliente.lancamentos.slice(1).map(item => ({
      tipo: item.processo_tipo, razao_social: item.processo_razao_social,
      valor: item.valor + (item.processo_id ? (vaMap[item.processo_id] || 0) : 0),
    }));
    const msg = gerarMensagemCobranca({
      tipo: l.processo_tipo, razao_social: l.processo_razao_social, valor: valorPrimeiro,
      data_vencimento: l.data_vencimento, diasAtraso: 0,
      processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
    });
    const { data: clienteData } = await supabase.from('clientes').select('telefone').eq('id', extratoGerado.clienteId).single();
    const telefone = (clienteData as any)?.telefone?.replace(/\D/g, '') || '';
    const msgEncoded = encodeURIComponent(msg);
    if (telefone) {
      const tel = telefone.startsWith('55') ? telefone : '55' + telefone;
      window.open(`https://wa.me/${tel}?text=${msgEncoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${msgEncoded}`, '_blank');
      toast.info('Telefone não cadastrado. Escolha o contato no WhatsApp.');
    }
    setExtratoGerado(null);
  }

  async function handleCompartilharPosExtrato() {
    if (!extratoGerado) return;
    try {
      const file = new File([extratoGerado.blob], extratoGerado.filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'Extrato Trevo Legaliza', files: [file] });
      } else {
        const url = URL.createObjectURL(extratoGerado.blob);
        const a = document.createElement('a');
        a.href = url; a.download = extratoGerado.filename; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Erro ao compartilhar: ' + err.message);
    }
    setExtratoGerado(null);
  }

  const nenhumDeferido = isDeferimento && cliente.lancamentos.every(l => {
    // Check if processo has no deferimento date — we approximate by checking etapa
    return l.processo_etapa ? ['recebidos', 'analise_documental', 'contrato', 'viabilidade', 'dbe', 'vre', 'aguardando_pagamento', 'taxa_paga', 'assinaturas', 'assinado', 'em_analise'].includes(l.processo_etapa) : true;
  });

  return (
    <AccordionItem value={cliente.cliente_id} className={cn("border rounded-lg bg-card", isDeferimento && "border-dashed opacity-60")}>
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 text-left min-w-0">
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
            <p className="text-xs text-muted-foreground truncate">
              {cliente.qtd_processos} proc. · {fmt(cliente.total_faturado)} · {tipoLabel(cliente)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <ClienteHeaderBadges cliente={cliente} />
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] sm:text-xs whitespace-nowrap">
              {cliente.qtd_sem_extrato} sem extrato
            </Badge>
            {cliente.qtd_aguardando_deferimento > 0 && (
              <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/30 text-[10px] sm:text-xs whitespace-nowrap">
                ⏳ {cliente.qtd_aguardando_deferimento} ag. deferimento
              </Badge>
            )}
            <MoverParaMenu cliente={cliente} />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <Checkbox checked={selected.size === lancSemExtrato.length && lancSemExtrato.length > 0} onCheckedChange={toggleAll} />
            <span className="text-xs text-muted-foreground">Selecionar todos</span>
          </div>
          {lancSemExtrato.map(l => (
            <div key={l.id} className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                <LancamentoRow lancamento={l} checked={selected.has(l.id)} onToggle={() => {
                  const next = new Set(selected);
                  if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                  setSelected(next);
                }} />
              </div>
              {l.processo_id && (
                <button
                  onClick={() => {
                    setTaxaProcessoId(l.processo_id!);
                    setTaxaClienteApelido(cliente.cliente_apelido || cliente.cliente_nome);
                    setTaxaModalOpen(true);
                  }}
                  title="Adicionar taxa / valor adicional"
                  className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <Receipt className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mt-3">
              <span className="text-sm font-medium">{selected.size} selecionados · {fmt(totalSelecionado)}</span>
              <Button size="sm" onClick={handleGerarExtrato} disabled={generating || (isDeferimento && nenhumDeferido)} className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                <FileText className="h-4 w-4 mr-1" />
                {generating ? 'Gerando...' : `Gerar Extrato (${selected.size})`}
              </Button>
            </div>
          )}
        </div>
      </AccordionContent>
      {taxaProcessoId && (
        <ValoresAdicionaisModal
          open={taxaModalOpen}
          onOpenChange={setTaxaModalOpen}
          processoId={taxaProcessoId}
          clienteApelido={taxaClienteApelido}
        />
      )}
      <DeferimentoModal
        open={deferimentoOpen}
        onOpenChange={setDeferimentoOpen}
        clienteNome={cliente.cliente_apelido || cliente.cliente_nome}
        processos={deferimentoProcessos}
        onConfirm={handleDeferimentoConfirm}
      />
      {extratoGerado && (
        <Dialog open={!!extratoGerado} onOpenChange={(o) => { if (!o) setExtratoGerado(null); }}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Extrato Gerado!</DialogTitle>
            </DialogHeader>
            <div className="text-center space-y-4 py-4">
              <CheckCircle className="h-12 w-12 text-primary mx-auto" />
              <div>
                <p className="font-semibold">{cliente.cliente_apelido || cliente.cliente_nome}</p>
                <p className="text-2xl font-bold text-primary">{fmt(extratoGerado.total)}</p>
              </div>
              <p className="text-sm text-muted-foreground">Como deseja enviar?</p>
              <div className="space-y-2">
                <Button className="w-full gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleWhatsAppPosExtrato}>
                  <MessageCircle className="h-4 w-4" /> Enviar via WhatsApp
                </Button>
                <Button variant="outline" className="w-full gap-2" onClick={handleCompartilharPosExtrato}>
                  <Share2 className="h-4 w-4" /> Compartilhar PDF
                </Button>
                <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setExtratoGerado(null)}>
                  Fazer depois
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AccordionItem>
  );
}

// ══════════ TAB: ENVIAR ══════════
export function ClientesEnviar({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhuma cobrança aguardando envio." />;
  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => <EnviarItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function EnviarItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();
  const [regenerating, setRegenerating] = useState(false);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const { salvarExtrato } = useExtratos();

  const hasExtratoNoSistema = cliente.lancamentos.some(l => l.extrato_id);

  async function handleCopiarMensagem() {
    const lancamentosComProcesso = cliente.lancamentos.filter(l => l.processo_id);
    const processoIds = [...new Set(lancamentosComProcesso.map(l => l.processo_id).filter(Boolean))] as string[];
    const vaMap: Record<string, number> = {};

    if (processoIds.length > 0) {
      const { data: vas } = await supabase
        .from('valores_adicionais')
        .select('processo_id, valor')
        .in('processo_id', processoIds);

      if (vas) {
        for (const va of vas) {
          vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor;
        }
      }
    }

    const l = cliente.lancamentos[0];
    const valorPrimeiro = l.valor + (l.processo_id ? (vaMap[l.processo_id] || 0) : 0);
    const adicionais = cliente.lancamentos.slice(1).map(item => ({
      tipo: item.processo_tipo,
      razao_social: item.processo_razao_social,
      valor: item.valor + (item.processo_id ? (vaMap[item.processo_id] || 0) : 0),
    }));

    const msg = gerarMensagemCobranca({
      tipo: l.processo_tipo,
      razao_social: l.processo_razao_social,
      valor: valorPrimeiro,
      data_vencimento: l.data_vencimento,
      diasAtraso: 0,
      processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
    });
    await navigator.clipboard.writeText(msg);
    toast.success('Mensagem copiada para o clipboard!');
  }

  async function handleBaixarExtrato() {
    setLoadingExtrato(true);
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;

      if (!extratoId) {
        toast.error('Nenhum extrato encontrado. Gere novamente pela tab "Gerar Extrato".');
        return;
      }

      const { data: extrato } = await supabase
        .from('extratos')
        .select('cliente_id, filename')
        .eq('id', extratoId)
        .single();

      if (!extrato) {
        toast.error('Extrato não encontrado no sistema.');
        return;
      }

      const path = `extratos/${(extrato as any).cliente_id}/${(extrato as any).filename}`;
      await downloadExtrato('documentos', path, (extrato as any).filename);
    } catch (err) {
      console.error('Erro ao baixar extrato:', err);
      toast.error('Erro ao carregar o extrato.');
    } finally {
      setLoadingExtrato(false);
    }
  }

  async function handleRegerarExtrato() {
    setRegenerating(true);
    try {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', cliente.cliente_id)
        .single();

      const processoIds = cliente.lancamentos.map(l => l.processo_id).filter(Boolean);
      const { data: processosData } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .in('id', processoIds);

      const { data: lancamentosData } = await supabase
        .from('lancamentos')
        .select('*, cliente:clientes(*)')
        .eq('tipo', 'receber')
        .in('processo_id', processoIds);

      const lancMap = new Map<string, any>();
      (lancamentosData || []).forEach((l: any) => { if (!lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l); });

      const processosFinanceiro: ProcessoFinanceiro[] = (processosData || []).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(cliente.cliente_id),
      ]);

      const allCompetenciaFinanceiro: ProcessoFinanceiro[] = (allCompetencia as any[]).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const result = await gerarExtratoPDF({
        processos: processosFinanceiro,
        allCompetencia: allCompetenciaFinanceiro,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      const clienteName = clienteData?.apelido || clienteData?.nome || 'extrato';
      const filename = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save
      const now = new Date();
      await salvarExtrato.mutateAsync({
        clienteId: cliente.cliente_id,
        pdfBlob: blob,
        filename,
        totalHonorarios: result.totalHonorarios,
        totalTaxas: result.totalTaxas,
        totalGeral: result.totalGeral,
        processoIds,
        competenciaMes: now.getMonth() + 1,
        competenciaAno: now.getFullYear(),
      });

      invalidateFinanceiro(qc);
      toast.success('Extrato gerado e salvo no sistema!');
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleMarcarEnviado() {
    const ids = cliente.lancamentos.filter(l =>
      l.etapa_financeiro === 'cobranca_gerada' ||
      (l.etapa_financeiro === 'solicitacao_criada' && l.extrato_id)
    ).map(l => l.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('lancamentos')
      .update({ etapa_financeiro: 'cobranca_enviada', observacoes_financeiro: `Cobrança enviada em ${new Date().toLocaleDateString('pt-BR')}` } as any)
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    invalidateFinanceiro(qc);
    toast.success('Cobrança marcada como enviada!');
  }

  async function handleEnviarWhatsApp() {
    const lancamentosComProcesso = cliente.lancamentos.filter(l => l.processo_id);
    const processoIds = [...new Set(lancamentosComProcesso.map(l => l.processo_id).filter(Boolean))] as string[];
    const vaMap: Record<string, number> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds);
      if (vas) { for (const va of vas) { vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor; } }
    }
    const l = cliente.lancamentos[0];
    const valorPrimeiro = l.valor + (l.processo_id ? (vaMap[l.processo_id] || 0) : 0);
    const adicionais = cliente.lancamentos.slice(1).map(item => ({
      tipo: item.processo_tipo, razao_social: item.processo_razao_social,
      valor: item.valor + (item.processo_id ? (vaMap[item.processo_id] || 0) : 0),
    }));
    const msg = gerarMensagemCobranca({
      tipo: l.processo_tipo, razao_social: l.processo_razao_social, valor: valorPrimeiro,
      data_vencimento: l.data_vencimento, diasAtraso: 0,
      processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
    });
    const { data: clienteData } = await supabase.from('clientes').select('telefone').eq('id', cliente.cliente_id).single();
    const telefone = (clienteData as any)?.telefone?.replace(/\D/g, '') || '';
    const msgEncoded = encodeURIComponent(msg);
    if (telefone) {
      const tel = telefone.startsWith('55') ? telefone : '55' + telefone;
      window.open(`https://wa.me/${tel}?text=${msgEncoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${msgEncoded}`, '_blank');
      toast.info('Telefone não cadastrado. Escolha o contato no WhatsApp.');
    }
    setTimeout(() => {
      const confirmar = window.confirm('Cobrança enviada via WhatsApp. Marcar como enviada no sistema?');
      if (confirmar) handleMarcarEnviado();
    }, 1000);
  }

  async function handleCompartilhar() {
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado. Gere novamente.'); return; }
      const { data: extrato } = await supabase.from('extratos').select('cliente_id, filename').eq('id', extratoId).single();
      if (!extrato) { toast.error('Extrato não encontrado.'); return; }
      const path = `extratos/${(extrato as any).cliente_id}/${(extrato as any).filename}`;
      const { data: fileData } = await supabase.storage.from('documentos').download(path);
      if (!fileData) { toast.error('Erro ao carregar extrato.'); return; }
      const file = new File([fileData], (extrato as any).filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(fileData);
        const a = document.createElement('a'); a.href = url; a.download = (extrato as any).filename; a.click();
        URL.revokeObjectURL(url);
        toast.success('Extrato baixado!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Erro ao compartilhar: ' + err.message);
    }
  }

  return (
    <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 text-left min-w-0">
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
            <p className="text-xs text-muted-foreground truncate">{fmt(cliente.total_faturado)} · {cliente.qtd_processos} proc.</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            <ClienteHeaderBadges cliente={cliente} />
            {hasExtratoNoSistema && cliente.extrato_mais_recente ? (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-[10px] sm:text-xs whitespace-nowrap">
                Extrato em {fmtDate(cliente.extrato_mais_recente.created_at)}
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] sm:text-xs whitespace-nowrap">
                Extrato não salvo
              </Badge>
            )}
            <MoverParaMenu cliente={cliente} />
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          {!hasExtratoNoSistema && (
            <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 text-amber-600 text-sm mb-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Extrato gerado pelo sistema anterior. Gere novamente para salvar no sistema.</span>
              <Button size="sm" variant="outline" onClick={handleRegerarExtrato} disabled={regenerating}>
                <RefreshCw className="h-4 w-4 mr-1" />
                {regenerating ? 'Gerando...' : 'Gerar e Salvar'}
              </Button>
            </div>
          )}
          {cliente.lancamentos.map(l => <LancamentoRow key={l.id} lancamento={l} />)}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleEnviarWhatsApp} className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </Button>
            <Button size="sm" variant="outline" onClick={handleCompartilhar} className="gap-1">
              <Share2 className="h-4 w-4" /> Compartilhar
            </Button>
            {hasExtratoNoSistema && (
              <Button size="sm" variant="outline" onClick={handleBaixarExtrato} disabled={loadingExtrato}>
                {loadingExtrato ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Baixando...</>
                ) : (
                  <><Download className="h-4 w-4 mr-1" /> Baixar Extrato</>
                )}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleCopiarMensagem}>
              <Copy className="h-4 w-4 mr-1" /> Copiar WhatsApp
            </Button>
            <Button size="sm" onClick={handleMarcarEnviado} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="h-4 w-4 mr-1" /> Marcar como Enviado
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ══════════ TAB: AGUARDANDO ══════════
export function ClientesAguardando({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum pagamento pendente." />;
  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => <AguardandoItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function AguardandoItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const [showPago, setShowPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const [loadingExtrato, setLoadingExtrato] = useState(false);
  const [selectedPagar, setSelectedPagar] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const vencimento = cliente.lancamentos[0]?.data_vencimento;
  const dias = vencimento ? diasParaVencer(vencimento) : 0;

  const lancVencidos = cliente.lancamentos.filter(l => isLancamentoVencidoReal(l));
  const temVencidos = lancVencidos.length > 0;
  const maiorAtraso = temVencidos
    ? Math.max(...lancVencidos.map(l => {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const venc = new Date(l.data_vencimento + 'T00:00:00');
        return Math.floor((hoje.getTime() - venc.getTime()) / 86400000);
      }))
    : 0;

  function toggleSelectPagar(lancId: string) {
    setSelectedPagar(prev => {
      const next = new Set(prev);
      if (next.has(lancId)) next.delete(lancId); else next.add(lancId);
      return next;
    });
  }

  function selectAllPagar() { setSelectedPagar(new Set(cliente.lancamentos.map(l => l.id))); }
  function deselectAllPagar() { setSelectedPagar(new Set()); }

  async function confirmarPago() {
    const ids = selectedPagar.size > 0
      ? Array.from(selectedPagar)
      : cliente.lancamentos.map(l => l.id);

    if (ids.length === 0) {
      toast.warning('Selecione pelo menos um processo para marcar como pago.');
      return;
    }

    const { error } = await supabase
      .from('lancamentos')
      .update({
        etapa_financeiro: 'honorario_pago',
        status: 'pago' as const,
        data_pagamento: dataPagamento,
        confirmado_recebimento: true,
      })
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    setShowPago(false);
    setSelectedPagar(new Set());
    invalidateFinanceiro(qc);

    const naoSelecionados = cliente.lancamentos.length - ids.length;
    if (naoSelecionados > 0) {
      toast.success(`${ids.length} processo(s) marcado(s) como pago. ${naoSelecionados} permanecem pendentes.`);
    } else {
      toast.success('Todos os pagamentos confirmados!');
    }
  }

  async function handleCopiarCobranca() {
    const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
    if (lancsParaMsg.length === 0) return;

    const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))];
    let vaMap: Record<string, number> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds);
      if (vas) { for (const va of vas) { vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor; } }
    }

    const primeiro = lancsParaMsg[0];
    const valorPrimeiro = primeiro.valor + (vaMap[primeiro.processo_id] || 0);
    const adicionais = lancsParaMsg.slice(1).map(l => ({
      tipo: l.processo_tipo, razao_social: l.processo_razao_social,
      valor: l.valor + (vaMap[l.processo_id] || 0),
    }));
    const msg = gerarMensagemCobranca({
      tipo: primeiro.processo_tipo, razao_social: primeiro.processo_razao_social,
      valor: valorPrimeiro, data_vencimento: primeiro.data_vencimento, diasAtraso: maiorAtraso,
      processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
    });
    await navigator.clipboard.writeText(msg);
    toast.success(temVencidos ? 'Mensagem de recobrança copiada!' : 'Mensagem de cobrança copiada!');
  }

  async function handleBaixarExtrato() {
    setLoadingExtrato(true);
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado para este cliente.'); return; }
      const { data: extrato } = await supabase.from('extratos').select('cliente_id, filename').eq('id', extratoId).single();
      if (!extrato) { toast.error('Extrato não encontrado.'); return; }
      const path = `extratos/${(extrato as any).cliente_id}/${(extrato as any).filename}`;
      await downloadExtrato('documentos', path, (extrato as any).filename);
    } catch (err) {
      toast.error('Erro ao baixar extrato.');
    } finally {
      setLoadingExtrato(false);
    }
  }

  async function handleEnviarWhatsAppRecobranca() {
    const lancsParaMsg = temVencidos ? lancVencidos : cliente.lancamentos;
    if (lancsParaMsg.length === 0) return;
    const processoIds = [...new Set(lancsParaMsg.map(l => l.processo_id).filter(Boolean))];
    let vaMap: Record<string, number> = {};
    if (processoIds.length > 0) {
      const { data: vas } = await supabase.from('valores_adicionais').select('processo_id, valor').in('processo_id', processoIds);
      if (vas) { for (const va of vas) { vaMap[va.processo_id] = (vaMap[va.processo_id] || 0) + va.valor; } }
    }
    const primeiro = lancsParaMsg[0];
    const valorPrimeiro = primeiro.valor + (vaMap[primeiro.processo_id] || 0);
    const adicionais = lancsParaMsg.slice(1).map(l => ({
      tipo: l.processo_tipo, razao_social: l.processo_razao_social,
      valor: l.valor + (vaMap[l.processo_id] || 0),
    }));
    const msg = gerarMensagemCobranca({
      tipo: primeiro.processo_tipo, razao_social: primeiro.processo_razao_social,
      valor: valorPrimeiro, data_vencimento: primeiro.data_vencimento, diasAtraso: maiorAtraso,
      processosAdicionais: adicionais.length > 0 ? adicionais : undefined,
    });
    const { data: clienteData } = await supabase.from('clientes').select('telefone').eq('id', cliente.cliente_id).single();
    const telefone = (clienteData as any)?.telefone?.replace(/\D/g, '') || '';
    const msgEncoded = encodeURIComponent(msg);
    if (telefone) {
      const tel = telefone.startsWith('55') ? telefone : '55' + telefone;
      window.open(`https://wa.me/${tel}?text=${msgEncoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${msgEncoded}`, '_blank');
      toast.info('Telefone não cadastrado. Escolha o contato no WhatsApp.');
    }
  }

  async function handleCompartilharAguardando() {
    try {
      const lancComExtrato = cliente.lancamentos.find(l => l.extrato_id);
      const extratoId = lancComExtrato?.extrato_id || cliente.extrato_mais_recente?.id;
      if (!extratoId) { toast.error('Nenhum extrato encontrado.'); return; }
      const { data: extrato } = await supabase.from('extratos').select('cliente_id, filename').eq('id', extratoId).single();
      if (!extrato) { toast.error('Extrato não encontrado.'); return; }
      const path = `extratos/${(extrato as any).cliente_id}/${(extrato as any).filename}`;
      const { data: fileData } = await supabase.storage.from('documentos').download(path);
      if (!fileData) { toast.error('Erro ao carregar extrato.'); return; }
      const file = new File([fileData], (extrato as any).filename, { type: 'application/pdf' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        const url = URL.createObjectURL(fileData);
        const a = document.createElement('a'); a.href = url; a.download = (extrato as any).filename; a.click();
        URL.revokeObjectURL(url);
        toast.success('Extrato baixado!');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toast.error('Erro ao compartilhar: ' + err.message);
    }
  }

  const valorSelecionado = cliente.lancamentos.filter(l => selectedPagar.has(l.id)).reduce((s, l) => s + l.valor, 0);

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className={cn("border rounded-lg bg-card", temVencidos && "border-destructive/30")}>
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 text-left min-w-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {fmt(cliente.total_faturado)} · Enviado · Vence {fmtDate(vencimento)}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <ClienteHeaderBadges cliente={cliente} />
              {temVencidos ? (
                <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] sm:text-xs whitespace-nowrap">
                  Vencido há {maiorAtraso}d
                </Badge>
              ) : (
                <Badge variant="outline" className={cn('text-[10px] sm:text-xs whitespace-nowrap', dias < 0
                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                  : dias <= 3
                    ? 'bg-warning/10 text-warning border-warning/30'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje' : `${dias}d p/ vencer`}
                </Badge>
              )}
              <MoverParaMenu cliente={cliente} />
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {cliente.lancamentos.map(l => {
              const isVenc = isLancamentoVencidoReal(l);
              const dAtraso = isVenc ? Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(l.data_vencimento + 'T00:00:00').getTime()) / 86400000) : 0;
              return (
                <div key={l.id} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedPagar.has(l.id)}
                    onCheckedChange={() => toggleSelectPagar(l.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <LancamentoRow lancamento={l} />
                  </div>
                  {isVenc && (
                    <Badge className="bg-destructive/15 text-destructive border-0 text-[10px] shrink-0">
                      Vencido {dAtraso}d
                    </Badge>
                  )}
                </div>
              );
            })}
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={selectAllPagar}>
                Selecionar todos
              </Button>
              <Button size="sm" variant="ghost" className="text-xs h-6" onClick={deselectAllPagar}>
                Limpar seleção
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedPagar.size} de {cliente.lancamentos.length} · {fmt(valorSelecionado)}
              </span>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleEnviarWhatsAppRecobranca} className="gap-1 text-green-600 border-green-600/30 hover:bg-green-600/10">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
              <Button size="sm" variant="outline" onClick={handleCompartilharAguardando} className="gap-1">
                <Share2 className="h-4 w-4" /> Compartilhar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCopiarCobranca}>
                <Copy className="h-4 w-4 mr-1" /> {temVencidos ? 'Reenviar Cobrança' : 'Copiar WhatsApp'}
              </Button>
              {(cliente.lancamentos.some(l => l.extrato_id) || cliente.extrato_mais_recente) && (
                <Button size="sm" variant="outline" onClick={handleBaixarExtrato} disabled={loadingExtrato}>
                  <Download className="h-4 w-4 mr-1" /> {loadingExtrato ? 'Baixando...' : 'Baixar Extrato'}
                </Button>
              )}
              <Button size="sm" onClick={() => setShowPago(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="h-4 w-4 mr-1" /> {selectedPagar.size > 0 ? `Pagar (${selectedPagar.size})` : 'Marcar como Pago'}
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <Dialog open={showPago} onOpenChange={setShowPago}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirmar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {cliente.cliente_apelido || cliente.cliente_nome} — {selectedPagar.size > 0 ? `${selectedPagar.size} de ${cliente.lancamentos.length} processos · ${fmt(valorSelecionado)}` : fmt(cliente.total_faturado)}
            </p>
            <div>
              <label className="text-xs font-medium">Data do pagamento</label>
              <Input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPago(false)}>Cancelar</Button>
            <Button onClick={confirmarPago} className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ══════════ TAB: RECEBIDOS ══════════
export function ClientesRecebidos({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum pagamento recebido neste período." />;
  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => <RecebidoItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function RecebidoItem({ cliente: c }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();

  async function handleDesfazerPagamento(lancamentoIds: string[]) {
    if (!confirm('Tem certeza que deseja desfazer este pagamento? O lançamento voltará para "Aguardando".')) return;
    const { error } = await supabase
      .from('lancamentos')
      .update({
        etapa_financeiro: 'cobranca_enviada',
        status: 'pendente' as const,
        data_pagamento: null,
        confirmado_recebimento: false,
      })
      .in('id', lancamentoIds);
    if (error) { toast.error(error.message); return; }
    invalidateFinanceiro(qc);
    toast.success('Pagamento desfeito! Lançamento voltou para "Aguardando".');
  }

  return (
    <AccordionItem key={c.cliente_id} value={c.cliente_id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{c.cliente_apelido || c.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">{fmt(c.total_faturado)} · {c.qtd_processos} proc.</p>
          </div>
          <ClienteHeaderBadges cliente={c} />
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
            <CheckCircle className="h-3 w-3 mr-1" /> Pago
          </Badge>
          <MoverParaMenu cliente={c} />
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <div className="space-y-2">
          {c.lancamentos.map(l => (
            <div key={l.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <LancamentoRow lancamento={l} />
              </div>
              {(l.status === 'pago' || l.etapa_financeiro === 'honorario_pago') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 text-xs shrink-0"
                  onClick={() => handleDesfazerPagamento([l.id])}
                >
                  Desfazer
                </Button>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="text-amber-600 border-amber-600/30 hover:bg-amber-500/10"
              onClick={() => handleDesfazerPagamento(c.lancamentos.map(l => l.id))}
            >
              Desfazer Todos os Pagamentos
            </Button>
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}


// ══════════ MOVER PARA MENU ══════════
function MoverParaMenu({ cliente }: { cliente: ClienteFinanceiro }) {
  const qc = useQueryClient();

  async function handleMoverPara(novaEtapa: string) {
    const lancamentoIds = cliente.lancamentos
      .filter(l => l.status !== 'pago')
      .map(l => l.id);

    if (lancamentoIds.length === 0) {
      toast.error('Nenhum lançamento pendente para mover.');
      return;
    }

    const updates: Record<string, any> = { etapa_financeiro: novaEtapa };

    if (novaEtapa === 'honorario_pago') {
      updates.status = 'pago';
      updates.data_pagamento = new Date().toISOString().split('T')[0];
      updates.confirmado_recebimento = true;
    }

    if (novaEtapa === 'solicitacao_criada') {
      updates.extrato_id = null;
    }

    const { error } = await supabase
      .from('lancamentos')
      .update(updates)
      .in('id', lancamentoIds);

    if (error) {
      toast.error('Erro ao mover: ' + error.message);
      return;
    }

    invalidateFinanceiro(qc);

    const nomes: Record<string, string> = {
      solicitacao_criada: 'Cobrar',
      cobranca_gerada: 'Enviados',
      cobranca_enviada: 'Ag. Pagamento',
      honorario_pago: 'Pagos',
    };
    toast.success(`${cliente.cliente_apelido || cliente.cliente_nome} movido para "${nomes[novaEtapa] || novaEtapa}"`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel className="text-xs text-muted-foreground">Mover para</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleMoverPara('solicitacao_criada')}>
          <FileText className="h-4 w-4 mr-2" />
          Cobrar (resetar)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_gerada')}>
          <Send className="h-4 w-4 mr-2" />
          Enviados (extrato gerado)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleMoverPara('cobranca_enviada')}>
          <Clock className="h-4 w-4 mr-2" />
          Ag. Pagamento (enviado)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleMoverPara('honorario_pago')} className="text-emerald-500">
          <CheckCircle className="h-4 w-4 mr-2" />
          Marcar como Pago
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ══════════ SHARED COMPONENTS ══════════
function LancamentoRow({ lancamento: l, checked, onToggle }: { lancamento: LancamentoFinanceiro; checked?: boolean; onToggle?: () => void }) {
  const badges = parseBadges(l.processo_notas);
  const alertaTaxas = (l.tem_etiqueta_metodo_trevo || l.tem_etiqueta_prioridade) && l.total_valores_adicionais === 0;
  const obsLower = ((l.observacoes_financeiro || '') + ' ' + (l.descricao || '')).toLowerCase();
  const temExtratoLegado = !l.extrato_id && obsLower.includes('extrato emitido');

  // Build current etiquetas array from booleans
  const currentEtiquetas: string[] = [];
  if (l.tem_etiqueta_metodo_trevo) currentEtiquetas.push('metodo_trevo');
  if (l.tem_etiqueta_prioridade) currentEtiquetas.push('prioridade');

  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
      {onToggle !== undefined && (
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{l.processo_razao_social}</p>
        <p className="text-xs text-muted-foreground">
          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo} · {fmt(l.valor)}
          {l.valor_original != null && l.valor_original !== l.valor && (
            <span className="text-amber-600 font-medium"> (orig. {fmt(l.valor_original)})</span>
          )}
          {l.total_valores_adicionais > 0 && (
            <span className="text-amber-600 font-medium"> + {fmt(l.total_valores_adicionais)} taxas</span>
          )}
          {l.data_vencimento && ` · Vence ${fmtDate(l.data_vencimento)}`}
        </p>
        {alertaTaxas && (
          <p className="text-[10px] text-amber-600 mt-0.5">⚠️ Verificar taxas adicionais</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0 flex-wrap justify-end items-center">
        {l.tem_etiqueta_metodo_trevo && (
          <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0">
            🍀 Trevo
          </Badge>
        )}
        {l.tem_etiqueta_prioridade && (
          <Badge variant="outline" className="bg-red-500/15 text-red-500 border-red-500/30 text-[10px] px-1.5 py-0">
            🔴 Prior.
          </Badge>
        )}
        {badges.map(b => (
          <Badge key={b} variant="outline" className={cn('text-[10px] px-1.5 py-0', BADGE_COLORS[b] || '')}>
            {b}
          </Badge>
        ))}
        {l.valor_alterado_em && (
          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0">
            ✏️ Alterado
          </Badge>
        )}
        {l.extrato_id && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] px-1.5 py-0">
            Extrato
          </Badge>
        )}
        {temExtratoLegado && (
          <Badge variant="outline" className="bg-orange-500/15 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">
            ⚠️ Extrato anterior — gerar novamente
          </Badge>
        )}
        {l.processo_id && (
          <EtiquetasEdit
            etiquetas={currentEtiquetas}
            processoId={l.processo_id}
            size="compact"
            triggerVariant="icon"
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
