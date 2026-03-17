import { useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, FileText, Upload, CheckCircle2, Download, PlusCircle } from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useUpdateLancamentoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useValoresAdicionais } from '@/hooks/useValoresAdicionais';
import { uploadFile, viewFile } from '@/hooks/useStorageUpload';
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
  const baseValue = Number(lanc?.valor ?? processo.valor ?? 0);
  const totalValue = baseValue + somaAdicionais;
  const clienteApelido = (processo.cliente as any)?.apelido || (processo.cliente as any)?.nome || '-';
  const vencimento = lanc?.data_vencimento;

  const mutateField = (updates: Record<string, any>) => {
    updateLanc.mutate({
      processoId: processo.id,
      lancamentoId: lanc?.id,
      clienteId: processo.cliente_id,
      valor: baseValue,
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

  const nextEtapaMap: Partial<Record<EtapaFinanceiro, EtapaFinanceiro>> = {
    solicitacao_criada: 'gerar_cobranca',
    gerar_cobranca: 'cobranca_gerada',
    cobranca_gerada: 'honorario_pago',
  };

  const nextEtapa = nextEtapaMap[processo.etapa_financeiro];
  const nextLabels: Record<string, string> = {
    gerar_cobranca: 'Gerar Cobrança →',
    cobranca_gerada: 'Cobrança Gerada →',
    honorario_pago: 'Marcar Pago ✓',
  };

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
        <button
          onClick={() => viewFile(storagePath)}
          className="text-[11px] text-info underline flex items-center gap-1 hover:text-info/80"
        >
          <CheckCircle2 className="h-3 w-3 text-success" /> {label}
          <Download className="h-3 w-3" />
        </button>
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

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
                {fmt(totalValue)}
              </span>
              {isUrgente && (
                <Badge variant="outline" className="text-[9px] border-warning text-warning ml-1">
                  +50%
                </Badge>
              )}
            </div>
          </div>

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
                {fmt(somaAdicionais)}
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

          {/* Attachments with real upload */}
          <div className="space-y-1">
            <AttachBtn
              storagePath={lanc?.boleto_url}
              label="Boleto"
              field="boleto_url"
              inputRef={boletoRef}
              folder="boletos"
            />
            <AttachBtn
              storagePath={(lanc as any)?.url_comprovante}
              label="Comprovante Pgto"
              field="url_comprovante"
              inputRef={comprovanteRef}
              folder="comprovantes"
            />
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

          {/* Move button */}
          {nextEtapa && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs h-7"
              onClick={() => onMoveRequest(processo, nextEtapa)}
            >
              {nextLabels[nextEtapa] || 'Avançar →'}
            </Button>
          )}

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
