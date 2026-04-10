import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle, XCircle, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { normalizeItem, type OrcamentoItem, type CenarioOrcamento } from '@/components/orcamentos/types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function PropostaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orc, setOrc] = useState<any>(null);
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  
  const [senhaRequerida, setSenhaRequerida] = useState(false);
  const [senhaInput, setSenhaInput] = useState('');
  const [senhaErro, setSenhaErro] = useState(false);
  const [autenticado, setAutenticado] = useState(false);

  const [showAprovacao, setShowAprovacao] = useState(false);
  const [showRecusa, setShowRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [processando, setProcessando] = useState(false);
  const [statusFinal, setStatusFinal] = useState<'aprovado' | 'recusado' | null>(null);

  useEffect(() => {
    if (!token) { setError('Link inválido'); setLoading(false); return; }
    (async () => {
      const { data, error: err } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('share_token', token)
        .maybeSingle();
      
      if (err || !data) {
        setError('Proposta não encontrada ou link expirado.');
        setLoading(false);
        return;
      }

      const orcData = data as any;

      if (orcData.validade_dias && orcData.created_at) {
        const criacao = new Date(orcData.created_at);
        const expira = new Date(criacao.getTime() + orcData.validade_dias * 86400000);
        if (new Date() > expira) {
          setError('Esta proposta expirou. Entre em contato para solicitar uma nova.');
          setLoading(false);
          return;
        }
      }

      if (['aguardando_pagamento', 'convertido'].includes(orcData.status)) {
        setStatusFinal('aprovado');
      } else if (orcData.status === 'recusado') {
        setStatusFinal('recusado');
      }

      if (orcData.destinatario === 'contador' && orcData.senha_link) {
        setSenhaRequerida(true);
      } else {
        setAutenticado(true);
      }

      const rawItens = Array.isArray(orcData.servicos) ? orcData.servicos.map(normalizeItem) : [];
      setItens(rawItens);
      setOrc(orcData);

      await supabase.from('proposta_eventos').insert({
        orcamento_id: orcData.id,
        tipo: 'visualizou',
        dados: { token },
      } as any);

      setLoading(false);
    })();
  }, [token]);

  function verificarSenha() {
    if (senhaInput === orc?.senha_link) {
      setAutenticado(true);
      setSenhaErro(false);
    } else {
      setSenhaErro(true);
    }
  }

  const modoPDF = orc?.destinatario === 'cliente_direto' ? 'direto' : orc?.destinatario === 'cliente_via_contador' ? 'cliente' : 'contador';
  const isContador = modoPDF === 'contador';
  const accentColor = isContador ? '#22c55e' : '#3b82f6';

  const escritorioNome = orc?.escritorio_nome || '';
  
  const cenarios: CenarioOrcamento[] = Array.isArray(orc?.cenarios) ? orc.cenarios : [];
  const temCenarios = cenarios.length > 0;

  const subtotal = useMemo(() => itens.reduce((s, i) => s + (i.honorario || 0) * i.quantidade, 0), [itens]);
  const totalTaxaMin = useMemo(() => itens.reduce((s, i) => s + i.taxa_min, 0), [itens]);
  const totalTaxaMax = useMemo(() => itens.reduce((s, i) => s + i.taxa_max, 0), [itens]);
  const desconto = subtotal * ((orc?.desconto_pct || 0) / 100);
  const total = subtotal - desconto;

  async function handleAprovar() {
    setProcessando(true);
    try {
      await supabase.from('orcamentos')
        .update({ 
          status: 'aguardando_pagamento', 
          aprovado_em: new Date().toISOString() 
        } as any)
        .eq('id', orc.id);

      await supabase.from('notificacoes').insert({
        tipo: 'aprovacao',
        titulo: '🟢 PROPOSTA APROVADA',
        mensagem: `${orc.prospect_nome} aprovou a proposta #${String(orc.numero).padStart(3, '0')} no valor de ${fmt(total)}. Aguardando pagamento.`,
        orcamento_id: orc.id,
      } as any);

      await supabase.from('proposta_eventos').insert({
        orcamento_id: orc.id,
        tipo: 'aprovou',
        dados: { total, itens_count: itens.length },
      } as any);

      setStatusFinal('aprovado');
      setShowAprovacao(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessando(false);
    }
  }

  async function handleRecusar() {
    if (!motivoRecusa.trim()) return;
    setProcessando(true);
    try {
      await supabase.from('orcamentos')
        .update({ 
          status: 'recusado', 
          recusado_em: new Date().toISOString(),
          observacoes_recusa: motivoRecusa 
        } as any)
        .eq('id', orc.id);

      await supabase.from('notificacoes').insert({
        tipo: 'recusa',
        titulo: '🔴 PROPOSTA RECUSADA',
        mensagem: `${orc.prospect_nome} recusou a proposta #${String(orc.numero).padStart(3, '0')}. Motivo: ${motivoRecusa}`,
        orcamento_id: orc.id,
      } as any);

      await supabase.from('proposta_eventos').insert({
        orcamento_id: orc.id,
        tipo: 'recusou',
        dados: { motivo: motivoRecusa },
      } as any);

      setStatusFinal('recusado');
      setShowRecusa(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessando(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-bold mb-2">Proposta Indisponível</h2>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (senhaRequerida && !autenticado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <Lock className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-lg font-bold">Acesso Protegido</h2>
              <p className="text-sm text-muted-foreground mt-1">Insira a senha para acessar esta proposta.</p>
            </div>
            <div className="space-y-3">
              <Input 
                type="password" 
                placeholder="Senha" 
                value={senhaInput} 
                onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
                onKeyDown={e => e.key === 'Enter' && verificarSenha()}
              />
              {senhaErro && <p className="text-xs text-destructive">Senha incorreta.</p>}
              <Button className="w-full" onClick={verificarSenha}>Acessar Proposta</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (statusFinal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            {statusFinal === 'aprovado' ? (
              <>
                <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-emerald-700 mb-2">Proposta Aprovada!</h2>
                <p className="text-sm text-muted-foreground">
                  Obrigado por aprovar. Nossa equipe entrará em contato para os próximos passos.
                </p>
              </>
            ) : (
              <>
                <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold text-destructive mb-2">Proposta Recusada</h2>
                <p className="text-sm text-muted-foreground">
                  Recebemos sua resposta. Caso mude de ideia, este link ainda estará disponível durante o prazo de validade.
                </p>
                {orc?.status === 'recusado' && (
                  <Button className="mt-4" variant="outline" onClick={() => setStatusFinal(null)}>
                    Revisar proposta novamente
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
  const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
  const contexto = orc?.contexto || '';
  const headline = orc?.headline_cenario || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: isContador ? 'linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%)' : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }} className="px-6 py-4 text-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="font-bold text-lg">
            {isContador ? '🍀 Trevo Legaliza' : (escritorioNome || '🍀 Trevo Legaliza')}
          </div>
          <div className="text-right text-sm opacity-70">
            Proposta #{String(orc?.numero || 0).padStart(3, '0')}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Proposta Comercial</p>
            <h1 className="text-2xl font-bold mb-1">{orc?.prospect_nome}</h1>
            {orc?.prospect_cnpj && <p className="text-sm text-muted-foreground">CNPJ: {orc.prospect_cnpj}</p>}
            
            <div className="mt-6 inline-block px-8 py-4 rounded-xl" style={{ background: isContador ? '#f0fdf4' : '#eff6ff', border: `2px solid ${accentColor}` }}>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: accentColor }}>Investimento Estimado</p>
              <p className="text-3xl font-black" style={{ color: accentColor }}>
                {totalTaxaMin > 0 || totalTaxaMax > 0 
                  ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                  : fmt(total)
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {contexto && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">Cenário e Oportunidade</h2>
              {headline && <p className="font-semibold text-base mb-3">{headline}</p>}
              <div className="bg-gray-50 rounded-xl p-4 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: contexto }} />
            </CardContent>
          </Card>
        )}

        {riscos.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="p-6">
              <h2 className="text-sm font-bold text-red-800 mb-3">⛔ Riscos da Operação Sem Regularização</h2>
              <ul className="space-y-2">
                {riscos.map((r: any) => (
                  <li key={r.id} className="text-sm text-red-700">
                    • {r.penalidade}{r.condicao ? `: ${r.condicao}` : ''}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {etapasFluxo.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Fluxo de Execução</h2>
              <div className="flex items-start gap-2 overflow-x-auto pb-2">
                {etapasFluxo.map((e: any, i: number) => (
                  <div key={e.id} className="flex items-start gap-2">
                    <div className="flex flex-col items-center text-center min-w-[100px]">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: accentColor }}>
                        {i === etapasFluxo.length - 1 ? '✓' : i + 1}
                      </div>
                      <p className="text-xs font-medium mt-2 leading-tight">{e.nome}</p>
                      {e.prazo && <p className="text-[10px] text-muted-foreground mt-1">{e.prazo}</p>}
                    </div>
                    {i < etapasFluxo.length - 1 && (
                      <div className="text-muted-foreground mt-2 text-lg">→</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Escopo dos Serviços</h2>
            <div className="space-y-3">
              {itens.filter(i => i.descricao.trim()).map((item, idx) => {
                const valorExibido = isContador ? item.honorario : (item.honorario_minimo_contador || item.honorario);
                const valorTotal = valorExibido * item.quantidade;
                const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                const cenario = temCenarios && item.cenarioId ? cenarios.find(c => c.id === item.cenarioId) : null;
                const cenarioIdx = cenario ? cenarios.indexOf(cenario) : -1;

                return (
                  <div key={item.id} className="border rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: isContador ? '#f0fdf4' : '#eff6ff' }}>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold">{idx + 1}.</span>
                        <span className="text-sm font-semibold">{item.descricao}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {cenario && (
                          <Badge variant="outline" className="text-xs">{String.fromCharCode(65 + cenarioIdx)}</Badge>
                        )}
                        {item.isOptional && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Opcional</Badge>
                        )}
                        <span className="font-bold text-sm">{fmt(valorTotal)}</span>
                      </div>
                    </div>
                    {item.detalhes && (
                      <div className="px-4 py-2 text-xs text-muted-foreground border-t" dangerouslySetInnerHTML={{ __html: item.detalhes }} />
                    )}
                    {(item.prazo || hasTaxa) && (
                      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-muted-foreground flex justify-between">
                        {item.prazo && <span>Prazo: {item.prazo}</span>}
                        {hasTaxa && <span className="text-amber-600">Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Resumo do Investimento</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Honorários</span>
                <span className="font-medium">{fmt(subtotal)}</span>
              </div>
              {orc?.desconto_pct > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Desconto ({orc.desconto_pct}%)</span>
                  <span>- {fmt(desconto)}</span>
                </div>
              )}
              {(totalTaxaMin > 0 || totalTaxaMax > 0) && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Taxas estimadas</span>
                  <span>{fmt(totalTaxaMin)} a {fmt(totalTaxaMax)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 mt-2 border-t-2 rounded-xl px-4 py-3" style={{ background: isContador ? '#f0fdf4' : '#eff6ff', borderColor: accentColor }}>
                <span className="text-sm font-bold uppercase" style={{ color: accentColor }}>Total</span>
                <span className="text-2xl font-black" style={{ color: accentColor }}>
                  {totalTaxaMin > 0 || totalTaxaMax > 0
                    ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                    : fmt(total)
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Condições</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Validade</p>
                <p className="text-sm font-semibold">{orc?.validade_dias} dias</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase">Pagamento</p>
                <p className="text-sm font-semibold">{orc?.pagamento || 'A combinar'}</p>
              </div>
            </div>
            {orc?.observacoes && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800" dangerouslySetInnerHTML={{ __html: orc.observacoes }} />
              </div>
            )}
          </CardContent>
        </Card>

        {orc?.status === 'enviado' && (
          <div className="flex gap-3">
            <Button 
              className="flex-1 h-14 text-base font-bold gap-2"
              style={{ background: accentColor }}
              onClick={() => setShowAprovacao(true)}
            >
              <CheckCircle className="h-5 w-5" /> Aprovar Proposta
            </Button>
            <Button 
              variant="outline" 
              className="h-14 px-6 text-base text-destructive border-destructive/30 hover:bg-destructive/5"
              onClick={() => setShowRecusa(true)}
            >
              <XCircle className="h-5 w-5" />
            </Button>
          </div>
        )}

        {orc?.status === 'recusado' && (
          <div className="flex gap-3">
            <Button 
              className="flex-1 h-14 text-base font-bold gap-2"
              style={{ background: accentColor }}
              onClick={() => setShowAprovacao(true)}
            >
              <CheckCircle className="h-5 w-5" /> Aprovar Proposta (mudei de ideia)
            </Button>
          </div>
        )}

        <div className="text-center pt-6 pb-8 border-t text-xs text-muted-foreground">
          <p>Trevo Legaliza · CNPJ 39.969.412/0001-70</p>
          <p className="mt-1">(11) 93492-7001 · administrativo@trevolegaliza.com.br</p>
        </div>
      </div>

      <Dialog open={showAprovacao} onOpenChange={setShowAprovacao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Aprovação</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-sm text-green-800 font-medium">Valor total da proposta</p>
              <p className="text-2xl font-black text-green-700 mt-1">
                {totalTaxaMin > 0 || totalTaxaMax > 0
                  ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                  : fmt(total)
                }
              </p>
              <p className="text-xs text-green-600 mt-1">{itens.length} serviços incluídos</p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Ao aprovar, nossa equipe será notificada e entrará em contato para os próximos passos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAprovacao(false)} disabled={processando}>Cancelar</Button>
            <Button onClick={handleAprovar} disabled={processando} className="bg-green-600 hover:bg-green-700">
              {processando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRecusa} onOpenChange={setShowRecusa}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar Proposta</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Lamentamos. Por favor, nos diga o motivo para que possamos melhorar nossas propostas.
            </p>
            <div>
              <Label className="text-sm">Motivo da recusa *</Label>
              <Textarea 
                value={motivoRecusa} 
                onChange={e => setMotivoRecusa(e.target.value)} 
                placeholder="Ex: Valor acima do orçamento, optamos por outro fornecedor, etc."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecusa(false)} disabled={processando}>Cancelar</Button>
            <Button variant="destructive" onClick={handleRecusar} disabled={processando || !motivoRecusa.trim()}>
              {processando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
