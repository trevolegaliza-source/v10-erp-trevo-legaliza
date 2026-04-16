import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, Loader2, CheckCircle, AlertTriangle, Clock, Zap } from 'lucide-react';
import type { ClienteFinanceiro, LancamentoFinanceiro, MensalistaSemFatura } from '@/hooks/useFinanceiroClientes';
import { invalidateFinanceiro } from '@/hooks/useFinanceiroClientes';
import type { ExtratoGeradoPayload } from './ClienteAccordionFinanceiro';
import { buildExtratoFilename } from './ClienteAccordionFinanceiro';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { formatBRL } from '@/lib/pricing-engine';

// ── Types ──

interface CobrarHojeItem {
  type: 'lancamento' | 'mensalista';
  // Lancamento fields
  lancamento?: LancamentoFinanceiro;
  cliente?: ClienteFinanceiro;
  // Mensalista fields
  mensalista?: MensalistaSemFatura;
  // Computed
  clienteNome: string;
  clienteApelido: string | null;
  clienteId: string;
  valor: number;
  dataVencimento: Date;
  diasAtraso: number;
  diasAteVencer: number;
  statusHumano: string;
  corStatus: string;
  corBadge: string;
  sortLayer: number;
  sortSecondary: number;
  id: string;
}

function computeStatus(diasAtraso: number, diasAteVencer: number, isDeferimento: boolean, isMensalista: boolean): { texto: string; cor: string; badge: string; layer: number } {
  if (isDeferimento) {
    return { texto: 'Deferido ✅ — gerar cobrança 🟢', cor: 'text-emerald-500', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', layer: 4 };
  }

  if (isMensalista && diasAtraso > 0) {
    return { texto: `Fatura mensal — venceu há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} 🔴`, cor: 'text-red-500', badge: 'bg-red-500/15 text-red-500 border-red-500/30', layer: 1 };
  }

  if (isMensalista) {
    const diasRestantes = diasAteVencer;
    return { texto: `Fatura mensal — gerar até ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} 🔵`, cor: 'text-blue-500', badge: 'bg-blue-500/15 text-blue-500 border-blue-500/30', layer: 3 };
  }

  if (diasAtraso > 5) {
    return { texto: `Venceu há ${diasAtraso} dias — URGENTE 🔴`, cor: 'text-red-600 font-bold', badge: 'bg-red-600/20 text-red-600 border-red-600/40', layer: 1 };
  }
  if (diasAtraso > 0) {
    return { texto: `Venceu há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} — cobrar agora 🔴`, cor: 'text-red-500', badge: 'bg-red-500/15 text-red-500 border-red-500/30', layer: 1 };
  }
  if (diasAteVencer === 0) {
    return { texto: 'Vence hoje — enviar cobrança 🟡', cor: 'text-yellow-500', badge: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', layer: 2 };
  }
  if (diasAteVencer <= 3) {
    return { texto: `Vence em ${diasAteVencer} dia${diasAteVencer > 1 ? 's' : ''}`, cor: 'text-amber-500', badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', layer: 3 };
  }
  return { texto: `Vence em ${diasAteVencer} dias`, cor: 'text-muted-foreground', badge: 'bg-muted text-muted-foreground border-border', layer: 3 };
}

function diffDays(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// ── Component ──

interface CobrarHojeTabProps {
  clientesCobrar: ClienteFinanceiro[];
  mensalistasSemFatura: MensalistaSemFatura[];
  aguardandoDeferimentoValor: number;
  onExtratoGerado: (payload: ExtratoGeradoPayload) => void;
}

export default function CobrarHojeTab({ clientesCobrar, mensalistasSemFatura, aguardandoDeferimentoValor, onExtratoGerado }: CobrarHojeTabProps) {
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState<string | null>(null);
  const [gerandoFatura, setGerandoFatura] = useState<string | null>(null);
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());

  const hoje = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);

  const items = useMemo<CobrarHojeItem[]>(() => {
    const result: CobrarHojeItem[] = [];

    // Flatten lancamentos from clientesCobrar
    for (const c of clientesCobrar) {
      for (const l of c.lancamentos) {
        const venc = new Date(l.data_vencimento + 'T00:00:00');
        const diff = diffDays(venc, hoje);
        const atraso = Math.max(0, diff);
        const ateVencer = Math.max(0, -diff);

        // Check if this is a deferimento-liberado (client is no_deferimento but process is in post-deferimento stage)
        const isDef = c.cliente_momento_faturamento === 'no_deferimento' && ['baixa', 'avulso'].includes(l.processo_tipo);

        const status = computeStatus(atraso, ateVencer, isDef, false);

        result.push({
          type: 'lancamento',
          lancamento: l,
          cliente: c,
          clienteNome: c.cliente_nome,
          clienteApelido: c.cliente_apelido,
          clienteId: c.cliente_id,
          valor: l.valor + (l.total_valores_adicionais || 0),
          dataVencimento: venc,
          diasAtraso: atraso,
          diasAteVencer: ateVencer,
          statusHumano: status.texto,
          corStatus: status.cor,
          corBadge: status.badge,
          sortLayer: status.layer,
          sortSecondary: atraso > 0 ? -atraso * 1000000 - l.valor : ateVencer * 1000000 - l.valor,
          id: l.id,
        });
      }
    }

    // Add mensalistas sem fatura (within 5-day window or overdue)
    for (const m of mensalistasSemFatura) {
      const dia = m.dia_vencimento_mensal || 10;
      const now = new Date();
      let vencDate = new Date(now.getFullYear(), now.getMonth(), dia);
      // If venc is in the past and we're past the day, it's overdue this month
      const diff = diffDays(vencDate, hoje);
      const atraso = Math.max(0, diff);
      const ateVencer = Math.max(0, -diff);

      // Only show if overdue OR within 5-day window before vencimento
      if (atraso === 0 && ateVencer > 5) continue;

      const status = computeStatus(atraso, ateVencer, false, true);

      result.push({
        type: 'mensalista',
        mensalista: m,
        clienteNome: m.nome,
        clienteApelido: m.apelido,
        clienteId: m.id,
        valor: m.valor_base,
        dataVencimento: vencDate,
        diasAtraso: atraso,
        diasAteVencer: ateVencer,
        statusHumano: status.texto,
        corStatus: status.cor,
        corBadge: status.badge,
        sortLayer: status.layer,
        sortSecondary: atraso > 0 ? -atraso * 1000000 - m.valor_base : ateVencer * 1000000 - m.valor_base,
        id: 'mensal_' + m.id,
      });
    }

    // Sort by layer ASC, then secondary ASC (vencidos first, higher values first within same day)
    result.sort((a, b) => {
      if (a.sortLayer !== b.sortLayer) return a.sortLayer - b.sortLayer;
      return a.sortSecondary - b.sortSecondary;
    });

    return result;
  }, [clientesCobrar, mensalistasSemFatura, hoje]);

  // Totals
  const totalCobrar = useMemo(() => items.reduce((s, i) => s + i.valor, 0), [items]);
  const totalVencido = useMemo(() => items.filter(i => i.diasAtraso > 0).reduce((s, i) => s + i.valor, 0), [items]);
  const totalSemana = useMemo(() => items.filter(i => i.diasAtraso === 0 && i.diasAteVencer <= 7).reduce((s, i) => s + i.valor, 0), [items]);

  // ── Gerar Extrato (single lancamento) ──
  const handleGerarExtrato = useCallback(async (item: CobrarHojeItem) => {
    if (item.type !== 'lancamento' || !item.lancamento || !item.cliente) return;
    setGerando(item.id);
    const l = item.lancamento;
    const c = item.cliente;

    try {
      const processoIds = [l.processo_id].filter(Boolean) as string[];
      const clienteId = c.cliente_id;
      const clienteNome = c.cliente_apelido || c.cliente_nome;

      const [clienteData, vaMulti, allComp] = await Promise.all([
        supabase.from('clientes').select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, telefone_financeiro, email, nome_contador, dia_cobranca, dia_vencimento_mensal').eq('id', clienteId).single().then(r => r.data),
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(clienteId, [{
          id: l.processo_id || l.id,
          created_at: l.processo_created_at || new Date().toISOString(),
        }] as any),
      ]);

      const processos = [{
        id: l.processo_id || l.id,
        razao_social: l.processo_razao_social,
        tipo: l.processo_tipo,
        valor: l.valor,
        valor_avulso: l.valor_original ?? null,
        created_at: l.processo_created_at || new Date().toISOString(),
        etapa: l.processo_etapa || '',
        cliente_id: clienteId,
        notas: l.processo_notas || null,
        data_deferimento: null,
        etiquetas: [] as string[],
      }];

      const result = await gerarExtratoPDF({
        processos: processos as any,
        allCompetencia: allComp as any,
        valoresAdicionais: vaMulti,
        cliente: {
          nome: clienteData?.nome || clienteNome,
          cnpj: (clienteData as any)?.cnpj || null,
          apelido: (clienteData as any)?.apelido || null,
          valor_base: (clienteData as any)?.valor_base || null,
          desconto_progressivo: (clienteData as any)?.desconto_progressivo || null,
          valor_limite_desconto: (clienteData as any)?.valor_limite_desconto || null,
          telefone: (clienteData as any)?.telefone || null,
          email: (clienteData as any)?.email || null,
          nome_contador: (clienteData as any)?.nome_contador || null,
          dia_cobranca: (clienteData as any)?.dia_cobranca || null,
          dia_vencimento_mensal: (clienteData as any)?.dia_vencimento_mensal || null,
        },
      });

      const pdfBlob = result.doc.output('blob');
      const filename = buildExtratoFilename(clienteNome);

      // Save to storage
      const { empresaPath } = await import('@/lib/storage-path');
      const path = await empresaPath(`extratos/${clienteId}/${filename}`);
      await supabase.storage.from('documentos').upload(path, pdfBlob, { contentType: 'application/pdf', upsert: true });
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

      const now = new Date();
      const { data: extrato, error: insertError } = await supabase
        .from('extratos')
        .insert({
          cliente_id: clienteId,
          pdf_url: urlData.publicUrl,
          filename,
          total_honorarios: result.totalHonorarios,
          total_taxas: result.totalTaxas,
          total_geral: result.totalGeral,
          qtd_processos: result.processCount,
          processo_ids: processoIds,
          competencia_mes: now.getMonth() + 1,
          competencia_ano: now.getFullYear(),
          status: 'ativo',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // Link lancamento to extrato
      for (const pid of processoIds) {
        await supabase
          .from('lancamentos')
          .update({
            extrato_id: (extrato as any).id,
            etapa_financeiro: 'cobranca_gerada',
            observacoes_financeiro: `Extrato emitido em ${now.toLocaleDateString('pt-BR')}`,
          } as any)
          .eq('processo_id', pid)
          .eq('tipo', 'receber');
      }

      toast.success('Extrato gerado!');

      onExtratoGerado({
        blob: pdfBlob,
        filename,
        clienteId,
        clienteNome,
        clienteTelefone: (clienteData as any)?.telefone_financeiro || (clienteData as any)?.telefone || c.cliente_telefone || '',
        total: result.totalGeral,
        lancamentos: [l],
        cleanup: () => {
          setGerando(null);
          // Fade out this card
          setFadingOut(prev => new Set(prev).add(item.id));
          setTimeout(() => {
            invalidateFinanceiro(queryClient);
          }, 1000);
        },
      });
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + (err?.message || 'Erro'));
      setGerando(null);
    }
  }, [queryClient, onExtratoGerado]);

  // ── Gerar Fatura Mensal ──
  const handleGerarFatura = useCallback(async (item: CobrarHojeItem) => {
    if (item.type !== 'mensalista' || !item.mensalista) return;
    const m = item.mensalista;
    setGerandoFatura(item.id);
    try {
      const now = new Date();
      const dia = m.dia_vencimento_mensal || 10;
      const vencimento = new Date(now.getFullYear(), now.getMonth(), dia);
      if (vencimento < now) vencimento.setMonth(vencimento.getMonth() + 1);
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
      toast.success(`Fatura gerada para ${m.apelido || m.nome}!`);
      invalidateFinanceiro(queryClient);
    } catch (err: any) {
      toast.error('Erro ao gerar fatura: ' + (err?.message || 'Erro'));
    } finally {
      setGerandoFatura(null);
    }
  }, [queryClient]);

  const visibleItems = items.filter(i => !fadingOut.has(i.id));

  if (visibleItems.length === 0 && aguardandoDeferimentoValor === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle className="h-10 w-10 text-emerald-500/40 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma cobrança pendente para hoje. Tudo em dia! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header: totais ── */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">A cobrar hoje</span>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-foreground">{formatBRL(totalCobrar)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs">
          {totalVencido > 0 && (
            <span className="text-red-500 font-medium">{formatBRL(totalVencido)} vencidos</span>
          )}
          {totalSemana > 0 && (
            <span className="text-muted-foreground">{formatBRL(totalSemana)} a vencer esta semana</span>
          )}
          {aguardandoDeferimentoValor > 0 && (
            <span className="text-muted-foreground/60">{formatBRL(aguardandoDeferimentoValor)} ag. deferimento</span>
          )}
        </div>
      </div>

      {/* ── Cards ── */}
      <div className="space-y-2">
        {visibleItems.map(item => (
          <div
            key={item.id}
            className={cn(
              'rounded-lg border bg-card p-4 transition-all duration-500',
              fadingOut.has(item.id) && 'opacity-0 scale-95 pointer-events-none',
              item.diasAtraso > 5 && 'border-red-500/40 bg-red-500/5',
              item.diasAtraso > 0 && item.diasAtraso <= 5 && 'border-red-500/20',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                {/* Client name */}
                <p className="font-semibold text-sm truncate">
                  {item.clienteApelido || item.clienteNome}
                </p>
                {/* Value */}
                <p className="text-xl font-bold text-foreground">
                  {formatBRL(item.valor)}
                </p>
                {/* Status badge */}
                <Badge variant="outline" className={cn('text-xs', item.corBadge)}>
                  {item.statusHumano}
                </Badge>
                {/* Process info */}
                {item.type === 'lancamento' && item.lancamento && (
                  <p className="text-xs text-muted-foreground truncate">
                    {TIPO_PROCESSO_LABELS[item.lancamento.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || item.lancamento.processo_tipo}
                    {' — '}
                    {item.lancamento.processo_razao_social}
                  </p>
                )}
                {item.type === 'mensalista' && (
                  <p className="text-xs text-muted-foreground">
                    Mensalidade · Vencimento dia {item.mensalista?.dia_vencimento_mensal}
                  </p>
                )}
              </div>
            </div>

            {/* Action button */}
            <div className="mt-3">
              {item.type === 'lancamento' ? (
                <Button
                  className="w-full h-12 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={gerando === item.id}
                  onClick={() => handleGerarExtrato(item)}
                >
                  {gerando === item.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><FileText className="h-4 w-4" /> Gerar Extrato</>
                  )}
                </Button>
              ) : (
                <Button
                  className="w-full h-12 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={gerandoFatura === item.id}
                  onClick={() => handleGerarFatura(item)}
                >
                  {gerandoFatura === item.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                  ) : (
                    <><Receipt className="h-4 w-4" /> Gerar Fatura</>
                  )}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-center text-muted-foreground">
        {visibleItems.length} item{visibleItems.length !== 1 ? 's' : ''} para cobrar
      </p>
    </div>
  );
}
