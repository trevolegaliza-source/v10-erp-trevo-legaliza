import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Link as LinkIcon,
  Copy,
  FileBadge,
  MessageCircle,
  Download,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getCobrancaPublicUrl } from '@/lib/cobranca-url';
import { useCobrancaAsaas, useGerarAsaasCobranca } from '@/hooks/useAsaas';
import GerarAsaasModal from './GerarAsaasModal';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** ID da cobrança (tabela `cobrancas`). */
  cobrancaId: string | null;
  clienteNome: string;
  clienteTelefone?: string | null;
  total: number;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function DetalhesCobrancaModal({
  open, onOpenChange, cobrancaId, clienteNome, clienteTelefone, total,
}: Props) {
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [asaasModalOpen, setAsaasModalOpen] = useState(false);
  const { data: asaasInfo, isLoading: loadingAsaas } = useCobrancaAsaas(cobrancaId);

  useEffect(() => {
    if (!open || !cobrancaId) { setShareToken(null); return; }
    let cancel = false;
    setLoadingToken(true);
    supabase
      .from('cobrancas')
      .select('share_token')
      .eq('id', cobrancaId)
      .single()
      .then(({ data }) => {
        if (cancel) return;
        setShareToken((data as any)?.share_token ?? null);
        setLoadingToken(false);
      });
    return () => { cancel = true; };
  }, [open, cobrancaId]);

  const publicUrl = shareToken ? getCobrancaPublicUrl(shareToken) : null;

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  if (!cobrancaId) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-primary" />
              Detalhes da cobrança
            </DialogTitle>
            <DialogDescription>
              {clienteNome} — <span className="font-semibold">{fmtBRL(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Link público */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Link da cobrança
              </p>
              {loadingToken ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : publicUrl ? (
                <div className="flex items-center gap-2 bg-muted/40 border rounded-lg p-2">
                  <code className="flex-1 text-[11px] font-mono truncate">{publicUrl}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyText(publicUrl, 'Link')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir link">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Link indisponível.</p>
              )}
            </div>

            {/* Asaas */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Cobrança Asaas (boleto/PIX)
              </p>

              {loadingAsaas ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : asaasInfo?.payment_id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <FileBadge className="h-4 w-4" />
                    <span>
                      Boleto/PIX gerado
                      {asaasInfo.status && <span className="text-muted-foreground"> · {asaasInfo.status}</span>}
                    </span>
                  </div>

                  {asaasInfo.pix_payload && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => copyText(asaasInfo.pix_payload!, 'PIX copia-e-cola')}
                    >
                      <Copy className="h-4 w-4" /> Copiar PIX copia-e-cola
                    </Button>
                  )}

                  {asaasInfo.boleto_barcode && (
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => copyText(asaasInfo.boleto_barcode!, 'Linha digitável')}
                    >
                      <Copy className="h-4 w-4" /> Copiar linha digitável boleto
                    </Button>
                  )}

                  {asaasInfo.boleto_url && (
                    <Button variant="outline" className="w-full gap-2" asChild>
                      <a href={asaasInfo.boleto_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Baixar boleto PDF
                      </a>
                    </Button>
                  )}

                  {asaasInfo.invoice_url && (
                    <Button variant="ghost" size="sm" className="w-full text-xs" asChild>
                      <a href={asaasInfo.invoice_url} target="_blank" rel="noopener noreferrer">
                        Ver página oficial Asaas →
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <Button
                  className="w-full gap-2"
                  onClick={() => setAsaasModalOpen(true)}
                >
                  <FileBadge className="h-4 w-4" /> Gerar Boleto / PIX (Asaas)
                </Button>
              )}
            </div>

            {/* WhatsApp */}
            {publicUrl && (
              <div className="space-y-1.5 pt-2 border-t border-border/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Enviar ao cliente
                </p>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => copyText(publicUrl, 'Link')}
                >
                  <LinkIcon className="h-4 w-4" /> Copiar link
                </Button>
                {clienteTelefone && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-green-500 border-green-500/30 hover:bg-green-500/10"
                    asChild
                  >
                    <a
                      href={`https://wa.me/${(clienteTelefone || '').replace(/\D/g, '').replace(/^/, '55').replace(/^5555/, '55')}?text=${encodeURIComponent(
                        `Olá! Segue o link da cobrança: ${publicUrl}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <GerarAsaasModal
        open={asaasModalOpen}
        onOpenChange={setAsaasModalOpen}
        cobrancaId={cobrancaId}
        clienteNome={clienteNome}
        total={total}
        vencimentoSugerido={asaasInfo?.data_vencimento || undefined}
      />
    </>
  );
}
