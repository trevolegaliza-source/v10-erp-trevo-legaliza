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
        <DialogContent
          className="sm:max-w-md border-zinc-800 text-zinc-100"
          style={{ backgroundColor: 'hsl(160 10% 8%)' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-50">
              <FileBadge className="h-5 w-5 text-emerald-400" />
              Detalhes da cobrança
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {clienteNome} — <span className="font-semibold text-zinc-200">{fmtBRL(total)}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Link público */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Link da cobrança
              </p>
              {loadingToken ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : publicUrl ? (
                <div className="flex items-center gap-2 bg-zinc-900/60 border border-zinc-800 rounded-lg p-2">
                  <code className="flex-1 text-[11px] font-mono truncate text-zinc-300">{publicUrl}</code>
                  <button
                    onClick={() => copyText(publicUrl, 'Link')}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
                    aria-label="Copiar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Abrir link"
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-zinc-500">Link indisponível.</p>
              )}
            </div>

            {/* Asaas */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                Cobrança Asaas (boleto/PIX)
              </p>

              {loadingAsaas ? (
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : asaasInfo?.payment_id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-emerald-400">
                    <FileBadge className="h-4 w-4" />
                    <span>
                      Boleto/PIX gerado
                      {asaasInfo.status && <span className="text-zinc-500"> · {asaasInfo.status}</span>}
                    </span>
                  </div>

                  {asaasInfo.pix_payload && (
                    <button
                      onClick={() => copyText(asaasInfo.pix_payload!, 'PIX copia-e-cola')}
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar PIX copia-e-cola
                    </button>
                  )}

                  {asaasInfo.boleto_barcode && (
                    <button
                      onClick={() => copyText(asaasInfo.boleto_barcode!, 'Linha digitável')}
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" /> Copiar linha digitável boleto
                    </button>
                  )}

                  {asaasInfo.boleto_url && (
                    <a
                      href={asaasInfo.boleto_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                    >
                      <Download className="h-4 w-4" /> Baixar boleto PDF
                    </a>
                  )}

                  {asaasInfo.invoice_url && (
                    <a
                      href={asaasInfo.invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center text-xs text-zinc-400 hover:text-zinc-200 pt-1"
                    >
                      Ver página oficial Asaas →
                    </a>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAsaasModalOpen(true)}
                  className="w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-emerald-950 text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <FileBadge className="h-4 w-4" /> Gerar Boleto / PIX (Asaas)
                </button>
              )}
            </div>

            {/* WhatsApp */}
            {publicUrl && (
              <div className="space-y-1.5 pt-3 border-t border-zinc-800">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Enviar ao cliente
                </p>
                <button
                  onClick={() => copyText(publicUrl, 'Link')}
                  className="w-full h-11 rounded-md border border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-100 text-sm font-medium inline-flex items-center justify-center gap-2"
                >
                  <LinkIcon className="h-4 w-4" /> Copiar link
                </button>
                {clienteTelefone && (
                  <a
                    href={`https://wa.me/${(clienteTelefone || '').replace(/\D/g, '').replace(/^/, '55').replace(/^5555/, '55')}?text=${encodeURIComponent(
                      `Olá! Segue o link da cobrança: ${publicUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full h-11 rounded-md bg-emerald-500 hover:bg-emerald-600 text-emerald-950 text-sm font-semibold inline-flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                  </a>
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
