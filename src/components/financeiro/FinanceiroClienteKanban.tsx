import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle, FileText, Send, Clock, CheckCircle2,
  ChevronDown, ChevronUp, Eye, Trash2, RefreshCw,
} from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_ORDER, ETAPA_FINANCEIRO_LABELS, ETAPA_FINANCEIRO_COLORS, TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useMoveEtapaFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useExtratos } from '@/hooks/useExtratos';
import { formatBRL } from '@/lib/pricing-engine';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { cn } from '@/lib/utils';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import ProcessoEditModal from './ProcessoEditModal';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ClienteGroup {
  clienteId: string;
  clienteNome: string;
  clienteApelido: string;
  etapa: EtapaFinanceiro;
  processos: ProcessoFinanceiro[];
  totalValor: number;
  vencimentoMaisProximo: string | null;
  temExtrato: boolean;
  momentoFaturamento: string;
}

function getClienteEtapa(processos: ProcessoFinanceiro[]): EtapaFinanceiro {
  // The "worst" (earliest) etapa determines the client's stage
  const etapas = processos.map(p => p.etapa_financeiro);
  for (const etapa of ETAPA_FINANCEIRO_ORDER) {
    if (etapas.includes(etapa)) return etapa;
  }
  return 'solicitacao_criada';
}

interface FinanceiroClienteKanbanProps {
  processos: ProcessoFinanceiro[];
}

