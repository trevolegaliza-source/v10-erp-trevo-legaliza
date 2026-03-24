import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, FileText } from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_LABELS, STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { gerarExtratoPDF, fetchValoresAdicionaisMulti, fetchCompetenciaProcessos } from '@/lib/extrato-pdf';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import ProcessoEditModal from './ProcessoEditModal';

interface FinanceiroListProps {
  processos: ProcessoFinanceiro[];
}

export default function FinanceiroList({ processos }: FinanceiroListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showMarkDialog, setShowMarkDialog] = useState(false);
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null);
  const qc = useQueryClient();

  const allChecked = processos.length > 0 && selected.size === processos.length;

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(processos.map(p => p.id)));
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function handleGerarExtrato() {
    const selectedProcessos = processos.filter(p => selected.has(p.id));
    if (selectedProcessos.length === 0) {
      toast.warning('Selecione ao menos um processo.');
      return;
    }

    // Validate same client
    const clienteIds = new Set(selectedProcessos.map(p => p.cliente_id));
    if (clienteIds.size > 1) {
      toast.error('Apenas processos do mesmo cliente podem compor um extrato único.');
      return;
    }

    setGenerating(true);
    try {
      const clienteId = selectedProcessos[0].cliente_id;
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('nome, cnpj, apelido, valor_base, desconto_progressivo, valor_limite_desconto')
        .eq('id', clienteId)
        .single();

      const [valoresAdicionais, allCompetencia] = await Promise.all([
        fetchValoresAdicionaisMulti(selectedProcessos.map(p => p.id)),
        fetchCompetenciaProcessos(clienteId),
      ]);

      const doc = await gerarExtratoPDF({
        processos: selectedProcessos,
        allCompetencia,
        valoresAdicionais,
        cliente: clienteData as any,
      });

      const blob = doc.output('blob');
      setLastPdfBlob(blob);

      // Download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const clienteName = (clienteData as any)?.apelido || (clienteData as any)?.nome || 'extrato';
      a.download = `extrato_${clienteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('Extrato gerado com sucesso!');
      setShowMarkDialog(true);
    } catch (err: any) {
      toast.error('Erro ao gerar extrato: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarcarFaturado() {
    const selectedProcessos = processos.filter(p => selected.has(p.id));
    const now = new Date().toISOString();
    const dateStr = new Date().toLocaleDateString('pt-BR');

    try {
      for (const p of selectedProcessos) {
        if (p.lancamento) {
          await supabase
            .from('lancamentos')
            .update({
              etapa_financeiro: 'cobranca_gerada',
              observacoes_financeiro: `Extrato emitido em ${dateStr}`,
              updated_at: now,
            })
            .eq('id', p.lancamento.id);
        }
      }

      qc.invalidateQueries({ queryKey: ['processos_financeiro'] });
      qc.invalidateQueries({ queryKey: ['financeiro_dashboard'] });
      toast.success('Processos marcados como faturados!');
      setSelected(new Set());
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setShowMarkDialog(false);
  }

  return (
    <div className="space-y-3">
      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">
            {selected.size} processo{selected.size > 1 ? 's' : ''} selecionado{selected.size > 1 ? 's' : ''}
          </span>
          <Button
            size="sm"
            onClick={handleGerarExtrato}
            disabled={generating}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            {generating ? 'Gerando...' : 'Gerar Extrato de Cobrança'}
          </Button>
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left">
              <th className="px-3 py-2.5 w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Cliente</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Razão Social</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Valor</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Vencimento</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Etapa</th>
              <th className="px-4 py-2.5 text-xs font-semibold text-zinc-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {processos.map((p) => {
              const isOverdue = p.etapa_financeiro === 'honorario_vencido';
              const lanc = p.lancamento;
              const total = Number(lanc?.valor ?? p.valor ?? 0) + Number(lanc?.honorario_extra || 0);
              const status = (lanc?.status || 'pendente') as StatusFinanceiro;
              return (
                <tr key={p.id} className={cn('border-t border-border/30', isOverdue && 'bg-destructive/5')}>
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggle(p.id)}
                    />
                  </td>
                  <td className="px-4 py-2.5 font-medium text-zinc-100 flex items-center gap-1.5">
                    {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    {(p.cliente as any)?.apelido || (p.cliente as any)?.nome || '-'}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300 truncate max-w-[200px]">{p.razao_social}</td>
                  <td className="px-4 py-2.5 font-semibold text-zinc-100">
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-300">
                    {lanc?.data_vencimento ? new Date(lanc.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className="text-[10px]">
                      {ETAPA_FINANCEIRO_LABELS[p.etapa_financeiro]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge className={cn(STATUS_STYLES[status], 'border-0 text-[10px]')}>
                      {STATUS_LABELS[status]}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {processos.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum processo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mark as billed dialog */}
      <AlertDialog open={showMarkDialog} onOpenChange={setShowMarkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Extrato gerado com sucesso!</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja marcar os {selected.size} processo(s) selecionado(s) como "Faturado"?
              Isso registrará a data de emissão e atualizará a etapa financeira.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não, manter</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarcarFaturado}>
              Marcar como Faturado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
