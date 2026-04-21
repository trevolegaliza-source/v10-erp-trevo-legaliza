import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Loader2,
  Copy,
  Check,
  Download,
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import logoTrevo from '@/assets/logo-trevo.png';

interface Taxa {
  descricao: string;
  valor: number;
}

interface LancamentoCobranca {
  id: string;
  descricao: string;
  valor: number;
  razao_social: string | null;
  tipo_processo: string | null;
  taxas: Taxa[];
}

interface EmpresaConfig {
  nome: string;
  cnpj: string;
  pix_chave: string;
  pix_banco: string;
  whatsapp: string;
  site: string;
}

interface AsaasInfo {
  payment_id: string | null;
  status: string | null;
  invoice_url: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode: string | null;
  pix_payload: string | null;
  gerado_em: string | null;
  pago_em: string | null;
}

interface CobrancaData {
  id: string;
  cliente_nome: string;
  cliente_apelido: string | null;
  cliente_cnpj: string | null;
  total_honorarios: number;
  total_taxas: number;
  total_geral: number;
  data_vencimento: string | null;
  status: 'ativa' | 'vencida' | 'paga' | 'cancelada';
  created_at: string;
  lancamentos: LancamentoCobranca[];
  empresa_config: EmpresaConfig;
  pago_em?: string | null;
  extrato_id?: string | null;
  asaas?: AsaasInfo | null;
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const TIPO_BADGE: Record<string, string> = {
  abertura: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  alteracao: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  baixa: 'bg-red-500/15 text-red-400 border-red-500/30',
  avulso: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  transformacao: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  ativa: { label: 'ATIVA', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40' },
  vencida: { label: 'VENCIDA', className: 'bg-amber-500/15 text-amber-400 border-amber-500/40' },
  paga: { label: 'PAGA', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
  cancelada: { label: 'CANCELADA', className: 'bg-zinc-600/30 text-zinc-300 border-zinc-500/40' },
};

export default function CobrancaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [cobranca, setCobranca] = useState<CobrancaData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    if (!cobranca) return;
    const title = `Cobrança — ${cobranca.cliente_apelido || cobranca.cliente_nome} — Trevo Legaliza`;
    const description = `Cobrança oficial no valor de R$ ${Number(cobranca.total_geral).toFixed(2).replace('.', ',')}. Pague via PIX ou boleto com segurança.`;
    const image = 'https://trevolegaliza.lovable.app/og-cobranca.png';

    document.title = title;

    const setMeta = (key: 'property' | 'name', value: string, content: string) => {
      let tag = document.querySelector(`meta[${key}="${value}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(key, value);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', 'Trevo Legaliza');
    setMeta('name', 'description', description);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);
  }, [cobranca]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data, error: rpcError } = await supabase.rpc(
          'get_cobranca_por_token' as any,
          { p_token: token }
        );
        if (cancelled) return;
        if (rpcError) throw rpcError;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setError('not_found');
        } else {
          setCobranca(row as CobrancaData);
          // marca como visualizada (fire-and-forget)
          supabase.rpc('mark_cobranca_visualizada' as any, { p_token: token }).then(() => {});
        }
      } catch (e) {
        if (!cancelled) setError('not_found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const copiarPix = async () => {
    if (!cobranca) return;
    try {
      await navigator.clipboard.writeText(cobranca.empresa_config.pix_chave);
      setCopied(true);
      toast.success('Chave PIX copiada!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Não foi possível copiar.');
    }
  };

  const abrirWhatsApp = () => {
    if (!cobranca) return;
    const msg = encodeURIComponent(
      `Olá! Tenho uma dúvida sobre a cobrança ${cobranca.cliente_nome}`
    );
    window.open(`https://wa.me/${cobranca.empresa_config.whatsapp}?text=${msg}`, '_blank');
  };

  const baixarExtrato = async () => {
    if (!token) return;
    try {
      toast.info('Baixando PDF...');
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cobranca-pdf?token=${encodeURIComponent(token)}`;
      const resp = await fetch(fnUrl, {
        headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      });
      if (!resp.ok) {
        toast.error('PDF indisponível. Fale com a gente pelo WhatsApp.');
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cobranca-${cobranca?.cliente_nome || token}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast.success('PDF baixado!');
    } catch {
      toast.error('Erro ao baixar PDF.');
    }
  };

  if (loading) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error === 'not_found' || !cobranca) {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-destructive/40">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1>
            <p className="text-muted-foreground text-sm">
              Não encontramos esta cobrança. Entre em contato conosco para ajuda.
            </p>
            <Button onClick={() => window.open('https://wa.me/5511934927001', '_blank')} className="gap-2">
              <MessageCircle className="h-4 w-4" /> Falar no WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (cobranca.status === 'cancelada') {
    return (
      <div className="dark min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Cobrança cancelada</h1>
            <p className="text-muted-foreground text-sm">Esta cobrança foi cancelada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[cobranca.status] ?? STATUS_BADGE.ativa;
  const isPaga = cobranca.status === 'paga';
  const empresa = cobranca.empresa_config;
  const saudacao = cobranca.cliente_apelido || cobranca.cliente_nome;

  // Dias até vencimento (ou atraso)
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = cobranca.data_vencimento ? new Date(cobranca.data_vencimento + 'T00:00:00') : null;
  const diffDias = venc ? Math.floor((venc.getTime() - hoje.getTime()) / 86400000) : null;
  const vencimentoLabel = !venc
    ? null
    : diffDias === 0 ? 'Vence hoje'
    : diffDias === 1 ? 'Vence amanhã'
    : diffDias > 1 ? `Vence em ${diffDias} dias`
    : diffDias === -1 ? 'Vencido há 1 dia'
    : `Vencido há ${Math.abs(diffDias!)} dias`;
  const vencimentoCls = diffDias == null ? ''
    : diffDias < 0 ? 'text-red-400'
    : diffDias <= 2 ? 'text-amber-400'
    : 'text-emerald-400';

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      {/* Hero com gradiente verde */}
      <div className="bg-gradient-to-br from-emerald-950/60 via-background to-background border-b border-emerald-500/10">
        <div className="max-w-2xl mx-auto px-4 pt-8 pb-6 text-center space-y-3">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 mx-auto" />
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400/70 font-medium">Cobrança Oficial</p>
            <p className="text-[11px] text-muted-foreground/70">
              {empresa.nome} · CNPJ {empresa.cnpj}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Card principal — saudação + status + vencimento */}
        <Card className="bg-card border-border shadow-lg">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">Olá, {saudacao}!</h1>
                <p className="text-sm text-muted-foreground">
                  Aqui está o resumo da sua cobrança
                </p>
              </div>
              <Badge variant="outline" className={`${statusInfo.className} shrink-0`}>
                {statusInfo.label}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Emissão</p>
                <p className="text-sm font-medium mt-1">{fmtData(cobranca.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Vencimento</p>
                <p className="text-sm font-medium mt-1">{fmtData(cobranca.data_vencimento)}</p>
                {vencimentoLabel && !isPaga && (
                  <p className={`text-xs font-semibold mt-0.5 ${vencimentoCls}`}>
                    {vencimentoLabel}
                  </p>
                )}
              </div>
            </div>

            {isPaga && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-emerald-300">Pagamento confirmado!</p>
                  {cobranca.pago_em && (
                    <p className="text-xs text-emerald-300/80">
                      Recebido em {fmtData(cobranca.pago_em)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de processos */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
              Processos cobrados
            </h2>
            <Accordion type="multiple" className="space-y-2">
              {cobranca.lancamentos.map((l) => {
                const tipoCls = TIPO_BADGE[l.tipo_processo || 'avulso'] ?? TIPO_BADGE.avulso;
                const temTaxas = l.taxas && l.taxas.length > 0;
                return (
                  <AccordionItem
                    key={l.id}
                    value={l.id}
                    className="border border-border/60 rounded-lg px-3"
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between gap-2 w-full pr-2">
                        <div className="text-left flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {l.razao_social || l.descricao}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            {l.tipo_processo && (
                              <Badge variant="outline" className={`text-[10px] ${tipoCls}`}>
                                {l.tipo_processo}
                              </Badge>
                            )}
                            {temTaxas && (
                              <span className="text-[10px] text-muted-foreground">
                                +{l.taxas.length} taxa(s)
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold tabular-nums shrink-0">
                          {fmtBRL(l.valor)}
                        </span>
                      </div>
                    </AccordionTrigger>
                    {temTaxas && (
                      <AccordionContent className="pb-3">
                        <div className="space-y-1 pt-2 border-t border-border/40">
                          {l.taxas.map((t, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">{t.descricao}</span>
                              <span className="tabular-nums">{fmtBRL(t.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    )}
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>

        {/* Totais */}
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Honorários</span>
              <span className="tabular-nums">{fmtBRL(cobranca.total_honorarios)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxas / Reembolsos</span>
              <span className="tabular-nums">{fmtBRL(cobranca.total_taxas)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-border">
              <span className="text-sm uppercase tracking-wide text-muted-foreground">Total</span>
              <span className="text-3xl font-bold text-primary tabular-nums">
                {fmtBRL(cobranca.total_geral)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Pagamento (oculto se paga) */}
        {!isPaga && (() => {
          const temAsaas = !!cobranca.asaas?.pix_payload;
          const pixValueToCopy = cobranca.asaas?.pix_payload || empresa.pix_chave;
          const pixQrValue = cobranca.asaas?.pix_qrcode
            ? null // usa imagem base64 direto
            : (cobranca.asaas?.pix_payload || empresa.pix_chave);

          return (
            <>
              {/* Botão principal: PIX copia-e-cola em DESTAQUE (mobile-first) */}
              <Card className="bg-gradient-to-br from-emerald-900/30 to-emerald-950/40 border-emerald-500/40 shadow-lg">
                <CardContent className="p-5 space-y-4">
                  <div className="text-center space-y-1">
                    <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full text-xs font-semibold">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> PAGAMENTO INSTANTÂNEO
                    </div>
                    <h2 className="text-xl font-bold text-emerald-50 mt-2">Pague via PIX</h2>
                    <p className="text-xs text-emerald-200/60">
                      {temAsaas
                        ? 'Copie o código abaixo e cole no app do seu banco'
                        : 'Aponte a câmera ou copie a chave abaixo'}
                    </p>
                  </div>

                  {/* Botão principal: PIX copia-e-cola */}
                  <Button
                    size="lg"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(pixValueToCopy);
                        setCopied(true);
                        toast.success(temAsaas ? 'PIX copia-e-cola copiado!' : 'Chave PIX copiada!');
                        setTimeout(() => setCopied(false), 3000);
                      } catch {
                        toast.error('Não foi possível copiar.');
                      }
                    }}
                    className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold text-base gap-2"
                  >
                    {copied ? (
                      <><Check className="h-5 w-5" /> Código copiado!</>
                    ) : (
                      <><Copy className="h-5 w-5" /> {temAsaas ? 'Copiar PIX copia-e-cola' : 'Copiar chave PIX'}</>
                    )}
                  </Button>

                  {/* QR Code colapsado (alternativa pra quem lê QR) */}
                  <details className="group">
                    <summary className="cursor-pointer text-center text-xs text-emerald-200/70 hover:text-emerald-200 select-none">
                      Preferir QR Code? <span className="underline">Clique pra expandir</span>
                    </summary>
                    <div className="mt-3 flex flex-col items-center gap-2">
                      <div className="bg-white p-3 rounded-lg">
                        {cobranca.asaas?.pix_qrcode ? (
                          <img
                            src={`data:image/png;base64,${cobranca.asaas.pix_qrcode}`}
                            alt="QR Code PIX"
                            className="h-[160px] w-[160px]"
                          />
                        ) : (
                          <QRCodeSVG value={pixQrValue!} size={160} level="M" />
                        )}
                      </div>
                      {!temAsaas && (
                        <p className="text-[10px] text-amber-300/80 text-center max-w-xs">
                          ⚠️ QR estático: você precisará digitar o valor manualmente no app do banco.
                        </p>
                      )}
                    </div>
                  </details>

                  <p className="text-[10px] text-center text-emerald-200/50">
                    {empresa.pix_banco} · CNPJ {empresa.cnpj}
                  </p>
                </CardContent>
              </Card>

              {/* Boleto (se Asaas gerou) */}
              {cobranca.asaas?.boleto_url && (
                <Card className="bg-card border-border">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <h3 className="text-sm font-semibold">Preferir boleto bancário?</h3>
                    </div>

                    <Button asChild variant="outline" className="w-full gap-2">
                      <a href={cobranca.asaas.boleto_url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" /> Baixar boleto em PDF
                      </a>
                    </Button>

                    {cobranca.asaas.boleto_barcode && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Linha digitável
                        </p>
                        <div className="flex items-center gap-2 bg-background/60 border border-border rounded-lg p-3">
                          <code className="flex-1 text-[11px] font-mono break-all leading-relaxed">
                            {cobranca.asaas.boleto_barcode}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(cobranca.asaas!.boleto_barcode!);
                                toast.success('Linha digitável copiada!');
                              } catch {
                                toast.error('Não foi possível copiar.');
                              }
                            }}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {cobranca.asaas.invoice_url && (
                      <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                        <a href={cobranca.asaas.invoice_url} target="_blank" rel="noopener noreferrer">
                          Ver página oficial Asaas →
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Se não tem Asaas ainda, aviso discreto */}
              {!temAsaas && (
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground">
                      Prefere pagar por <strong>boleto</strong>? Solicite à nossa equipe pelo WhatsApp.
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}

        {/* Ações secundárias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" onClick={baixarExtrato} className="gap-2">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button variant="outline" onClick={abrirWhatsApp} className="gap-2">
            <MessageCircle className="h-4 w-4" /> Tirar dúvida
          </Button>
        </div>

        {/* Footer */}
        <footer className="text-center pt-6 pb-4 space-y-1">
          <p className="text-xs text-muted-foreground">
            Esta cobrança é oficial da {empresa.nome}
          </p>
          <a
            href={`https://${empresa.site}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {empresa.site}
          </a>
          <p className="text-[10px] text-muted-foreground/70">
            Cobrança gerada em {fmtData(cobranca.created_at)}
          </p>
        </footer>
      </div>
    </div>
  );
}
