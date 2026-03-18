import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  AlertTriangle, FileText, Upload, CheckCircle2, Download, PlusCircle,
  ChevronLeft, ChevronRight, Eye, Info,
} from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import { ETAPA_FINANCEIRO_ORDER, ETAPA_FINANCEIRO_LABELS } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useUpdateLancamentoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useValoresAdicionais } from '@/hooks/useValoresAdicionais';
import { uploadFile, viewFile, getSignedUrl } from '@/hooks/useStorageUpload';
import { calcularPrecoProcesso, formatBRL } from '@/lib/pricing-engine';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface FinanceiroCardProps {
  processo: ProcessoFinanceiro;
  onMoveRequest: (processo: ProcessoFinanceiro, targetEtapa: EtapaFinanceiro) => void;
  onDoubleClick?: (processo: ProcessoFinanceiro) => void;
}

export default function FinanceiroCard({ processo, onMoveRequest, onDoubleClick }: FinanceiroCardProps) {
  const updateLanc = useUpdateLancamentoFinanceiro();
  const lanc = processo.lancamento;

  const [notes, setNotes] = useState(lanc?.observacoes_financeiro || '');
  const [valoresOpen, setValoresOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const boletoRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);

  const { data: valoresAdicionais = [] } = useValoresAdicionais(processo.id);
  const somaAdicionais = valoresAdicionais.reduce((s, i) => s + Number(i.valor), 0);

  const isOverdue = processo.etapa_financeiro === 'honorario_vencido';
  const isUrgente = processo.prioridade === 'urgente';
  const cliente = processo.cliente as any;

  // Use pricing engine for calculation
  const calculo = calcularPrecoProcesso({
    cliente: cliente ? {
      tipo: cliente.tipo || 'AVULSO_4D',
      valor_base: cliente.valor_base,
      desconto_progressivo: cliente.desconto_progressivo,
      valor_limite_desconto: cliente.valor_limite_desconto,
      mensalidade: cliente.mensalidade,
      qtd_processos: cliente.qtd_processos,
    } : null,
    baseOverride: Number(lanc?.valor ?? processo.valor ?? 0),
    processosNoMes: 0, // Already calculated server-side
    isUrgente: false, // Already applied to base value
    somaAdicionais,
  });

  const totalValue = calculo.totalFinal;
  const clienteApelido = cliente?.apelido || cliente?.nome || '-';
  const vencimento = lanc?.data_vencimento;

  const mutateField = (updates: Record<string, any>) => {
    updateLanc.mutate({
      processoId: processo.id,
      lancamentoId: lanc?.id,
      clienteId: processo.cliente_id,
      valor: Number(lanc?.valor ?? processo.valor ?? 0),
      updates,
    });
  };

  const handleCheckbox = (field: string, checked: boolean) => {
    mutateField({ [field]: checked });
  };

  const handleNotesBlur = () => {
    if (notes !== (lanc?.observacoes_financeiro || '')) {
      mutateField({ observacoes_financeiro: notes });
    }
  };

  const handleUpload = async (field: string, file: File, folder: string) => {
    try {
      setUploading(field);
      const path = await uploadFile(file, folder, processo.id);
      mutateField({ [field]: path });
      toast.success('Arquivo enviado');
    } catch {
      // handled in uploadFile
    } finally {
      setUploading(null);
    }
  };

  const handleDownload = async (storagePath: string) => {
    const url = await getSignedUrl(storagePath);
    const a = document.createElement('a');
    a.href = url;
    a.download = storagePath.split('/').pop() || 'arquivo';
    a.target = '_blank';
    a.click();
  };

  // Navigation arrows
  const currentIdx = ETAPA_FINANCEIRO_ORDER.indexOf(processo.etapa_financeiro);
  const prevEtapa = currentIdx > 0 ? ETAPA_FINANCEIRO_ORDER[currentIdx - 1] : null;
  const nextEtapa = currentIdx < ETAPA_FINANCEIRO_ORDER.length - 1 ? ETAPA_FINANCEIRO_ORDER[currentIdx + 1] : null;

  const AttachBtn = ({
    storagePath, label, field, inputRef, folder,
  }: {
    storagePath: string | null | undefined;
    label: string;
    field: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    folder: string;
  }) => (
    <div className="flex items-center gap-1.5">
      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
      {storagePath ? (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-success" />
          <span className="text-[11px] font-medium">{label}</span>
          <button onClick={() => viewFile(storagePath)} className="text-info hover:text-info/80 p-0.5" title="Visualizar">
            <Eye className="h-3 w-3" />
          </button>
          <button onClick={() => handleDownload(storagePath)} className="text-primary hover:text-primary/80 p-0.5" title="Download">
            <Download className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading === field}
          className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <Upload className="h-3 w-3" />
          {uploading === field ? 'Enviando...' : label}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleUpload(field, f, folder);
          e.target.value = '';
        }}
      />
    </div>
  );

  return (
    <>
      <Card
        className={cn(
          'border-l-4 transition-shadow hover:shadow-md cursor-pointer',
          isOverdue ? 'border-l-destructive bg-destructive/5' : 'border-l-border',
        )}
        onDoubleClick={() => onDoubleClick?.(processo)}
      >
        <CardContent className="p-3 space-y-2.5">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                <p className="text-sm font-semibold truncate">{clienteApelido}</p>
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{processo.razao_social}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-primary whitespace-nowrap">
                {formatBRL(totalValue)}
              </span>
              {isUrgente && (
                <Badge variant="outline" className="text-[9px] border-warning text-warning ml-1">+50%</Badge>
              )}
              {calculo.isMensalista && (
                <Badge variant="outline" className="text-[9px] border-info text-info block mt-0.5">Mensalista</Badge>
              )}
            </div>
          </div>

          {/* Discount info */}
          {cliente?.desconto_progressivo > 0 && !calculo.isMensalista && (
            <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
              Desc. {cliente.desconto_progressivo}% progressivo
              {cliente.valor_limite_desconto && ` (mín. ${formatBRL(cliente.valor_limite_desconto)})`}
            </div>
          )}

          {/* Due date */}
          {vencimento && (
            <Badge variant="outline" className={cn('text-[10px]', isOverdue && 'border-destructive text-destructive')}>
              Venc: {new Date(vencimento).toLocaleDateString('pt-BR')}
            </Badge>
          )}

          {/* Valores Adicionais button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 justify-start"
            onClick={() => setValoresOpen(true)}
          >
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            Valores Adicionais
            {somaAdicionais > 0 && (
              <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                {formatBRL(somaAdicionais)}
              </Badge>
            )}
          </Button>

          {/* Checkboxes */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`enc-${processo.id}`}
                checked={!!lanc?.cobranca_encaminhada}
                onCheckedChange={(c) => handleCheckbox('cobranca_encaminhada', !!c)}
              />
              <label htmlFor={`enc-${processo.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
                Cobrança encaminhada ao cliente
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`rec-${processo.id}`}
                checked={!!lanc?.confirmado_recebimento}
                onCheckedChange={(c) => handleCheckbox('confirmado_recebimento', !!c)}
              />
              <label htmlFor={`rec-${processo.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
                Confirmado recebimento
              </label>
            </div>
          </div>

          {/* Attachments with download */}
          <div className="space-y-1">
            <AttachBtn storagePath={lanc?.boleto_url} label="Boleto" field="boleto_url" inputRef={boletoRef} folder="boletos" />
            <AttachBtn storagePath={(lanc as any)?.url_comprovante} label="Comprovante Pgto" field="url_comprovante" inputRef={comprovanteRef} folder="comprovantes" />
          </div>

          {/* Notes */}
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="Observações..."
            className="text-[11px] min-h-[40px] resize-none"
            rows={2}
          />

          {/* Navigation arrows */}
          <div className="flex items-center justify-between gap-1">
            {prevEtapa ? (
              <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 flex-1" onClick={() => onMoveRequest(processo, prevEtapa)}>
                <ChevronLeft className="h-3 w-3 mr-0.5" />
                {ETAPA_FINANCEIRO_LABELS[prevEtapa]}
              </Button>
            ) : <div className="flex-1" />}
            {nextEtapa ? (
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 flex-1" onClick={() => onMoveRequest(processo, nextEtapa)}>
                {ETAPA_FINANCEIRO_LABELS[nextEtapa]}
                <ChevronRight className="h-3 w-3 ml-0.5" />
              </Button>
            ) : <div className="flex-1" />}
          </div>

          <p className="text-[9px] text-muted-foreground/60 text-center">Duplo clique para edição completa</p>
        </CardContent>
      </Card>

      <ValoresAdicionaisModal
        open={valoresOpen}
        onOpenChange={setValoresOpen}
        processoId={processo.id}
        clienteApelido={clienteApelido}
      />
    </>
  );
}
