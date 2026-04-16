import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Receipt, Loader2, CheckCircle, Zap } from 'lucide-react';
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

interface CobrarHojeCliente {
  clienteId: string;
  clienteNome: string;
  clienteApelido: string | null;
  cliente: ClienteFinanceiro | null;
  lancamentos: LancamentoFinanceiro[]; // only auditado === true
  mensalista: MensalistaSemFatura | null;
  isMensalistaOnly: boolean;
  totalValor: number;
  qtdProcessos: number;
  statusHumano: string;
  corBadge: string;
  sortLayer: number;
  sortSecondary: number;
  maiorAtraso: number;
  dataVencimento: Date;
}

function diffDays(from: Date, to: Date): number {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// Status hierarchy: most critical wins
function computeGroupStatus(maiorAtraso: number, menorDiasAteVencer: number, isDeferimento: boolean, isMensalista: boolean): { texto: string; badge: string; layer: number } {
  // Mensalista overdue
  if (isMensalista && maiorAtraso > 0) {
    return { texto: `Fatura mensal — venceu há ${maiorAtraso} dia${maiorAtraso > 1 ? 's' : ''} 🔴`, badge: 'bg-red-500/15 text-red-500 border-red-500/30', layer: 1 };
  }
  // Vencido > 5 dias — URGENTE
  if (maiorAtraso > 5) {
    return { texto: `Venceu há ${maiorAtraso} dias — URGENTE 🔴`, badge: 'bg-red-600/20 text-red-600 border-red-600/40', layer: 1 };
  }
  // Vencido ≤ 5 dias
  if (maiorAtraso > 0) {
    return { texto: `Venceu há ${maiorAtraso} dia${maiorAtraso > 1 ? 's' : ''} — cobrar agora 🔴`, badge: 'bg-red-500/15 text-red-500 border-red-500/30', layer: 1 };
  }
  // Vence hoje
  if (menorDiasAteVencer === 0) {
    return { texto: 'Vence hoje — enviar cobrança 🟡', badge: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30', layer: 2 };
  }
  // Vence em 1-3 dias
  if (menorDiasAteVencer <= 3) {
    return { texto: `Vence em ${menorDiasAteVencer} dia${menorDiasAteVencer > 1 ? 's' : ''}`, badge: 'bg-amber-500/15 text-amber-600 border-amber-500/30', layer: 3 };
  }
  // Deferimento liberado
  if (isDeferimento) {
    return { texto: 'Deferido ✅ — gerar cobrança 🟢', badge: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30', layer: 4 };
  }
  // Mensalista na janela
  if (isMensalista) {
    return { texto: `Fatura mensal — gerar cobrança 🔵`, badge: 'bg-blue-500/15 text-blue-500 border-blue-500/30', layer: 5 };
  }
  // A vencer 4-7 dias
  return { texto: `Vence em ${menorDiasAteVencer} dias`, badge: 'bg-muted text-muted-foreground border-border', layer: 6 };
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

  // Group by client — ONLY auditado === true lancamentos
  const groups = useMemo<CobrarHojeCliente[]>(() => {
    const map = new Map<string, CobrarHojeCliente>();

    for (const c of clientesCobrar) {
      // Filter to audited-only lancamentos
      const auditados = c.lancamentos.filter(l => l.auditado === true);
      if (auditados.length === 0) continue; // skip client entirely if no audited processes

      if (!map.has(c.cliente_id)) {
        map.set(c.cliente_id, {
          clienteId: c.cliente_id,
          clienteNome: c.cliente_nome,
          clienteApelido: c.cliente_apelido,
          cliente: c,
          lancamentos: [],
          mensalista: null,
          isMensalistaOnly: false,
          totalValor: 0,
          qtdProcessos: 0,
          statusHumano: '',
          corBadge: '',
          sortLayer: 99,
          sortSecondary: 0,
          maiorAtraso: 0,
          dataVencimento: new Date(),
        });
      }
      const group = map.get(c.cliente_id)!;
      for (const l of auditados) {
        group.lancamentos.push(l);
        const totalVA = l.total_valores_adicionais || 0;
        group.totalValor += l.valor + totalVA;
        group.qtdProcessos++;

        const venc = new Date(l.data_vencimento + 'T00:00:00');
        const diff = diffDays(venc, hoje);
        const atraso = Math.max(0, diff);
        if (atraso > group.maiorAtraso) {
          group.maiorAtraso = atraso;
          group.dataVencimento = venc;
        }
      }
    }

    // Add mensalistas sem fatura
    for (const m of mensalistasSemFatura) {
      const dia = m.dia_vencimento_mensal || 10;
      const now = new Date();
      const vencDate = new Date(now.getFullYear(), now.getMonth(), dia);
      const diff = diffDays(vencDate, hoje);
      const atraso = Math.max(0, diff);
      const ateVencer = Math.max(0, -diff);

      if (atraso === 0 && ateVencer > 5) continue;

      if (map.has(m.id)) {
        const group = map.get(m.id)!;
        group.mensalista = m;
      } else {
        map.set(m.id, {
          clienteId: m.id,
          clienteNome: m.nome,
          clienteApelido: m.apelido,
          cliente: null,
          lancamentos: [],
          mensalista: m,
          isMensalistaOnly: true,
          totalValor: m.valor_base,
          qtdProcessos: 0,
          statusHumano: '',
          corBadge: '',
          sortLayer: 99,
          sortSecondary: 0,
          maiorAtraso: atraso,
          dataVencimento: vencDate,
        });
      }
    }

    // Compute status for each group — most critical lancamento wins
    const result: CobrarHojeCliente[] = [];
    for (const group of map.values()) {
      const isDef = group.cliente?.cliente_momento_faturamento === 'no_deferimento' && group.lancamentos.some(l => ['baixa', 'avulso'].includes(l.processo_tipo));

      // Find the most critical status among all lancamentos
      let worstAtraso = group.maiorAtraso;
      let bestAteVencer = Infinity;

      for (const l of group.lancamentos) {
        const venc = new Date(l.data_vencimento + 'T00:00:00');
        const diff = diffDays(venc, hoje);
        const atraso = Math.max(0, diff);
        const ateVencer = Math.max(0, -diff);
        if (atraso > worstAtraso) worstAtraso = atraso;
        if (ateVencer < bestAteVencer) bestAteVencer = ateVencer;
      }

      if (bestAteVencer === Infinity) {
        bestAteVencer = Math.max(0, -diffDays(group.dataVencimento, hoje));
      }

      const status = computeGroupStatus(worstAtraso, bestAteVencer, isDef, group.isMensalistaOnly);
      group.statusHumano = status.texto;
      group.corBadge = status.badge;
      group.sortLayer = status.layer;
      group.sortSecondary = worstAtraso > 0 ? -worstAtraso * 1000000 - group.totalValor : bestAteVencer * 1000000 - group.totalValor;
      result.push(group);
    }

    result.sort((a, b) => {
      if (a.sortLayer !== b.sortLayer) return a.sortLayer - b.sortLayer;
      return a.sortSecondary - b.sortSecondary;
    });

    return result;
  }, [clientesCobrar, mensalistasSemFatura, hoje]);

  // Totals
  const totalCobrar = useMemo(() => groups.reduce((s, g) => s + g.totalValor, 0), [groups]);
  const totalVencido = useMemo(() => groups.filter(g => g.maiorAtraso > 0).reduce((s, g) => s + g.totalValor, 0), [groups]);
  const totalSemana = useMemo(() => groups.filter(g => g.maiorAtraso === 0).reduce((s, g) => s + g.totalValor, 0), [groups]);

  // ── Gerar Extrato consolidado por cliente ──
  const handleGerarExtrato = useCallback(async (group: CobrarHojeCliente) => {
    if (!group.cliente || group.lancamentos.length === 0) return;
    setGerando(group.clienteId);
    const c = group.cliente;
    const lancamentos = group.lancamentos;

    try {
      const processoIds = lancamentos.map(l => l.processo_id).filter(Boolean) as string[];
      const clienteId = c.cliente_id;
      const clienteNome = c.cliente_apelido || c.cliente_nome;

      const [clienteData, vaMulti, allComp] = await Promise.all([
        supabase.from('clientes').select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, telefone_financeiro, email, nome_contador, dia_cobranca, dia_vencimento_mensal').eq('id', clienteId).single().then(r => r.data),
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(clienteId, lancamentos.map(l => ({
          id: l.processo_id || l.id,
          created_at: l.processo_created_at || new Date().toISOString(),
        })) as any),
      ]);

      const processos = lancamentos.map(l => ({
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
      }));

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

      // Link ALL lancamentos to extrato
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

      toast.success(`Extrato gerado! ${processoIds.length} processo${processoIds.length > 1 ? 's' : ''} incluído${processoIds.length > 1 ? 's' : ''}.`);

      onExtratoGerado({
        blob: pdfBlob,
        filename,
        clienteId,
        clienteNome,
        clienteTelefone: (clienteData as any)?.telefone_financeiro || (clienteData as any)?.telefone || c.cliente_telefone || '',
        total: result.totalGeral,
        lancamentos,
        cleanup: () => {
          setGerando(null);
          setFadingOut(prev => new Set(prev).add(group.clienteId));
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
  const handleGerarFatura = useCallback(async (group: CobrarHojeCliente) => {
    if (!group.mensalista) return;
    const m = group.mensalista;
    setGerandoFatura(group.clienteId);
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

  const visibleGroups = groups.filter(g => !fadingOut.has(g.clienteId));

  if (visibleGroups.length === 0 && aguardandoDeferimentoValor === 0) {
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

      {/* ── Cards agrupados por cliente ── */}
      <div className="space-y-3">
        {visibleGroups.map(group => {
          // Card border color = most critical status
          const isUrgent = group.maiorAtraso > 5;
          const isOverdue = group.maiorAtraso > 0 && group.maiorAtraso <= 5;
          const isDueToday = group.maiorAtraso === 0 && group.lancamentos.some(l => {
            const venc = new Date(l.data_vencimento + 'T00:00:00');
            return diffDays(venc, hoje) === 0;
          });

          return (
            <div
              key={group.clienteId}
              className={cn(
                'rounded-lg border bg-card p-4 transition-all duration-500',
                fadingOut.has(group.clienteId) && 'opacity-0 scale-95 pointer-events-none',
                isUrgent && 'border-red-500/40 bg-red-500/5',
                isOverdue && 'border-red-500/20 bg-red-500/[0.02]',
                isDueToday && 'border-yellow-500/30 bg-yellow-500/[0.02]',
              )}
            >
              <div className="space-y-2">
                {/* Client name + count */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">
                      {group.clienteApelido || group.clienteNome}
                    </p>
                    {group.qtdProcessos > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {group.qtdProcessos} processo{group.qtdProcessos > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <p className="text-xl font-bold text-foreground shrink-0">
                    {formatBRL(group.totalValor)}
                  </p>
                </div>

                {/* Status badge — most critical */}
                <Badge variant="outline" className={cn('text-xs', group.corBadge)}>
                  {group.statusHumano}
                </Badge>

                {/* Process list summary — only audited ones */}
                {group.lancamentos.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/40 pt-2 mt-1">
                    {group.lancamentos.slice(0, 5).map(l => (
                      <div key={l.id} className="flex items-center justify-between gap-2">
                        <span className="truncate flex-1">
                          {TIPO_PROCESSO_LABELS[l.processo_tipo as keyof typeof TIPO_PROCESSO_LABELS] || l.processo_tipo}
                          {' — '}
                          {l.processo_razao_social}
                        </span>
                        <span className="shrink-0 font-medium">{formatBRL(l.valor + (l.total_valores_adicionais || 0))}</span>
                      </div>
                    ))}
                    {group.lancamentos.length > 5 && (
                      <p className="text-muted-foreground/60">+ {group.lancamentos.length - 5} mais...</p>
                    )}
                  </div>
                )}

                {/* Mensalista info */}
                {group.isMensalistaOnly && group.mensalista && (
                  <p className="text-xs text-muted-foreground">
                    Mensalidade · Vencimento dia {group.mensalista.dia_vencimento_mensal}
                  </p>
                )}
              </div>

              {/* Action button */}
              <div className="mt-3">
                {group.isMensalistaOnly ? (
                  <Button
                    className="w-full h-12 text-sm gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={gerandoFatura === group.clienteId}
                    onClick={() => handleGerarFatura(group)}
                  >
                    {gerandoFatura === group.clienteId ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                    ) : (
                      <><Receipt className="h-4 w-4" /> Gerar Fatura</>
                    )}
                  </Button>
                ) : (
                  <Button
                    className="w-full h-12 text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={gerando === group.clienteId}
                    onClick={() => handleGerarExtrato(group)}
                  >
                    {gerando === group.clienteId ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                    ) : (
                      <><FileText className="h-4 w-4" /> Gerar Extrato ({group.qtdProcessos} proc.)</>
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-xs text-center text-muted-foreground">
        {visibleGroups.length} cliente{visibleGroups.length !== 1 ? 's' : ''} para cobrar
      </p>
    </div>
  );
}
