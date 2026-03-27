import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Send, Copy, Download, CheckCircle, AlertTriangle, Clock, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import type { ClienteFinanceiro, LancamentoFinanceiro } from '@/hooks/useFinanceiroClientes';
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

/** Invalidate all financial queries across screens */
function invalidateFinanceiro(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['financeiro_clientes'] });
  qc.invalidateQueries({ queryKey: ['contas_receber'] });
  qc.invalidateQueries({ queryKey: ['lancamentos_receber'] });
  qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
  qc.invalidateQueries({ queryKey: ['lancamentos'] });
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

// ══════════ TAB: FATURAR ══════════
export function ClientesFaturar({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) return <EmptyState text="Nenhum cliente aguardando geração de extrato." />;
  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => <FaturarItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function FaturarItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const { salvarExtrato } = useExtratos();
  const qc = useQueryClient();

  const lancSemExtrato = cliente.lancamentos.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada');
  const totalSelecionado = lancSemExtrato.filter(l => selected.has(l.id)).reduce((s, l) => s + l.valor, 0);

  function toggleAll() {
    if (selected.size === lancSemExtrato.length) setSelected(new Set());
    else setSelected(new Set(lancSemExtrato.map(l => l.id)));
  }

  async function handleGerarExtrato() {
    const selecionados = lancSemExtrato.filter(l => selected.has(l.id));
    if (selecionados.length === 0) { toast.warning('Selecione ao menos um processo.'); return; }

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

      setSelected(new Set());
      invalidateFinanceiro(qc);
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">
              {cliente.qtd_processos} proc. · {fmt(cliente.total_faturado)} · {tipoLabel(cliente)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
              {cliente.qtd_sem_extrato} sem extrato
            </Badge>
            {cliente.qtd_aguardando_deferimento > 0 && (
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs">
                Ag. deferimento ({cliente.qtd_aguardando_deferimento})
              </Badge>
            )}
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
            <LancamentoRow key={l.id} lancamento={l} checked={selected.has(l.id)} onToggle={() => {
              const next = new Set(selected);
              if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
              setSelected(next);
            }} />
          ))}
          {selected.size > 0 && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 mt-3">
              <span className="text-sm font-medium">{selected.size} selecionados · {fmt(totalSelecionado)}</span>
              <Button size="sm" onClick={handleGerarExtrato} disabled={generating} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <FileText className="h-4 w-4 mr-1" />
                {generating ? 'Gerando...' : `Gerar Extrato (${selected.size})`}
              </Button>
            </div>
          )}
        </div>
      </AccordionContent>
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
    const l = cliente.lancamentos[0];
    const msg = gerarMensagemCobranca({
      tipo: l.processo_tipo,
      razao_social: l.processo_razao_social,
      valor: cliente.total_faturado,
      data_vencimento: l.data_vencimento,
      diasAtraso: 0,
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
    const ids = cliente.lancamentos.filter(l => l.etapa_financeiro === 'cobranca_gerada').map(l => l.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('lancamentos')
      .update({ etapa_financeiro: 'cobranca_enviada', observacoes_financeiro: `Cobrança enviada em ${new Date().toLocaleDateString('pt-BR')}` } as any)
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    invalidateFinanceiro(qc);
    toast.success('Cobrança marcada como enviada!');
  }

  return (
    <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
            <p className="text-xs text-muted-foreground">{fmt(cliente.total_faturado)} · {cliente.qtd_processos} proc.</p>
          </div>
          {hasExtratoNoSistema && cliente.extrato_mais_recente ? (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs">
              Extrato em {fmtDate(cliente.extrato_mais_recente.created_at)}
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
              Extrato não salvo
            </Badge>
          )}
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
  const qc = useQueryClient();

  const vencimento = cliente.lancamentos[0]?.data_vencimento;
  const dias = vencimento ? diasParaVencer(vencimento) : 0;

  async function confirmarPago() {
    const ids = cliente.lancamentos.map(l => l.id);
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
    invalidateFinanceiro(qc);
    toast.success('Pagamento confirmado!');
  }

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 flex-1 text-left">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(cliente.total_faturado)} · Enviado · Vence {fmtDate(vencimento)}
              </p>
            </div>
            <Badge variant="outline" className={cn('text-xs', dias < 0
              ? 'bg-destructive/10 text-destructive border-destructive/30'
              : dias <= 3
                ? 'bg-warning/10 text-warning border-warning/30'
                : 'bg-muted text-muted-foreground'
            )}>
              {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : dias === 0 ? 'Vence hoje' : `${dias}d p/ vencer`}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {cliente.lancamentos.map(l => <LancamentoRow key={l.id} lancamento={l} />)}
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => setShowPago(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="h-4 w-4 mr-1" /> Marcar como Pago
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
            <p className="text-sm text-muted-foreground">{cliente.cliente_apelido || cliente.cliente_nome} — {fmt(cliente.total_faturado)}</p>
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
      {clientes.map(c => (
        <AccordionItem key={c.cliente_id} value={c.cliente_id} className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3 flex-1 text-left">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.cliente_apelido || c.cliente_nome}</p>
                <p className="text-xs text-muted-foreground">{fmt(c.total_faturado)} · {c.qtd_processos} proc.</p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> Pago
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <div className="space-y-2">
              {c.lancamentos.map(l => <LancamentoRow key={l.id} lancamento={l} />)}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

// ══════════ TAB: VENCIDOS ══════════
export function ClientesVencidos({ clientes }: { clientes: ClienteFinanceiro[] }) {
  if (clientes.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma cobrança vencida. Tudo em dia! ✓</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Accordion type="multiple" className="space-y-2">
      {clientes.map(c => <VencidoItem key={c.cliente_id} cliente={c} />)}
    </Accordion>
  );
}

function VencidoItem({ cliente }: { cliente: ClienteFinanceiro }) {
  const [showPago, setShowPago] = useState(false);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);
  const qc = useQueryClient();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const lancVencidos = cliente.lancamentos.filter(l => {
    if (l.status === 'pago' || l.etapa_financeiro === 'honorario_pago') return false;
    if (l.status === 'atrasado' || l.etapa_financeiro === 'honorario_vencido') return true;
    const venc = l.data_vencimento ? new Date(l.data_vencimento + 'T00:00:00') : null;
    return venc ? venc < hoje : false;
  });
  const maiorAtraso = Math.max(...lancVencidos.map(l => diasAtraso(l.data_vencimento)), 0);

  async function confirmarPago() {
    const ids = cliente.lancamentos.map(l => l.id);
    const { error } = await supabase
      .from('lancamentos')
      .update({ etapa_financeiro: 'honorario_pago', status: 'pago' as const, data_pagamento: dataPagamento, confirmado_recebimento: true })
      .in('id', ids);
    if (error) { toast.error(error.message); return; }
    setShowPago(false);
    invalidateFinanceiro(qc);
    toast.success('Pagamento confirmado!');
  }

  async function handleCopiarCobranca() {
    const l = lancVencidos[0];
    if (!l) return;
    const msg = gerarMensagemCobranca({
      tipo: l.processo_tipo,
      razao_social: l.processo_razao_social,
      valor: cliente.total_faturado,
      data_vencimento: l.data_vencimento,
      diasAtraso: maiorAtraso,
    });
    await navigator.clipboard.writeText(msg);
    toast.success('Mensagem de cobrança copiada!');
  }

  return (
    <>
      <AccordionItem value={cliente.cliente_id} className="border rounded-lg bg-card border-destructive/30">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex items-center gap-3 flex-1 text-left">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{cliente.cliente_apelido || cliente.cliente_nome}</p>
              <p className="text-xs text-muted-foreground">{fmt(cliente.total_faturado)} · {lancVencidos.length} proc.</p>
            </div>
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" /> Vencido há {maiorAtraso}d
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="space-y-2">
            {cliente.lancamentos.map(l => <LancamentoRow key={l.id} lancamento={l} />)}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleCopiarCobranca}>
                <Copy className="h-4 w-4 mr-1" /> Reenviar Cobrança
              </Button>
              <Button size="sm" onClick={() => setShowPago(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="h-4 w-4 mr-1" /> Marcar como Pago
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <Dialog open={showPago} onOpenChange={setShowPago}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{cliente.cliente_apelido || cliente.cliente_nome} — {fmt(cliente.total_faturado)}</p>
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

// ══════════ SHARED COMPONENTS ══════════
function LancamentoRow({ lancamento: l, checked, onToggle }: { lancamento: LancamentoFinanceiro; checked?: boolean; onToggle?: () => void }) {
  const badges = parseBadges(l.processo_notas);
  return (
    <div className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors">
      {onToggle !== undefined && (
        <Checkbox checked={checked} onCheckedChange={onToggle} />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{l.processo_razao_social}</p>
        <p className="text-xs text-muted-foreground">
          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo} · {fmt(l.valor)}
          {l.data_vencimento && ` · Vence ${fmtDate(l.data_vencimento)}`}
        </p>
      </div>
      <div className="flex gap-1 shrink-0 flex-wrap justify-end">
        {badges.map(b => (
          <Badge key={b} variant="outline" className={cn('text-[10px] px-1.5 py-0', BADGE_COLORS[b] || '')}>
            {b}
          </Badge>
        ))}
        {l.extrato_id && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] px-1.5 py-0">
            Extrato
          </Badge>
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
