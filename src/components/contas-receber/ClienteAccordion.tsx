import { useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle, Phone, Building2, FileText, FileCheck, Download, Trash, Plus } from 'lucide-react';
import type { LancamentoReceber, ValorAdicionalSimple } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';
import { supabase } from '@/integrations/supabase/client';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useExtratos, buscarExtratoPorId } from '@/hooks/useExtratos';
import { toast } from 'sonner';
import { ExtratoPreviewDialog } from '@/components/financeiro/ExtratoPreviewDialog';
import { downloadStorageFile } from '@/lib/storage-utils';

interface ClienteGroup {
  clienteId: string;
  clienteNome: string;
  lancamentos: LancamentoReceber[];
}

interface Props {
  groups: ClienteGroup[];
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
  onMarcarPago: (l: LancamentoReceber) => void;
  onCobrar: (l: LancamentoReceber) => void;
  onNovoProcesso?: (clienteId: string) => void;
}

function StatusBadge({ status, dataVencimento }: { status: string; dataVencimento: string }) {
  const dias = diasAtraso(dataVencimento, status);
  if (status === 'pago') return <Badge className="bg-success/15 text-success border-0 text-[10px]">Pago ✅</Badge>;
  if (dias > 0) return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido 🔴</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente ⏳</Badge>;
}

