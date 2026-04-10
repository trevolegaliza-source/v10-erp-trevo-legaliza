import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Lock } from 'lucide-react';
import { normalizeItem, type OrcamentoItem, type CenarioOrcamento } from '@/components/orcamentos/types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const anonHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// Inline style helpers — no Tailwind theme dependency
const cardStyle: React.CSSProperties = { background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' };
const cardPad: React.CSSProperties = { padding: '24px' };
const muted: React.CSSProperties = { color: '#6b7280' };
const fg: React.CSSProperties = { color: '#1a1a2e' };

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

  // Force light theme on public page
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    };
  }, []);

  // Load proposal via raw fetch (bypass AuthContext)
  useEffect(() => {
    if (!token) { setError('Link inválido'); setLoading(false); return; }
    (async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/orcamentos?share_token=eq.${token}&select=*`,
          { headers: anonHeaders }
        );
        if (!response.ok) { setError('Erro ao carregar proposta.'); setLoading(false); return; }

        const results = await response.json();
        if (!results || results.length === 0) {
          setError('Proposta não encontrada ou link expirado.');
          setLoading(false);
          return;
        }

        const orcData = results[0];

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

        // Log view event (fire-and-forget)
        fetch(`${SUPABASE_URL}/rest/v1/proposta_eventos`, {
          method: 'POST',
          headers: anonHeaders,
          body: JSON.stringify({ orcamento_id: orcData.id, tipo: 'visualizou', dados: { token } }),
        }).catch(() => {});

        setLoading(false);
      } catch (err) {
        console.error(err);
        setError('Erro ao carregar proposta.');
        setLoading(false);
      }
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
      await fetch(`${SUPABASE_URL}/rest/v1/orcamentos?id=eq.${orc.id}`, {
        method: 'PATCH',
        headers: { ...anonHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'aguardando_pagamento', aprovado_em: new Date().toISOString() }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/notificacoes`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({
          tipo: 'aprovacao',
          titulo: '🟢 PROPOSTA APROVADA',
          mensagem: `${orc.prospect_nome} aprovou a proposta #${String(orc.numero).padStart(3, '0')} no valor de ${fmt(total)}. Aguardando pagamento.`,
          orcamento_id: orc.id,
        }),
      });

      fetch(`${SUPABASE_URL}/rest/v1/proposta_eventos`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({ orcamento_id: orc.id, tipo: 'aprovou', dados: { total, itens_count: itens.length } }),
      }).catch(() => {});

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
      await fetch(`${SUPABASE_URL}/rest/v1/orcamentos?id=eq.${orc.id}`, {
        method: 'PATCH',
        headers: { ...anonHeaders, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ status: 'recusado', recusado_em: new Date().toISOString(), observacoes_recusa: motivoRecusa }),
      });

      await fetch(`${SUPABASE_URL}/rest/v1/notificacoes`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({
          tipo: 'recusa',
          titulo: '🔴 PROPOSTA RECUSADA',
          mensagem: `${orc.prospect_nome} recusou a proposta #${String(orc.numero).padStart(3, '0')}. Motivo: ${motivoRecusa}`,
          orcamento_id: orc.id,
        }),
      });

      fetch(`${SUPABASE_URL}/rest/v1/proposta_eventos`, {
        method: 'POST',
        headers: anonHeaders,
        body: JSON.stringify({ orcamento_id: orc.id, tipo: 'recusou', dados: { motivo: motivoRecusa } }),
      }).catch(() => {});

      setStatusFinal('recusado');
      setShowRecusa(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessando(false);
    }
  }

  // ─── LOADING ───
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <Loader2 style={{ height: 32, width: 32, color: '#9ca3af' }} className="animate-spin" />
      </div>
    );
  }

  // ─── ERROR ───
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 16 }}>
        <div style={{ ...cardStyle, maxWidth: 448, width: '100%' }}>
          <div style={{ ...cardPad, textAlign: 'center' }}>
            <XCircle style={{ height: 48, width: 48, color: '#dc2626', margin: '0 auto 16px' }} />
            <h2 style={{ ...fg, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Proposta Indisponível</h2>
            <p style={{ ...muted, fontSize: 14 }}>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── PASSWORD SCREEN ───
  if (senhaRequerida && !autenticado) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 16 }}>
        <div style={{ ...cardStyle, maxWidth: 384, width: '100%' }}>
          <div style={cardPad}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <Lock style={{ height: 40, width: 40, color: '#6b7280', margin: '0 auto 12px' }} />
              <h2 style={{ ...fg, fontSize: 18, fontWeight: 700 }}>Acesso Protegido</h2>
              <p style={{ ...muted, fontSize: 14, marginTop: 4 }}>Insira a senha para acessar esta proposta.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input
                type="password"
                placeholder="Senha"
                value={senhaInput}
                onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
                onKeyDown={e => e.key === 'Enter' && verificarSenha()}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', color: '#1a1a2e' }}
              />
              {senhaErro && <p style={{ fontSize: 12, color: '#dc2626' }}>Senha incorreta.</p>}
              <button
                onClick={verificarSenha}
                style={{ padding: '10px 16px', background: accentColor, color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer' }}
              >
                Acessar Proposta
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── STATUS FINAL ───
  if (statusFinal) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 16 }}>
        <div style={{ ...cardStyle, maxWidth: 448, width: '100%' }}>
          <div style={{ ...cardPad, textAlign: 'center' }}>
            {statusFinal === 'aprovado' ? (
              <>
                <CheckCircle style={{ height: 64, width: 64, color: '#22c55e', margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#15803d', marginBottom: 8 }}>Proposta Aprovada!</h2>
                <p style={{ ...muted, fontSize: 14 }}>
                  Obrigado por aprovar. Nossa equipe entrará em contato para os próximos passos.
                </p>
              </>
            ) : (
              <>
                <XCircle style={{ height: 64, width: 64, color: '#dc2626', margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: 20, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Proposta Recusada</h2>
                <p style={{ ...muted, fontSize: 14 }}>
                  Recebemos sua resposta. Caso mude de ideia, este link ainda estará disponível durante o prazo de validade.
                </p>
                {orc?.status === 'recusado' && (
                  <button
                    style={{ marginTop: 16, padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#1a1a2e' }}
                    onClick={() => setStatusFinal(null)}
                  >
                    Revisar proposta novamente
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── MAIN PROPOSAL ───
  const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
  const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
  const contexto = orc?.contexto || '';
  const headline = orc?.headline_cenario || '';

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', colorScheme: 'light' }} data-theme="light">
      {/* HEADER */}
      <div style={{ background: isContador ? 'linear-gradient(135deg, #0f1f0f 0%, #1a3a1a 100%)' : 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '16px 24px', color: '#fff' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>
            {isContador ? '🍀 Trevo Legaliza' : (escritorioNome || '🍀 Trevo Legaliza')}
          </div>
          <div style={{ textAlign: 'right', fontSize: 14, opacity: 0.7 }}>
            Proposta #{String(orc?.numero || 0).padStart(3, '0')}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 768, margin: '0 auto', padding: '32px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* CAPA */}
        <div style={cardStyle}>
          <div style={{ ...cardPad, textAlign: 'center' }}>
            <p style={{ ...muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Proposta Comercial</p>
            <h1 style={{ ...fg, fontSize: 24, fontWeight: 700, marginBottom: 4 }}>{orc?.prospect_nome}</h1>
            {orc?.prospect_cnpj && <p style={{ ...muted, fontSize: 14 }}>CNPJ: {orc.prospect_cnpj}</p>}

            <div style={{ marginTop: 24, display: 'inline-block', padding: '16px 32px', borderRadius: 12, background: isContador ? '#f0fdf4' : '#eff6ff', border: `2px solid ${accentColor}` }}>
              <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, color: accentColor }}>Investimento Estimado</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: accentColor }}>
                {totalTaxaMin > 0 || totalTaxaMax > 0
                  ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                  : fmt(total)
                }
              </p>
            </div>
          </div>
        </div>

        {/* CONTEXTO */}
        {contexto && (
          <div style={cardStyle}>
            <div style={cardPad}>
              <h2 style={{ ...muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Cenário e Oportunidade</h2>
              {headline && <p style={{ ...fg, fontWeight: 600, fontSize: 16, marginBottom: 12 }}>{headline}</p>}
              <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, fontSize: 14, lineHeight: 1.6, color: '#374151' }} dangerouslySetInnerHTML={{ __html: contexto }} />
            </div>
          </div>
        )}

        {/* RISCOS */}
        {riscos.length > 0 && (
          <div style={{ ...cardStyle, borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={cardPad}>
              <h2 style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 12 }}>⛔ Riscos da Operação Sem Regularização</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {riscos.map((r: any) => (
                  <li key={r.id} style={{ fontSize: 14, color: '#b91c1c' }}>
                    • {r.penalidade}{r.condicao ? `: ${r.condicao}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* FLUXO */}
        {etapasFluxo.length > 0 && (
          <div style={cardStyle}>
            <div style={cardPad}>
              <h2 style={{ ...muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Fluxo de Execução</h2>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {etapasFluxo.map((e: any, i: number) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', minWidth: 100 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, background: accentColor }}>
                        {i === etapasFluxo.length - 1 ? '✓' : i + 1}
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 500, marginTop: 8, lineHeight: 1.3, color: '#374151' }}>{e.nome}</p>
                      {e.prazo && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>{e.prazo}</p>}
                    </div>
                    {i < etapasFluxo.length - 1 && (
                      <div style={{ color: '#9ca3af', marginTop: 8, fontSize: 18 }}>→</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ITENS */}
        <div style={cardStyle}>
          <div style={cardPad}>
            <h2 style={{ ...muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Escopo dos Serviços</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {itens.filter(i => i.descricao.trim()).map((item, idx) => {
                const valorExibido = isContador ? item.honorario : (item.honorario_minimo_contador || item.honorario);
                const valorTotal = valorExibido * item.quantidade;
                const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                const cenario = temCenarios && item.cenarioId ? cenarios.find(c => c.id === item.cenarioId) : null;
                const cenarioIdx = cenario ? cenarios.indexOf(cenario) : -1;

                return (
                  <div key={item.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: isContador ? '#f0fdf4' : '#eff6ff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>{idx + 1}.</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{item.descricao}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {cenario && (
                          <span style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: 4, color: '#374151' }}>{String.fromCharCode(65 + cenarioIdx)}</span>
                        )}
                        {item.isOptional && (
                          <span style={{ fontSize: 12, padding: '2px 6px', border: '1px solid #fcd34d', borderRadius: 4, color: '#d97706' }}>Opcional</span>
                        )}
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{fmt(valorTotal)}</span>
                      </div>
                    </div>
                    {item.detalhes && (
                      <div style={{ padding: '8px 16px', fontSize: 12, color: '#6b7280', borderTop: '1px solid #e2e8f0' }} dangerouslySetInnerHTML={{ __html: item.detalhes }} />
                    )}
                    {(item.prazo || hasTaxa) && (
                      <div style={{ padding: '8px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, color: '#6b7280', display: 'flex', justifyContent: 'space-between' }}>
                        {item.prazo && <span>Prazo: {item.prazo}</span>}
                        {hasTaxa && <span style={{ color: '#d97706' }}>Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RESUMO */}
        <div style={cardStyle}>
          <div style={cardPad}>
            <h2 style={{ ...muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Resumo do Investimento</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={muted}>Honorários</span>
                <span style={{ ...fg, fontWeight: 500 }}>{fmt(subtotal)}</span>
              </div>
              {orc?.desconto_pct > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#dc2626' }}>
                  <span>Desconto ({orc.desconto_pct}%)</span>
                  <span>- {fmt(desconto)}</span>
                </div>
              )}
              {(totalTaxaMin > 0 || totalTaxaMax > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#d97706' }}>
                  <span>Taxas estimadas</span>
                  <span>{fmt(totalTaxaMin)} a {fmt(totalTaxaMax)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', marginTop: 8, borderRadius: 12, background: isContador ? '#f0fdf4' : '#eff6ff', borderTop: `2px solid ${accentColor}` }}>
                <span style={{ fontSize: 14, fontWeight: 700, textTransform: 'uppercase', color: accentColor }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 900, color: accentColor }}>
                  {totalTaxaMin > 0 || totalTaxaMax > 0
                    ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                    : fmt(total)
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CONDIÇÕES */}
        <div style={cardStyle}>
          <div style={cardPad}>
            <h2 style={{ ...muted, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>Condições</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Validade</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{orc?.validade_dias} dias</p>
              </div>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Pagamento</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{orc?.pagamento || 'A combinar'}</p>
              </div>
            </div>
            {orc?.observacoes && (
              <div style={{ marginTop: 12, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: 12 }}>
                <p style={{ fontSize: 12, color: '#92400e' }} dangerouslySetInnerHTML={{ __html: orc.observacoes }} />
              </div>
            )}
          </div>
        </div>

        {/* ACTION BUTTONS */}
        {orc?.status === 'enviado' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{ flex: 1, height: 56, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: accentColor, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
              onClick={() => setShowAprovacao(true)}
            >
              <CheckCircle style={{ height: 20, width: 20 }} /> Aprovar Proposta
            </button>
            <button
              style={{ height: 56, padding: '0 24px', fontSize: 16, color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 12, background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              onClick={() => setShowRecusa(true)}
            >
              <XCircle style={{ height: 20, width: 20 }} />
            </button>
          </div>
        )}

        {orc?.status === 'recusado' && (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              style={{ flex: 1, height: 56, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: accentColor, color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}
              onClick={() => setShowAprovacao(true)}
            >
              <CheckCircle style={{ height: 20, width: 20 }} /> Aprovar Proposta (mudei de ideia)
            </button>
          </div>
        )}

        {/* FOOTER */}
        <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 32, borderTop: '1px solid #e2e8f0', fontSize: 12, color: '#9ca3af' }}>
          <p>Trevo Legaliza · CNPJ 39.969.412/0001-70</p>
          <p style={{ marginTop: 4 }}>(11) 93492-7001 · administrativo@trevolegaliza.com.br</p>
        </div>
      </div>

      {/* MODAL APROVAÇÃO */}
      {showAprovacao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ ...cardStyle, maxWidth: 448, width: '100%' }}>
            <div style={cardPad}>
              <h3 style={{ ...fg, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Confirmar Aprovação</h3>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 16, textAlign: 'center', marginBottom: 16 }}>
                <p style={{ fontSize: 14, color: '#166534', fontWeight: 500 }}>Valor total da proposta</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: '#15803d', marginTop: 4 }}>
                  {totalTaxaMin > 0 || totalTaxaMax > 0
                    ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
                    : fmt(total)
                  }
                </p>
                <p style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>{itens.length} serviços incluídos</p>
              </div>
              <p style={{ ...muted, fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
                Ao aprovar, nossa equipe será notificada e entrará em contato para os próximos passos.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowAprovacao(false)}
                  disabled={processando}
                  style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151' }}
                >Cancelar</button>
                <button
                  onClick={handleAprovar}
                  disabled={processando}
                  style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: processando ? 0.7 : 1 }}
                >
                  {processando ? <Loader2 style={{ height: 16, width: 16 }} className="animate-spin" /> : <CheckCircle style={{ height: 16, width: 16 }} />}
                  Confirmar Aprovação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECUSA */}
      {showRecusa && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ ...cardStyle, maxWidth: 448, width: '100%' }}>
            <div style={cardPad}>
              <h3 style={{ ...fg, fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Recusar Proposta</h3>
              <p style={{ ...muted, fontSize: 14, marginBottom: 16 }}>
                Lamentamos. Por favor, nos diga o motivo para que possamos melhorar nossas propostas.
              </p>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Motivo da recusa *</label>
                <textarea
                  value={motivoRecusa}
                  onChange={e => setMotivoRecusa(e.target.value)}
                  placeholder="Ex: Valor acima do orçamento, optamos por outro fornecedor, etc."
                  rows={3}
                  style={{ width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', outline: 'none', color: '#1a1a2e' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={() => setShowRecusa(false)}
                  disabled={processando}
                  style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 14, color: '#374151' }}
                >Cancelar</button>
                <button
                  onClick={handleRecusar}
                  disabled={processando || !motivoRecusa.trim()}
                  style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 14, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: (processando || !motivoRecusa.trim()) ? 0.7 : 1 }}
                >
                  {processando ? <Loader2 style={{ height: 16, width: 16 }} className="animate-spin" /> : <XCircle style={{ height: 16, width: 16 }} />}
                  Confirmar Recusa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