export default function FinanceiroClienteKanban({ processos }: FinanceiroClienteKanbanProps) {
  const moveEtapa = useMoveEtapaFinanceiro();
  const [expandedClientes, setExpandedClientes] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: string; group: ClienteGroup } | null>(null);
  const [editProcesso, setEditProcesso] = useState<ProcessoFinanceiro | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);

  // Group processos by client
  const clienteGroups = useMemo(() => {
    const map = new Map<string, ProcessoFinanceiro[]>();
    processos.forEach(p => {
      const key = p.cliente_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    });

    const groups: ClienteGroup[] = [];
    map.forEach((procs, clienteId) => {
      const cliente = procs[0].cliente as any;
      const totalValor = procs.reduce((s, p) => {
        const lancVal = Number(p.lancamento?.valor ?? p.valor ?? 0);
        const extra = Number(p.lancamento?.honorario_extra ?? 0);
        return s + lancVal + extra;
      }, 0);
      const vencimentos = procs
        .map(p => p.lancamento?.data_vencimento)
        .filter(Boolean)
        .sort();

      groups.push({
        clienteId,
        clienteNome: cliente?.nome || '-',
        clienteApelido: cliente?.apelido || cliente?.nome || '-',
        etapa: getClienteEtapa(procs),
        processos: procs,
        totalValor,
        vencimentoMaisProximo: vencimentos[0] || null,
        temExtrato: procs.some(p => !!(p.lancamento as any)?.extrato_id),
        momentoFaturamento: cliente?.momento_faturamento || 'na_solicitacao',
      });
    });

    return groups;
  }, [processos]);

  const toggleExpand = (clienteId: string) => {
    const next = new Set(expandedClientes);
    if (next.has(clienteId)) next.delete(clienteId);
    else next.add(clienteId);
    setExpandedClientes(next);
  };

  // FATURAR: generate extrato for all processos of this client in solicitacao_criada
  const handleFaturar = async (group: ClienteGroup) => {
    setGenerating(group.clienteId);
    try {
      const procsToGenerate = group.processos.filter(p => p.etapa_financeiro === 'solicitacao_criada');
      if (procsToGenerate.length === 0) {
        toast.warning('Nenhum processo pendente de faturamento.');
        return;
      }

      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', group.clienteId)
        .single();

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(procsToGenerate.map(p => p.id)),
        fetchCompetenciaProcessos(group.clienteId),
      ]);

      const result = await gerarExtratoPDF({
        processos: procsToGenerate,
        allCompetencia,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      const filename = `extrato_${(clienteData as any)?.apelido || group.clienteApelido}_${new Date().toISOString().split('T')[0]}.pdf`.replace(/\s+/g, '_');

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save to system
      const now = new Date();
      const path = `extratos/${group.clienteId}/${filename}`;
      await supabase.storage.from('documentos').upload(path, blob, { contentType: 'application/pdf', upsert: true });
      const { data: urlData } = supabase.storage.from('documentos').getPublicUrl(path);

      const { data: extrato } = await supabase
        .from('extratos' as any)
        .insert({
          cliente_id: group.clienteId,
          pdf_url: urlData.publicUrl,
          filename,
          total_honorarios: result.totalHonorarios,
          total_taxas: result.totalTaxas,
          total_geral: result.totalGeral,
          qtd_processos: procsToGenerate.length,
          processo_ids: procsToGenerate.map(p => p.id),
          competencia_mes: now.getMonth() + 1,
          competencia_ano: now.getFullYear(),
          status: 'ativo',
        } as any)
        .select()
        .single();

      // Move all processos to cobranca_gerada
      for (const p of procsToGenerate) {
        if (p.lancamento) {
          await supabase.from('lancamentos').update({
            etapa_financeiro: 'cobranca_gerada',
            extrato_id: (extrato as any)?.id || null,
            observacoes_financeiro: `Extrato emitido em ${now.toLocaleDateString('pt-BR')}`,
            updated_at: now.toISOString(),
          } as any).eq('id', p.lancamento.id);
        }
      }

      toast.success('Extrato gerado e salvo! Processos movidos para "Enviar".');
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(null);
    }
  };

  // ENVIAR: copy WhatsApp message and mark as sent
  const handleEnviar = async (group: ClienteGroup) => {
    const cliente = group.processos[0].cliente as any;
    const msg = gerarMensagemCobranca({
      clienteNome: group.clienteApelido,
      totalValor: group.totalValor,
      processos: group.processos.map(p => ({
        razaoSocial: p.razao_social,
        tipo: TIPO_PROCESSO_LABELS[p.tipo] || p.tipo,
        valor: Number(p.lancamento?.valor ?? p.valor ?? 0),
      })),
      vencimento: group.vencimentoMaisProximo,
    });

    await navigator.clipboard.writeText(msg);
    toast.success('Mensagem copiada! Cole no WhatsApp.');

    // Mark as cobranca_enviada
    for (const p of group.processos.filter(p => p.etapa_financeiro === 'cobranca_gerada')) {
      if (p.lancamento) {
        await supabase.from('lancamentos').update({
          etapa_financeiro: 'cobranca_enviada',
          cobranca_encaminhada: true,
          updated_at: new Date().toISOString(),
        } as any).eq('id', p.lancamento.id);
      }
    }

    // Mark extratos as enviado
    await supabase
      .from('extratos' as any)
      .update({ enviado: true, data_envio: new Date().toISOString() } as any)
      .eq('cliente_id', group.clienteId)
      .eq('status', 'ativo')
      .eq('enviado', false);

    toast.success('Marcado como enviado!');
  };

  // PAGO: request password then mark all as paid
  const handleMarcarPago = (group: ClienteGroup) => {
    setPendingAction({ type: 'pago', group });
    setPasswordOpen(true);
  };

  const handlePasswordConfirm = async () => {
    if (!pendingAction) return;
    const { group } = pendingAction;
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    for (const p of group.processos) {
      if (p.lancamento && p.etapa_financeiro !== 'honorario_pago') {
        await supabase.from('lancamentos').update({
          etapa_financeiro: 'honorario_pago',
          status: 'pago',
          data_pagamento: today,
          confirmado_recebimento: true,
          updated_at: now,
        } as any).eq('id', p.lancamento.id);
      }
    }

    toast.success(`${group.clienteApelido} marcado como pago!`);
    setPendingAction(null);
  };

  // Preview extrato
  const handlePreviewExtrato = async (clienteId: string) => {
    const { data } = await supabase
      .from('extratos' as any)
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('status', 'ativo')
      .order('created_at', { ascending: false })
      .limit(1);

    const extrato = (data as any)?.[0];
    if (!extrato) { toast.info('Nenhum extrato encontrado.'); return; }

    try {
      const storagePath = `extratos/${clienteId}/${extrato.filename}`;
      const { data: fileData, error } = await supabase.storage.from('documentos').download(storagePath);
      if (error || !fileData) { toast.error('Erro ao carregar extrato.'); return; }
      const blobUrl = URL.createObjectURL(fileData);
      setPreviewUrl(blobUrl);
      setPreviewFilename(extrato.filename);
    } catch { toast.error('Erro ao abrir extrato.'); }
  };

  const columns = ETAPA_FINANCEIRO_ORDER.map(etapa => ({
    etapa,
    label: ETAPA_FINANCEIRO_LABELS[etapa],
    color: ETAPA_FINANCEIRO_COLORS[etapa],
    groups: clienteGroups.filter(g => g.etapa === etapa),
  }));

  const COLUMN_ICONS: Record<EtapaFinanceiro, React.ReactNode> = {
    solicitacao_criada: <FileText className="h-3.5 w-3.5" />,
    cobranca_gerada: <Send className="h-3.5 w-3.5" />,
    cobranca_enviada: <Clock className="h-3.5 w-3.5" />,
    honorario_pago: <CheckCircle2 className="h-3.5 w-3.5" />,
    honorario_vencido: <AlertTriangle className="h-3.5 w-3.5 text-destructive" />,
  };

  return (
    <>
      <div className="w-full overflow-x-auto pb-4 scrollbar-thin">
        <div className="flex min-w-max gap-3">
          {columns.map(col => (
            <div key={col.etapa} className="flex-1 min-w-[280px] flex flex-col" style={{ minHeight: '70vh' }}>
              <div className={cn('rounded-t-lg border-t-4 bg-card p-3 mb-2 h-14 flex items-center', col.color)}>
                <div className="flex items-center justify-between w-full">
                  <h3 className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                    {COLUMN_ICONS[col.etapa]}
                    {col.label}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                      {col.groups.length}
                    </span>
                    {col.groups.length > 0 && (
                      <span className="text-[10px] font-medium text-primary">
                        {formatBRL(col.groups.reduce((s, g) => s + g.totalValor, 0))}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-2 pb-8">
                  {col.groups.map(group => {
                    const isExpanded = expandedClientes.has(group.clienteId);
                    const isGenerating = generating === group.clienteId;
                    const isVencido = group.etapa === 'honorario_vencido';
                    const isDeferimento = group.momentoFaturamento === 'no_deferimento';

                    return (
                      <Card
                        key={group.clienteId}
                        className={cn(
                          'border-l-4 transition-all hover:shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)]',
                          isVencido ? 'border-l-destructive bg-destructive/5' :
                          group.etapa === 'honorario_pago' ? 'border-l-success' :
                          'border-l-primary',
                        )}
                      >
                        <CardContent className="p-3 space-y-2">
                          {/* Header */}
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(group.clienteId)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                {isVencido && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                <p className="text-sm font-bold truncate text-foreground">{group.clienteApelido}</p>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  {group.processos.length} processo{group.processos.length > 1 ? 's' : ''}
                                </span>
                                {isDeferimento && (
                                  <Badge variant="outline" className="text-[9px] border-info text-info">Deferimento</Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{formatBRL(group.totalValor)}</span>
                              {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {/* Vencimento */}
                          {group.vencimentoMaisProximo && (
                            <div className={cn('text-[10px] px-2 py-0.5 rounded w-fit', isVencido ? 'bg-destructive/10 text-destructive' : 'bg-muted/50 text-muted-foreground')}>
                              Venc: {new Date(group.vencimentoMaisProximo).toLocaleDateString('pt-BR')}
                            </div>
                          )}

                          {/* Expanded: show processos */}
                          {isExpanded && (
                            <div className="space-y-1.5 pt-1 border-t border-border/30">
                              {group.processos.map(p => (
                                <div
                                  key={p.id}
                                  className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer"
                                  onDoubleClick={() => { setEditProcesso(p); setEditModalOpen(true); }}
                                >
                                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                    <span className="font-medium truncate">{p.razao_social}</span>
                                    <Badge variant="outline" className="text-[8px] shrink-0">
                                      {TIPO_PROCESSO_LABELS[p.tipo] || p.tipo}
                                    </Badge>
                                  </div>
                                  <span className="font-semibold shrink-0 ml-2">
                                    {formatBRL(Number(p.lancamento?.valor ?? p.valor ?? 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions per stage */}
                          <div className="flex gap-1.5 pt-1">
                            {group.etapa === 'solicitacao_criada' && (
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-[11px] gap-1"
                                onClick={() => handleFaturar(group)}
                                disabled={isGenerating}
                              >
                                <FileText className="h-3 w-3" />
                                {isGenerating ? 'Gerando...' : 'Gerar Extrato'}
                              </Button>
                            )}

                            {group.etapa === 'cobranca_gerada' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[11px] gap-1"
                                  onClick={() => handlePreviewExtrato(group.clienteId)}
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-[11px] gap-1"
                                  onClick={() => handleEnviar(group)}
                                >
                                  <Send className="h-3 w-3" />
                                  Enviar Cobrança
                                </Button>
                              </>
                            )}

                            {group.etapa === 'cobranca_enviada' && (
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-[11px] gap-1 bg-success hover:bg-success/90"
                                onClick={() => handleMarcarPago(group)}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Marcar Pago
                              </Button>
                            )}

                            {group.etapa === 'honorario_vencido' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 h-7 text-[11px] gap-1 border-destructive text-destructive"
                                  onClick={() => handleEnviar(group)}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Recobrar
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 h-7 text-[11px] gap-1 bg-success hover:bg-success/90"
                                  onClick={() => handleMarcarPago(group)}
                                >
                                  <CheckCircle2 className="h-3 w-3" />
                                  Pago
                                </Button>
                              </>
                            )}

                            {group.etapa === 'honorario_pago' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-7 text-[11px] gap-1 text-muted-foreground"
                                onClick={() => handlePreviewExtrato(group.clienteId)}
                              >
                                <Eye className="h-3 w-3" />
                                Ver Extrato
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {col.groups.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum cliente</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <PasswordConfirmDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onConfirm={handlePasswordConfirm}
        title="Confirmar Pagamento"
        description="Insira a senha master para marcar todos os processos deste cliente como pagos."
      />

      <ProcessoEditModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        processo={editProcesso}
      />

      {/* PDF Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={(open) => {
        if (!open) {
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-4xl h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{previewFilename}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 p-4 pt-2">
            {previewUrl && (
              <iframe src={previewUrl} className="w-full h-full rounded-lg border" title="Preview do Extrato" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