function DiasAtrasoBadge({ dataVencimento, status }: { dataVencimento: string; status: string }) {
  if (status === 'pago') return <span className="text-xs text-muted-foreground">—</span>;
  const dias = diasAtraso(dataVencimento, status);
  if (dias === 0) return <span className="text-xs text-success">em dia</span>;
  return <span className="text-xs text-destructive font-medium">-{dias}d</span>;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ClienteAccordionItem({
  g, taxasPorProcesso, onMarcarPago, onCobrar, onNovoProcesso,
}: {
  g: ClienteGroup;
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
  onMarcarPago: (l: LancamentoReceber) => void;
  onCobrar: (l: LancamentoReceber) => void;
  onNovoProcesso?: (clienteId: string) => void;
}) {
  const [selectedProcessos, setSelectedProcessos] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('');
  const { salvarExtrato, excluirExtrato } = useExtratos(g.clienteId);

  const hoje = new Date().toISOString().split('T')[0];
  const faturado = g.lancamentos.reduce((s, l) => s + Number(l.valor), 0);
  const recebido = g.lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const saldo = faturado - recebido;
  const vencidos = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);
  const pendentes = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento >= hoje);
  const hasVencido = vencidos.length > 0;
  const hasPendente = pendentes.length > 0;
  const borderColor = hasVencido ? 'border-l-destructive' : hasPendente ? 'border-l-warning' : 'border-l-success';

  // Extrato indicators
  const lancamentosComExtrato = g.lancamentos.filter(l => (l as any).extrato_id);
  const lancamentosSemExtrato = g.lancamentos.filter(l => l.status === 'pendente' && !(l as any).extrato_id);
  const todosComExtrato = lancamentosSemExtrato.length === 0 && g.lancamentos.some(l => l.status === 'pendente');

  const toggleProcesso = (processoId: string | null) => {
    if (!processoId) return;
    const next = new Set(selectedProcessos);
    if (next.has(processoId)) next.delete(processoId);
    else next.add(processoId);
    setSelectedProcessos(next);
  };

  const handleGerarExtrato = async () => {
    if (selectedProcessos.size === 0) return;
    setGenerating(true);
    try {
      const clienteId = g.clienteId;
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto, telefone, email, nome_contador, dia_cobranca, dia_vencimento_mensal')
        .eq('id', clienteId)
        .single();

      // Fetch processos for selected IDs
      const processoIds = Array.from(selectedProcessos);
      const { data: processosData } = await supabase
        .from('processos')
        .select('*, cliente:clientes(*)')
        .in('id', processoIds);

      // Fetch lancamentos for these processos
      const { data: lancsData } = await supabase
        .from('lancamentos')
        .select('*')
        .eq('tipo', 'receber')
        .in('processo_id', processoIds);

      const lancMap = new Map<string, any>();
      (lancsData || []).forEach((l: any) => {
        if (!lancMap.has(l.processo_id)) lancMap.set(l.processo_id, l);
      });

      const processosFin: ProcessoFinanceiro[] = (processosData || []).map((p: any) => ({
        ...p,
        lancamento: lancMap.get(p.id) || null,
        etapa_financeiro: lancMap.get(p.id)?.etapa_financeiro || 'solicitacao_criada',
      }));

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(processoIds),
        fetchCompetenciaProcessos(clienteId),
      ]);

      const result = await gerarExtratoPDF({
        processos: processosFin,
        allCompetencia,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = result.doc.output('blob');
      const clienteName = (clienteData as any)?.apelido || (clienteData as any)?.nome || 'extrato';
      const filename = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      // Save to system
      const now = new Date();
      await salvarExtrato.mutateAsync({
        clienteId,
        pdfBlob: blob,
        filename,
        totalHonorarios: result.totalHonorarios,
        totalTaxas: result.totalTaxas,
        totalGeral: result.totalGeral,
        processoIds,
        competenciaMes: now.getMonth() + 1,
        competenciaAno: now.getFullYear(),
      });

      setSelectedProcessos(new Set());
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleVisualizarExtrato = async (extratoId: string) => {
    try {
      const extrato = await buscarExtratoPorId(extratoId);
      if (!extrato) {
        toast.error('Extrato não encontrado');
        return;
      }

      const storagePath = `extratos/${extrato.cliente_id}/${extrato.filename}`;
      const blobUrl = await downloadStorageFile('documentos', storagePath);

      if (!blobUrl) {
        toast.error('Erro ao carregar o extrato. Tente novamente.');
        return;
      }

      setPreviewUrl(blobUrl);
      setPreviewFilename(extrato.filename);
    } catch (err) {
      console.error('Erro ao visualizar extrato:', err);
      toast.error('Erro ao abrir o extrato.');
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!deleteTarget) return;
    await excluirExtrato.mutateAsync(deleteTarget);
    setDeleteTarget(null);
  };

  return (
    <>
      <AccordionItem value={g.clienteId} className={`border rounded-lg overflow-hidden border-l-4 ${borderColor}`}>
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <div className="flex-1 text-left space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{g.clienteNome}</span>
              {todosComExtrato && (
                <Badge className="bg-success/20 text-success border-0 text-[10px]">
                  <FileCheck className="h-3 w-3 mr-1" />
                  Extratos emitidos
                </Badge>
              )}
              {!todosComExtrato && lancamentosSemExtrato.length > 0 && (
                <Badge className="bg-warning/20 text-warning border-0 text-[10px]">
                  {lancamentosSemExtrato.length} sem extrato
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Faturado: {fmt(faturado)}</span>
              <span>Recebido: {fmt(recebido)}</span>
              <span>Saldo: {fmt(saldo)}</span>
            </div>
            <div className="flex items-center gap-3">
              {hasVencido && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">{vencidos.length} vencido{vencidos.length > 1 ? 's' : ''} ({fmt(vencidos.reduce((s, l) => s + Number(l.valor), 0))})</Badge>}
              {hasPendente && <Badge className="bg-warning/15 text-warning border-0 text-[10px]">{pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}</Badge>}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-0 pb-0">
          {/* Action bar at top */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/20">
            <span className="text-xs text-muted-foreground">Lançamentos do período</span>
            {onNovoProcesso && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onNovoProcesso(g.clienteId);
                }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Novo Processo
              </Button>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8 px-2">
                  <Checkbox
                    checked={
                      g.lancamentos.filter(l => l.processo_id).length > 0 &&
                      g.lancamentos.filter(l => l.processo_id).every(l => selectedProcessos.has(l.processo_id!))
                    }
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const next = new Set(selectedProcessos);
                        g.lancamentos.forEach(l => { if (l.processo_id) next.add(l.processo_id); });
                        setSelectedProcessos(next);
                      } else {
                        setSelectedProcessos(new Set());
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Taxas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-center">Atraso</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Extrato</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.lancamentos.map(l => {
                const taxas = l.processo_id ? (taxasPorProcesso[l.processo_id] || []) : [];
                const taxaTotal = taxas.reduce((s, t) => s + Number(t.valor), 0);
                const total = Number(l.valor) + taxaTotal;
                const extratoId = (l as any).extrato_id as string | null;
                return (
                  <TableRow key={l.id}>
                    <TableCell className="px-2">
                      {l.processo_id && (
                        <Checkbox
                          checked={selectedProcessos.has(l.processo_id)}
                          onCheckedChange={() => toggleProcesso(l.processo_id)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{l.descricao}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(Number(l.valor))}</TableCell>
                    <TableCell className="text-right text-sm">{taxaTotal > 0 ? fmt(taxaTotal) : '-'}</TableCell>
                    <TableCell className="text-right font-medium text-sm text-primary">{fmt(total)}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-center"><DiasAtrasoBadge dataVencimento={l.data_vencimento} status={l.status} /></TableCell>
                    <TableCell className="text-center"><StatusBadge status={l.status} dataVencimento={l.data_vencimento} /></TableCell>
                    <TableCell className="text-center">
                      {extratoId ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 px-1">
                              <FileCheck className="h-3.5 w-3.5 text-success" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleVisualizarExtrato(extratoId)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Visualizar PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteTarget(extratoId)}
                            >
                              <Trash className="h-4 w-4 mr-2" />
                              Excluir Extrato
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        {l.status === 'pendente' && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => onMarcarPago(l)}>
                              <CheckCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" onClick={() => onCobrar(l)}>
                              <Phone className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
            <span>Subtotal {g.clienteNome}</span>
            <span>Faturado {fmt(faturado)} | Recebido {fmt(recebido)} | Em Aberto {fmt(saldo)}</span>
          </div>

          {/* Floating action bar when processes selected */}
          {selectedProcessos.size > 0 && (
            <div className="sticky bottom-0 bg-card border-t p-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedProcessos.size} processo(s) selecionado(s)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedProcessos(new Set())}
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={handleGerarExtrato}
                  disabled={generating}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  {generating ? 'Gerando...' : `Gerar Extrato (${selectedProcessos.size})`}
                </Button>
              </div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir extrato?</AlertDialogTitle>
            <AlertDialogDescription>
              O PDF será removido do sistema e os processos vinculados voltarão ao status "Solicitação Criada".
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExclusao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExtratoPreviewDialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
        pdfBlobUrl={previewUrl}
        filename={previewFilename}
      />
    </>
  );
}

export default function ClienteAccordion({ groups, taxasPorProcesso, onMarcarPago, onCobrar, onNovoProcesso }: Props) {
  const sorted = [...groups].sort((a, b) => {
    const hoje = new Date().toISOString().split('T')[0];
    const aVencido = a.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    const bVencido = b.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    if (aVencido && !bVencido) return -1;
    if (!aVencido && bVencido) return 1;
    const aPendente = a.lancamentos.some(l => l.status === 'pendente');
    const bPendente = b.lancamentos.some(l => l.status === 'pendente');
    if (aPendente && !bPendente) return -1;
    if (!aPendente && bPendente) return 1;
    return a.clienteNome.localeCompare(b.clienteNome);
  });

  return (
    <Accordion type="multiple" className="space-y-2">
      {sorted.map(g => (
        <ClienteAccordionItem
          key={g.clienteId}
          g={g}
          taxasPorProcesso={taxasPorProcesso}
          onMarcarPago={onMarcarPago}
          onCobrar={onCobrar}
          onNovoProcesso={onNovoProcesso}
        />
      ))}
    </Accordion>
  );
}
