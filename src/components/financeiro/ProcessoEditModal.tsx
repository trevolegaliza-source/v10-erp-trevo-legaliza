import { useState, useRef, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  FileText, Upload, CheckCircle2, Trash2, PlusCircle, Download, Eye, Loader2,
} from 'lucide-react';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useUpdateLancamentoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useValoresAdicionais } from '@/hooks/useValoresAdicionais';
import { useAllServiceNegotiations, buildNegotiationLookup } from '@/hooks/useAllServiceNegotiations';
import { uploadFile, viewFile, getSignedUrl } from '@/hooks/useStorageUpload';
import { formatBRL } from '@/lib/pricing-engine';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import ValoresAdicionaisModal from './ValoresAdicionaisModal';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { useDeleteProcesso } from '@/hooks/useProcessos';
import { toast } from 'sonner';

interface ProcessoEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processo: ProcessoFinanceiro | null;
}

export default function ProcessoEditModal({ open, onOpenChange, processo }: ProcessoEditModalProps) {
  const updateLanc = useUpdateLancamentoFinanceiro();
  const deleteProcesso = useDeleteProcesso();
  const { data: allNegotiations = [] } = useAllServiceNegotiations();

  const [notes, setNotes] = useState('');
  const [valoresOpen, setValoresOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const boletoRef = useRef<HTMLInputElement>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const reciboRef = useRef<HTMLInputElement>(null);

  const { data: valoresAdicionais = [] } = useValoresAdicionais(processo?.id ?? '');

  // Retroactive negotiation detection
  const negotiationLookup = useMemo(() => buildNegotiationLookup(allNegotiations), [allNegotiations]);

  const matchedNeg = useMemo(() => {
    if (!processo) return null;
    const clientMap = negotiationLookup.get(processo.cliente_id);
    if (!clientMap) return null;
    const descricao = processo.lancamento?.descricao || '';
    for (const [name, neg] of clientMap) {
      if (descricao.toLowerCase().includes(name)) return neg;
    }
    return null;
  }, [processo, negotiationLookup]);

  if (!processo) return null;

  const lanc = processo.lancamento;
  const cliente = processo.cliente as any;
  const clienteApelido = cliente?.apelido || cliente?.nome || '-';
  const currentNotes = lanc?.observacoes_financeiro || '';
  const isNegociado = !!matchedNeg;
  const serviceName = matchedNeg?.service_name || lanc?.descricao || TIPO_PROCESSO_LABELS[processo.tipo] || processo.tipo;
  const createdAt = processo.created_at ? new Date(processo.created_at).toLocaleDateString('pt-BR') : null;

  const handleNotesBlur = () => {
    if (notes !== currentNotes) {
      mutateField({ observacoes_financeiro: notes });
    }
  };

  const mutateField = (updates: Record<string, any>) => {
    updateLanc.mutate({
      processoId: processo.id,
      lancamentoId: lanc?.id,
      clienteId: processo.cliente_id,
      valor: Number(lanc?.valor ?? processo.valor ?? 0),
      updates,
    });
  };

  const handleUpload = async (field: string, file: File, folder: string) => {
    try {
      setUploading(field);
      const path = await uploadFile(file, folder, processo.id);
      mutateField({ [field]: path });
      toast.success('Arquivo enviado com sucesso');
    } catch {
      // error handled in uploadFile
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

  const handleDeleteConfirm = () => {
    deleteProcesso.mutate(processo.id, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const DocRow = ({
    label, storagePath, field, inputRef, folder,
  }: {
    label: string;
    storagePath: string | null | undefined;
    field: string;
    inputRef: React.RefObject<HTMLInputElement | null>;
    folder: string;
  }) => (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-foreground">{label}</span>
        {storagePath && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
      </div>
      <div className="flex items-center gap-1.5">
        {storagePath && (
          <>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => viewFile(storagePath)}>
              <Eye className="h-3 w-3 mr-1" /> Ver
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={() => handleDownload(storagePath)}>
              <Download className="h-3 w-3 mr-1" /> Baixar
            </Button>
          </>
        )}
        <Button variant="outline" size="sm" className="h-7 text-xs border-border" disabled={uploading === field} onClick={() => inputRef.current?.click()}>
          {uploading === field ? (
            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</>
          ) : (
            <><Upload className="h-3 w-3 mr-1" /> {storagePath ? 'Substituir' : 'Enviar'}</>
          )}
        </Button>
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
    </div>
  );

  const somaAdicionais = valoresAdicionais.reduce((s, i) => s + Number(i.valor), 0);
  const baseValue = Number(lanc?.valor ?? processo.valor ?? 0);
  const totalValue = baseValue + somaAdicionais;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-background text-foreground border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              {serviceName}
              <Badge variant="outline" className="text-[10px] border-border">{processo.tipo}</Badge>
              {cliente?.tipo === 'MENSALISTA' && (
                <Badge variant="outline" className="text-[10px] border-info text-info">Mensalista</Badge>
              )}
              {isNegociado && (
                <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-emerald-500/50">
                  Negociado
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {processo.razao_social} — <span className="font-semibold text-foreground">{clienteApelido}</span>
              {createdAt && <span className="ml-2 text-xs">📅 {createdAt}</span>}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* Value summary */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              {(() => {
                const discountMatch = processo.notas?.match(/Base: R\$ ([\d.,]+) \| Desconto: R\$ ([\d.,]+)/);
                const valorBase = discountMatch ? parseFloat(discountMatch[1].replace(',', '.')) : baseValue;
                const descontoAcum = discountMatch ? parseFloat(discountMatch[2].replace(',', '.')) : 0;
                const processNumMatch = processo.notas?.match(/Processo nº (\d+) do mês/);
                const processNum = processNumMatch ? processNumMatch[1] : null;
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor Base</span>
                      <span className="text-foreground">{formatBRL(valorBase)}</span>
                    </div>
                    {descontoAcum > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-info">Desconto Acumulado {processNum && `(nº ${processNum} do mês)`}</span>
                        <span className="text-info">-{formatBRL(descontoAcum)}</span>
                      </div>
                    )}
                    {descontoAcum > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">Valor com Desconto</span>
                        <span className="text-foreground">{formatBRL(baseValue)}</span>
                      </div>
                    )}
                  </>
                );
              })()}
              {somaAdicionais > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Valores Adicionais ({valoresAdicionais.length})</span>
                  <span className="text-primary">{formatBRL(somaAdicionais)}</span>
                </div>
              )}
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span className="text-foreground">Total</span>
                <span className="text-primary">{formatBRL(totalValue)}</span>
              </div>
              {isNegociado && (
                <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
                  ⚠️ Valor definido conforme Tabela de Honorários Específicos
                </p>
              )}
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Observações</label>
              <Textarea
                defaultValue={currentNotes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Anotações sobre este processo..."
                className="text-sm min-h-[60px] bg-background border-border text-foreground"
                rows={3}
              />
            </div>

            {/* Valores Adicionais */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Valores Adicionais</label>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 justify-start border-border"
                onClick={() => setValoresOpen(true)}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Gerenciar Valores Adicionais
                {somaAdicionais > 0 && (
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1.5">
                    {valoresAdicionais.length} itens · {formatBRL(somaAdicionais)}
                  </Badge>
                )}
              </Button>
            </div>

            <Separator className="bg-border" />

            {/* Documents */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Documentos Anexados</label>
              <DocRow label="Boleto" storagePath={lanc?.boleto_url} field="boleto_url" inputRef={boletoRef} folder="boletos" />
              <DocRow label="Comprovante de Pagamento" storagePath={(lanc as any)?.url_comprovante} field="url_comprovante" inputRef={comprovanteRef} folder="comprovantes" />
              <DocRow label="Guia / Recibo de Taxa" storagePath={(lanc as any)?.url_recibo_taxa} field="url_recibo_taxa" inputRef={reciboRef} folder="recibos" />
            </div>

            <Separator className="bg-border" />

            {/* Delete */}
            <Button variant="destructive" size="sm" className="w-full" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir Processo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ValoresAdicionaisModal open={valoresOpen} onOpenChange={setValoresOpen} processoId={processo.id} clienteApelido={clienteApelido} />

      <PasswordConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteConfirm}
        title="Excluir Processo"
        description="Esta ação é irreversível. Confirme a senha master para excluir."
      />
    </>
  );
}
