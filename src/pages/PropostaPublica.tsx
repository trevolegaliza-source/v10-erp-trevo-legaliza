import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle, Lock, Download, FileText } from 'lucide-react';
import { normalizeItem, type OrcamentoItem, type CenarioOrcamento } from '@/components/orcamentos/types';
import DOMPurify from 'dompurify';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const anonHeaders = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
};

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const fonts = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
`;

function buildStyles(accent: string, accentDark: string) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; background: #f1f5f9; color: #1e293b; -webkit-font-smoothing: antialiased; }
    .page { min-height: 100vh; background: #f1f5f9; padding-bottom: 100px; }
    .max { max-width: 700px; margin: 0 auto; padding: 0 16px; }

    /* HEADER */
    .header { background: #0f172a; padding: 20px 0; position: sticky; top: 0; z-index: 40; box-shadow: 0 1px 0 rgba(255,255,255,0.06); }
    .header-inner { max-width: 700px; margin: 0 auto; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; }
    .header-logo { display: flex; align-items: center; gap: 10px; }
    .header-logo-mark { width: 32px; height: 32px; background: ${accent}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .header-logo-name { font-size: 15px; font-weight: 700; color: #f8fafc; letter-spacing: -0.01em; }
    .header-logo-sub { font-size: 11px; color: #64748b; margin-top: 1px; }
    .header-badge { font-size: 11px; font-weight: 600; color: ${accent}; background: ${accent}18; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.04em; text-transform: uppercase; }

    /* HERO */
    .hero { background: #0f172a; padding: 48px 0 40px; border-bottom: 1px solid #1e293b; }
    .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; margin-bottom: 12px; }
    .hero-name { font-size: 36px; font-weight: 900; color: #f8fafc; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 8px; }
    .hero-cnpj { font-size: 13px; color: #475569; margin-bottom: 32px; }
    .hero-price-box { display: inline-block; background: linear-gradient(135deg, ${accent}22 0%, ${accent}08 100%); border: 1px solid ${accent}44; border-radius: 16px; padding: 24px 32px; }
    .hero-price-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${accent}; margin-bottom: 8px; }
    .hero-price { font-size: 40px; font-weight: 900; color: ${accent}; line-height: 1; letter-spacing: -0.02em; }
    .hero-meta { display: flex; gap: 20px; margin-top: 24px; }
    .hero-meta-item { font-size: 12px; color: #475569; display: flex; align-items: center; gap: 6px; }
    .hero-meta-dot { width: 4px; height: 4px; border-radius: 50%; background: ${accent}; flex-shrink: 0; }

    /* CONTENT */
    .content { padding: 32px 0; display: flex; flex-direction: column; gap: 20px; }

    /* CARD */
    .card { background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
    .card-header { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 10px; }
    .card-header-icon { width: 28px; height: 28px; border-radius: 8px; background: ${accent}14; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .card-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; }
    .card-body { padding: 20px; }

    /* RISK CARD */
    .card-risk { background: #fff5f5; border-color: #fecaca; }
    .card-risk .card-header { background: #fff5f5; border-bottom-color: #fecaca; }
    .card-risk .card-title { color: #ef4444; }
    .card-risk .card-header-icon { background: #fee2e2; }

    /* SECTION LABEL */
    .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #94a3b8; padding: 0 0 8px; }

    /* SERVICE ITEM */
    .service-item { border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
    .service-item + .service-item { margin-top: 10px; }
    .service-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; background: #f8fafc; }
    .service-num { width: 22px; height: 22px; border-radius: 6px; background: ${accent}18; color: ${accent}; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .service-name { font-size: 14px; font-weight: 600; color: #1e293b; margin-left: 10px; flex: 1; }
    .service-price { font-size: 15px; font-weight: 700; color: #1e293b; }
    .service-body { padding: 10px 16px 12px; font-size: 13px; color: #475569; line-height: 1.6; border-top: 1px solid #f1f5f9; }
    .service-meta { display: flex; justify-content: space-between; padding: 8px 16px; background: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; }
    .service-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 6px; }
    .badge-optional { background: #fef9c3; color: #ca8a04; }
    .badge-cenario { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* FLOW */
    .flow-steps { display: flex; align-items: flex-start; gap: 0; overflow-x: auto; padding-bottom: 4px; }
    .flow-step { display: flex; align-items: flex-start; gap: 0; flex-shrink: 0; }
    .flow-step-inner { display: flex; flex-direction: column; align-items: center; text-align: center; width: 96px; }
    .flow-circle { width: 36px; height: 36px; border-radius: 50%; background: ${accent}; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
    .flow-label { font-size: 12px; font-weight: 500; color: #374151; margin-top: 8px; line-height: 1.3; }
    .flow-sublabel { font-size: 10px; color: #94a3b8; margin-top: 3px; }
    .flow-arrow { color: #cbd5e1; margin-top: 18px; font-size: 16px; padding: 0 4px; }

    /* BENEFITS */
    .benefits-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .benefit-item { padding: 16px 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; text-align: center; }
    .benefit-item.featured { background: ${accent}0c; border-color: ${accent}30; }
    .benefit-icon { font-size: 26px; margin-bottom: 10px; }
    .benefit-title { font-size: 13px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .benefit-desc { font-size: 11px; color: #64748b; line-height: 1.4; }

    /* TOTALS */
    .totals { display: flex; flex-direction: column; gap: 8px; }
    .total-row { display: flex; justify-content: space-between; font-size: 14px; align-items: center; }
    .total-row .label { color: #64748b; }
    .total-row .value { font-weight: 500; color: #1e293b; }
    .total-row.discount .value { color: #ef4444; }
    .total-row.taxes .value { color: #f59e0b; }
    .total-final { display: flex; justify-content: space-between; align-items: center; padding: 18px 20px; margin-top: 12px; border-radius: 12px; background: linear-gradient(135deg, ${accent}10 0%, ${accent}04 100%); border: 2px solid ${accent}30; }
    .total-final-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${accent}; }
    .total-final-value { font-size: 28px; font-weight: 900; color: ${accentDark}; letter-spacing: -0.02em; }

    /* CONDITIONS */
    .conditions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .condition-item { background: #f8fafc; border-radius: 10px; padding: 14px; }
    .condition-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 6px; }
    .condition-value { font-size: 14px; font-weight: 600; color: #1e293b; line-height: 1.4; }
    .obs-box { margin-top: 12px; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 12px; font-size: 13px; color: #92400e; line-height: 1.6; }

    /* PACKAGES */
    .package-item { border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
    .package-item + .package-item { margin-top: 12px; }
    .package-item.featured { border: 2px solid ${accent}; }
    .package-header { padding: 14px 16px; background: #0f172a; display: flex; justify-content: space-between; align-items: center; }
    .package-name { font-size: 15px; font-weight: 700; color: #f8fafc; }
    .package-discount { font-size: 12px; color: ${accent}; font-weight: 600; background: ${accent}22; padding: 2px 8px; border-radius: 6px; }
    .package-badge { font-size: 10px; font-weight: 700; color: #f8fafc; background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 4px; letter-spacing: 0.04em; }
    .package-items { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    .package-service { font-size: 12px; color: #475569; padding: 3px 0; display: flex; align-items: center; gap: 6px; }
    .package-service::before { content: '✓'; color: ${accent}; font-weight: 700; font-size: 11px; }
    .package-pricing { padding: 12px 16px; background: #f8fafc; display: flex; flex-direction: column; gap: 4px; }
    .package-old-price { display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
    .package-old-price span:last-child { text-decoration: line-through; }
    .package-new-price { display: flex; justify-content: space-between; font-size: 14px; font-weight: 700; color: ${accent}; }
    .package-saving { text-align: right; font-size: 11px; color: #16a34a; font-weight: 600; }

    /* STICKY CTA */
    .sticky-cta { position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; background: #ffffff; border-top: 1px solid #e2e8f0; padding: 12px 16px; display: flex; gap: 10px; align-items: center; box-shadow: 0 -4px 24px rgba(0,0,0,0.08); }
    .btn-approve { flex: 1; height: 52px; background: linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%); color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; letter-spacing: -0.01em; transition: opacity 0.15s; box-shadow: 0 4px 16px ${accent}44; }
    .btn-approve:hover { opacity: 0.92; }
    .btn-approve:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-reject { height: 52px; width: 52px; background: #fff; color: #ef4444; border: 1px solid #fecaca; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s; }
    .btn-reject:hover { background: #fef2f2; }

    /* MODAL */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; justify-content: center; z-index: 60; padding: 0; }
    @media (min-width: 480px) { .modal-overlay { align-items: center; padding: 16px; } }
    .modal { background: #fff; width: 100%; max-width: 440px; border-radius: 20px 20px 0 0; padding: 28px 24px 32px; }
    @media (min-width: 480px) { .modal { border-radius: 20px; } }
    .modal-handle { width: 36px; height: 4px; background: #e2e8f0; border-radius: 2px; margin: 0 auto 20px; }
    .modal-title { font-size: 18px; font-weight: 800; color: #1e293b; margin-bottom: 4px; letter-spacing: -0.01em; }
    .modal-sub { font-size: 13px; color: #64748b; margin-bottom: 20px; }
    .modal-value-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 20px; }
    .modal-value-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #16a34a; margin-bottom: 4px; }
    .modal-value { font-size: 28px; font-weight: 900; color: #15803d; letter-spacing: -0.02em; }
    .modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
    .btn-cancel { padding: 10px 18px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer; }
    .btn-confirm { padding: 10px 20px; border: none; border-radius: 10px; background: #16a34a; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-confirm.red { background: #dc2626; }
    .btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
    .textarea-field { width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 14px; resize: vertical; outline: none; color: #1e293b; font-family: inherit; line-height: 1.5; }
    .textarea-field:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}18; }
    .form-label { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px; display: block; }

    /* DOWNLOAD BAR */
    .download-bar { display: flex; gap: 8px; padding: 12px 20px; background: #f8fafc; border-top: 1px solid #f1f5f9; }
    .btn-download { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #475569; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .btn-download:hover { background: #f1f5f9; border-color: #cbd5e1; color: #1e293b; }

    /* FOOTER */
    .footer { text-align: center; padding: 32px 20px 24px; border-top: 1px solid #e2e8f0; margin-top: 8px; }
    .footer-name { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 6px; }
    .footer-info { font-size: 11px; color: #94a3b8; line-height: 1.8; }

    /* ALERT CARDS */
    .alert-rascunho { background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px 20px; text-align: center; font-size: 14px; color: #92400e; font-weight: 500; }

    /* STATUS FINAL */
    .status-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; padding: 16px; }
    .status-card { background: #fff; border-radius: 20px; padding: 40px 32px; max-width: 400px; width: 100%; text-align: center; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .status-icon { margin: 0 auto 20px; }
    .status-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
    .status-desc { font-size: 14px; color: #64748b; line-height: 1.6; }
    .btn-review { margin-top: 20px; padding: 10px 20px; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #374151; font-size: 14px; cursor: pointer; }

    /* PASSWORD */
    .pw-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9; padding: 16px; }
    .pw-card { background: #fff; border-radius: 20px; padding: 36px 28px; max-width: 360px; width: 100%; border: 1px solid #e2e8f0; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .pw-icon { margin: 0 auto 16px; width: 52px; height: 52px; background: #f1f5f9; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .pw-title { font-size: 18px; font-weight: 800; color: #1e293b; text-align: center; margin-bottom: 6px; letter-spacing: -0.01em; }
    .pw-sub { font-size: 13px; color: #64748b; text-align: center; margin-bottom: 24px; }
    .pw-input { width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 15px; outline: none; color: #1e293b; margin-bottom: 8px; font-family: inherit; }
    .pw-input:focus { border-color: ${accent}; box-shadow: 0 0 0 3px ${accent}18; }
    .pw-error { font-size: 12px; color: #ef4444; margin-bottom: 10px; }
    .btn-pw { width: 100%; padding: 13px; background: ${accent}; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; }

    @media (max-width: 480px) {
      .hero-name { font-size: 26px; }
      .hero-price { font-size: 30px; }
      .hero-price-box { padding: 18px 20px; }
      .benefits-grid { grid-template-columns: 1fr 1fr; }
      .conditions-grid { grid-template-columns: 1fr; }
      .total-final-value { font-size: 22px; }
    }
  `;
}

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

  // Force light theme
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    return () => {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    if (!token) { setError('Link inválido'); setLoading(false); return; }
    (async () => {
      try {
        const response = await fetch(
          `${SUPABASE_URL}/rest/v1/rpc/get_proposta_por_token`,
          { method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token }) }
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
        if (orcData.destinatario === 'contador' && orcData.has_password) {
          setSenhaRequerida(true);
        } else {
          setAutenticado(true);
        }
        const rawItens = Array.isArray(orcData.servicos) ? orcData.servicos.map(normalizeItem) : [];
        setItens(rawItens);
        setOrc(orcData);
        fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
          method: 'POST',
          headers: anonHeaders,
          body: JSON.stringify({ p_orcamento_id: orcData.id, p_tipo: 'visualizou', p_dados: { token } }),
        }).catch(() => {});
        setLoading(false);
      } catch (err) {
        setError('Erro ao carregar proposta.');
        setLoading(false);
      }
    })();
  }, [token]);

  async function verificarSenha() {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/rpc/verificar_senha_proposta`,
        { method: 'POST', headers: anonHeaders, body: JSON.stringify({ p_token: token, p_senha: senhaInput }) }
      );
      const result = await response.json();
      if (result === true) { setAutenticado(true); setSenhaErro(false); }
      else setSenhaErro(true);
    } catch { setSenhaErro(true); }
  }

  const modoPDF = orc?.destinatario === 'cliente_direto' ? 'direto' : orc?.destinatario === 'cliente_via_contador' ? 'cliente' : 'contador';
  const isContador = modoPDF === 'contador';
  const accent = isContador ? '#22c55e' : '#3b82f6';
  const accentDark = isContador ? '#16a34a' : '#2563eb';
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
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/atualizar_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_status: 'aprovado' }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_notificacao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({
          p_orcamento_id: orc.id,
          p_tipo: 'aprovacao',
          p_mensagem: `${orc.prospect_nome} aprovou a proposta #${String(orc.numero).padStart(3, '0')} no valor de ${fmt(total)}. Aguardando pagamento.`,
        }),
      });
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_orcamento_id: orc.id, p_tipo: 'aprovou', p_dados: { total, itens_count: itens.length } }),
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
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/atualizar_proposta_por_token`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_token: token, p_status: 'recusado', p_motivo: motivoRecusa }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_notificacao_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({
          p_orcamento_id: orc.id,
          p_tipo: 'recusa',
          p_mensagem: `${orc.prospect_nome} recusou a proposta #${String(orc.numero).padStart(3, '0')}. Motivo: ${motivoRecusa}`,
        }),
      });
      fetch(`${SUPABASE_URL}/rest/v1/rpc/criar_evento_proposta`, {
        method: 'POST', headers: anonHeaders,
        body: JSON.stringify({ p_orcamento_id: orc.id, p_tipo: 'recusou', p_dados: { motivo: motivoRecusa } }),
      }).catch(() => {});
      setStatusFinal('recusado');
      setShowRecusa(false);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessando(false);
    }
  }

  function handleDownloadHTML() {
    if (!orc) return;
    const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
    const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
    const beneficios = Array.isArray(orc?.beneficios_capa) ? orc.beneficios_capa : [];
    const pacotes = Array.isArray(orc?.pacotes) ? orc.pacotes.filter((p: any) => p.nome && p.itens_ids?.length > 0) : [];
    const nomeDisplay = isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza');
    const num = String(orc.numero).padStart(3, '0');
    const data = new Date(orc.created_at).toLocaleDateString('pt-BR');

    const itensHtml = itens.filter(i => i.descricao.trim()).map((item, idx) => {
      const valorExibido = isContador ? item.honorario : (item.honorario_minimo_contador || item.honorario);
      const valorTotal = valorExibido * item.quantidade;
      const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
      return `
        <div style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:#f8fafc;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="width:20px;height:20px;border-radius:5px;background:${accent}18;color:${accent};font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;">${idx + 1}</span>
              <span style="font-size:14px;font-weight:600;color:#1e293b;">${item.descricao}</span>
              ${item.isOptional ? '<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;background:#fef9c3;color:#ca8a04;margin-left:6px;">Opcional</span>' : ''}
            </div>
            <span style="font-size:14px;font-weight:700;color:#1e293b;">${fmt(valorTotal)}</span>
          </div>
          ${item.detalhes ? `<div style="padding:8px 14px;font-size:12px;color:#475569;border-top:1px solid #f1f5f9;">${DOMPurify.sanitize(item.detalhes)}</div>` : ''}
          ${(item.prazo || hasTaxa) ? `<div style="padding:8px 14px;background:#f8fafc;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;">${item.prazo ? `<span>Prazo: ${item.prazo}</span>` : ''} ${hasTaxa ? `<span style="color:#f59e0b;">Taxas: ${fmt(item.taxa_min)} a ${fmt(item.taxa_max)}</span>` : ''}</div>` : ''}
        </div>`;
    }).join('');

    const totalStr = (totalTaxaMin > 0 || totalTaxaMax > 0)
      ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
      : fmt(total);

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta #${num} — ${orc.prospect_nome}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f1f5f9; color: #1e293b; -webkit-font-smoothing: antialiased; }
  .page { max-width: 680px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 40px rgba(0,0,0,0.10); }
  .header { background: #0f172a; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
  .header-name { font-size: 16px; font-weight: 700; color: #f8fafc; }
  .header-badge { font-size: 11px; font-weight: 600; color: ${accent}; background: ${accent}22; padding: 4px 10px; border-radius: 20px; letter-spacing: 0.04em; }
  .hero { background: #0f172a; padding: 40px 32px; border-bottom: 1px solid #1e293b; }
  .hero-label { font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: ${accent}; margin-bottom: 10px; }
  .hero-name { font-size: 32px; font-weight: 900; color: #f8fafc; letter-spacing: -0.02em; margin-bottom: 6px; }
  .hero-cnpj { font-size: 13px; color: #475569; margin-bottom: 28px; }
  .hero-box { display: inline-block; background: ${accent}18; border: 1px solid ${accent}44; border-radius: 14px; padding: 20px 28px; }
  .hero-box-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; margin-bottom: 6px; }
  .hero-box-value { font-size: 36px; font-weight: 900; color: ${accent}; letter-spacing: -0.02em; }
  .hero-meta { margin-top: 20px; font-size: 12px; color: #475569; display: flex; gap: 20px; }
  .section { padding: 28px 32px; border-top: 1px solid #f1f5f9; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 16px; }
  .total-final { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-radius: 12px; background: ${accent}0c; border: 2px solid ${accent}30; margin-top: 12px; }
  .total-final-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${accent}; }
  .total-final-value { font-size: 26px; font-weight: 900; color: ${accentDark}; letter-spacing: -0.02em; }
  .footer { padding: 28px 32px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.8; }
  .footer-name { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 6px; }
  @media print { body { background: white; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-name">🍀 ${nomeDisplay}</div>
    <div class="header-badge">Proposta #${num}</div>
  </div>
  <div class="hero">
    <div class="hero-label">Proposta Comercial · ${data}</div>
    <div class="hero-name">${orc.prospect_nome}</div>
    ${orc.prospect_cnpj && orc.prospect_cnpj !== '0000000000' && orc.prospect_cnpj !== '00000000000000' ? `<div class="hero-cnpj">CNPJ: ${orc.prospect_cnpj}</div>` : ''}
    <div class="hero-box">
      <div class="hero-box-label">Investimento Estimado</div>
      <div class="hero-box-value">${totalStr}</div>
    </div>
    <div class="hero-meta">
      <span>📋 ${itens.filter(i => i.descricao.trim()).length} serviços</span>
      <span>⏱️ Válido por ${orc.validade_dias} dias</span>
    </div>
  </div>
  ${orc.contexto ? `<div class="section"><div class="section-title">Cenário e Oportunidade</div>${orc.headline_cenario ? `<p style="font-size:15px;font-weight:600;color:#1e293b;margin-bottom:10px;">${orc.headline_cenario}</p>` : ''}<div style="font-size:14px;line-height:1.6;color:#374151;">${DOMPurify.sanitize(orc.contexto)}</div></div>` : ''}
  ${riscos.length > 0 ? `<div class="section" style="background:#fff5f5;"><div class="section-title" style="color:#ef4444;">⛔ Riscos Sem Regularização</div><ul style="list-style:none;display:flex;flex-direction:column;gap:6px;">${riscos.map((r: any) => `<li style="font-size:13px;color:#b91c1c;">• ${r.penalidade}${r.condicao ? `: ${r.condicao}` : ''}</li>`).join('')}</ul></div>` : ''}
  <div class="section"><div class="section-title">Escopo dos Serviços</div>${itensHtml}</div>
  <div class="section">
    <div class="section-title">Resumo do Investimento</div>
    ${orc.desconto_pct > 0 ? `<div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:6px;"><span style="color:#64748b;">Honorários</span><span>${fmt(subtotal)}</span></div><div style="display:flex;justify-content:space-between;font-size:14px;color:#ef4444;margin-bottom:6px;"><span>Desconto (${orc.desconto_pct}%)</span><span>- ${fmt(desconto)}</span></div>` : ''}
    ${(totalTaxaMin > 0 || totalTaxaMax > 0) ? `<div style="display:flex;justify-content:space-between;font-size:14px;color:#f59e0b;margin-bottom:6px;"><span>Taxas estimadas</span><span>${fmt(totalTaxaMin)} a ${fmt(totalTaxaMax)}</span></div>` : ''}
    <div class="total-final"><span class="total-final-label">Total</span><span class="total-final-value">${totalStr}</span></div>
  </div>
  <div class="section">
    <div class="section-title">Condições</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:#f8fafc;border-radius:10px;padding:14px;"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">Validade</div><div style="font-size:14px;font-weight:600;">${orc.validade_dias} dias</div></div>
      <div style="background:#f8fafc;border-radius:10px;padding:14px;"><div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#94a3b8;margin-bottom:6px;">Pagamento</div><div style="font-size:14px;font-weight:600;">${orc.pagamento || 'A combinar'}</div></div>
    </div>
    ${orc.observacoes ? `<div style="margin-top:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px;font-size:13px;color:#92400e;line-height:1.6;">${DOMPurify.sanitize(orc.observacoes)}</div>` : ''}
  </div>
  <div class="footer">
    <div class="footer-name">${isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza')}</div>
    ${isContador ? `<div>CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP</div><div>(11) 93492-7001 · administrativo@trevolegaliza.com.br · trevolegaliza.com.br</div><div style="margin-top:6px;font-style:italic;font-size:10px;">Desde 2018 · Referência nacional em regularização empresarial · 27 estados</div>` : `<div>CNPJ 39.969.412/0001-70</div><div>(11) 93492-7001 · administrativo@trevolegaliza.com.br</div>`}
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
    a.href = url;
    a.download = `Proposta_${nome}_${num}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownloadPDF() {
    if (!orc) return;
    try {
      const { gerarOrcamentoPDF, downloadBlob } = await import('@/lib/orcamento-pdf');
      const { normalizeItem: ni, DEFAULT_SECOES } = await import('@/components/orcamentos/types');
      const itensNorm = itens.map(ni);
      const sub = itensNorm.reduce((s: number, i: any) => s + (Number(i.honorario) || 0) * (Number(i.quantidade) || 1), 0);
      const desc2 = sub * ((orc.desconto_pct || 0) / 100);
      const hasDetailed = itensNorm.some((i: any) => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const doc = await gerarOrcamentoPDF({
        modo: hasDetailed || orc.contexto ? 'detalhado' : 'simples',
        modoPDF: modoPDF as any,
        destinatario: orc.destinatario,
        escritorioNome: escritorioNome,
        escritorioCnpj: orc.escritorio_cnpj || '',
        escritorioEmail: orc.escritorio_email || '',
        escritorioTelefone: orc.escritorio_telefone || '',
        clienteNome: escritorioNome,
        contadorNome: escritorioNome,
        contadorEmail: orc.escritorio_email || '',
        contadorTelefone: orc.escritorio_telefone || '',
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj,
        itens: itensNorm,
        pacotes: Array.isArray(orc.pacotes) ? orc.pacotes : [],
        secoes: Array.isArray(orc.secoes) && orc.secoes.length > 0 ? orc.secoes : [...DEFAULT_SECOES],
        contexto: orc.contexto || '',
        ordem_execucao: orc.ordem_execucao || '',
        desconto_pct: orc.desconto_pct || 0,
        subtotal: sub,
        total: sub - desc2,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento,
        observacoes: orc.observacoes,
        numero: orc.numero,
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
        riscos: Array.isArray(orc.riscos) ? orc.riscos : [],
        etapas_fluxo: Array.isArray(orc.etapas_fluxo) ? orc.etapas_fluxo : [],
        beneficios_capa: Array.isArray(orc.beneficios_capa) ? orc.beneficios_capa : [],
        headline_cenario: orc.headline_cenario || '',
        cenarios: Array.isArray(orc.cenarios) ? orc.cenarios : [],
      });
      const nome = (orc.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 40);
      downloadBlob(doc, `Proposta_${nome}_${String(orc.numero).padStart(3, '0')}.pdf`);
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
    }
  }

  // ─── LOADING ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9' }}>
        <Loader2 style={{ height: 28, width: 28, color: '#94a3b8' }} className="animate-spin" />
      </div>
    );
  }

  // ─── ERROR ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: '40px 32px', maxWidth: 400, width: '100%', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <XCircle style={{ height: 48, width: 48, color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', marginBottom: 8, letterSpacing: '-0.01em' }}>Proposta Indisponível</h2>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{error}</p>
        </div>
      </div>
    );
  }

  // ─── PASSWORD ──────────────────────────────────────────────────────────────
  if (senhaRequerida && !autenticado) {
    return (
      <>
        <style>{fonts}</style>
        <div className="pw-page">
          <style>{buildStyles('#22c55e', '#16a34a')}</style>
          <div className="pw-card">
            <div className="pw-icon"><Lock style={{ height: 24, width: 24, color: '#64748b' }} /></div>
            <div className="pw-title">Acesso Protegido</div>
            <div className="pw-sub">Insira a senha para visualizar esta proposta.</div>
            <input
              type="password"
              placeholder="Senha"
              value={senhaInput}
              onChange={e => { setSenhaInput(e.target.value); setSenhaErro(false); }}
              onKeyDown={e => e.key === 'Enter' && verificarSenha()}
              className="pw-input"
            />
            {senhaErro && <div className="pw-error">Senha incorreta. Tente novamente.</div>}
            <button onClick={verificarSenha} className="btn-pw">Acessar Proposta</button>
          </div>
        </div>
      </>
    );
  }

  // ─── STATUS FINAL ──────────────────────────────────────────────────────────
  if (statusFinal) {
    return (
      <>
        <style>{fonts}</style>
        <style>{buildStyles(accent, accentDark)}</style>
        <div className="status-page">
          <div className="status-card">
            {statusFinal === 'aprovado' ? (
              <>
                <CheckCircle className="status-icon" style={{ height: 56, width: 56, color: '#22c55e' }} />
                <div className="status-title" style={{ color: '#15803d' }}>Proposta Aprovada!</div>
                <div className="status-desc">Obrigado! Nossa equipe entrará em contato para os próximos passos.</div>
              </>
            ) : (
              <>
                <XCircle className="status-icon" style={{ height: 56, width: 56, color: '#ef4444' }} />
                <div className="status-title" style={{ color: '#dc2626' }}>Proposta Recusada</div>
                <div className="status-desc">Recebemos sua resposta. Caso mude de ideia, este link ainda estará disponível durante o prazo de validade.</div>
                {orc?.status === 'recusado' && (
                  <button className="btn-review" onClick={() => setStatusFinal(null)}>Revisar proposta novamente</button>
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  // ─── MAIN PROPOSAL ─────────────────────────────────────────────────────────
  const riscos = Array.isArray(orc?.riscos) ? orc.riscos : [];
  const etapasFluxo = Array.isArray(orc?.etapas_fluxo) ? orc.etapas_fluxo : [];
  const beneficios = Array.isArray(orc?.beneficios_capa) ? orc.beneficios_capa : [];
  const pacotes = Array.isArray(orc?.pacotes) ? orc.pacotes.filter((p: any) => p.nome && p.itens_ids?.length > 0) : [];
  const nomeDisplay = isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza');
  const totalStr = (totalTaxaMin > 0 || totalTaxaMax > 0)
    ? `${fmt(total + totalTaxaMin)} a ${fmt(total + totalTaxaMax)}`
    : fmt(total);

  return (
    <>
      <style>{fonts}</style>
      <style>{buildStyles(accent, accentDark)}</style>

      <div className="page" data-theme="light">

        {/* HEADER */}
        <div className="header">
          <div className="header-inner">
            <div className="header-logo">
              <div className="header-logo-mark">🍀</div>
              <div>
                <div className="header-logo-name">{nomeDisplay}</div>
                <div className="header-logo-sub">{isContador ? 'Painel do Parceiro' : 'Assessoria Empresarial'}</div>
              </div>
            </div>
            <div className="header-badge">Proposta #{String(orc?.numero || 0).padStart(3, '0')}</div>
          </div>
        </div>

        {/* HERO */}
        <div className="hero">
          <div className="max">
            <div className="hero-label">Proposta Comercial · {orc?.created_at ? new Date(orc.created_at).toLocaleDateString('pt-BR') : ''}</div>
            <div className="hero-name">{orc?.prospect_nome}</div>
            {orc?.prospect_cnpj && orc.prospect_cnpj !== '0000000000' && orc.prospect_cnpj !== '00000000000000' && (
              <div className="hero-cnpj">CNPJ: {orc.prospect_cnpj}</div>
            )}
            <div className="hero-price-box">
              <div className="hero-price-label">Investimento Estimado</div>
              <div className="hero-price">{totalStr}</div>
            </div>
            <div className="hero-meta">
              <span className="hero-meta-item"><span className="hero-meta-dot" />📋 {itens.filter(i => i.descricao.trim()).length} serviços</span>
              <span className="hero-meta-item"><span className="hero-meta-dot" />⏱️ Válido por {orc?.validade_dias} dias</span>
            </div>
          </div>
        </div>

        <div className="max">
          <div className="content">

            {/* CONTEXTO */}
            {orc?.contexto && (
              <div className="card">
                <div className="card-header">
                  <div className="card-header-icon">💡</div>
                  <div className="card-title">Cenário e Oportunidade</div>
                </div>
                <div className="card-body">
                  {orc.headline_cenario && (
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 12 }}>{orc.headline_cenario}</p>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.7, color: '#374151' }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.contexto || '') }} />
                </div>
              </div>
            )}

            {/* RISCOS */}
            {riscos.length > 0 && (
              <div className="card card-risk">
                <div className="card-header">
                  <div className="card-header-icon">⛔</div>
                  <div className="card-title">Riscos Sem Regularização</div>
                </div>
                <div className="card-body">
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
                    {riscos.map((r: any) => (
                      <li key={r.id} style={{ fontSize: 14, color: '#b91c1c', paddingLeft: 16, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0 }}>•</span>
                        {r.penalidade}{r.condicao ? `: ${r.condicao}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* BENEFÍCIOS */}
            {beneficios.length > 0 && (
              <div className="card">
                <div className="card-body" style={{ padding: 16 }}>
                  <div className="benefits-grid">
                    {beneficios.map((ben: any, idx: number) => {
                      const icons = ['🛡️', '📋', '⏱️'];
                      return (
                        <div key={ben.id} className={`benefit-item${idx === 1 ? ' featured' : ''}`}>
                          <div className="benefit-icon">{icons[idx % 3]}</div>
                          <div className="benefit-title">{ben.titulo}</div>
                          <div className="benefit-desc">{ben.descricao}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* FLUXO */}
            {etapasFluxo.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-header-icon">🔄</div>
                  <div className="card-title">Fluxo de Execução</div>
                </div>
                <div className="card-body">
                  <div className="flow-steps">
                    {etapasFluxo.map((e: any, i: number) => (
                      <div key={e.id} className="flow-step">
                        <div className="flow-step-inner">
                          <div className="flow-circle">{i === etapasFluxo.length - 1 ? '✓' : i + 1}</div>
                          <div className="flow-label">{e.nome}</div>
                          {e.prazo && <div className="flow-sublabel">{e.prazo}</div>}
                        </div>
                        {i < etapasFluxo.length - 1 && <div className="flow-arrow">→</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SERVIÇOS */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-icon">📋</div>
                <div className="card-title">Escopo dos Serviços</div>
              </div>
              <div className="card-body">
                {itens.filter(i => i.descricao.trim()).map((item, idx) => {
                  const valorExibido = isContador ? item.honorario : (item.honorario_minimo_contador || item.honorario);
                  const valorTotal = valorExibido * item.quantidade;
                  const hasTaxa = item.taxa_min > 0 || item.taxa_max > 0;
                  const cenario = temCenarios && item.cenarioId ? cenarios.find(c => c.id === item.cenarioId) : null;
                  const cenarioIdx = cenario ? cenarios.indexOf(cenario) : -1;
                  return (
                    <div key={item.id} className="service-item">
                      <div className="service-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                          <span className="service-num">{idx + 1}</span>
                          <span className="service-name">{item.descricao}</span>
                          {cenario && <span className="service-badge badge-cenario">{String.fromCharCode(65 + cenarioIdx)}</span>}
                          {item.isOptional && <span className="service-badge badge-optional">Opcional</span>}
                        </div>
                        <span className="service-price">{fmt(valorTotal)}</span>
                      </div>
                      {item.detalhes && (
                        <div className="service-body" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.detalhes || '') }} />
                      )}
                      {(item.prazo || hasTaxa) && (
                        <div className="service-meta">
                          {item.prazo && <span>Prazo: {item.prazo}</span>}
                          {hasTaxa && <span style={{ color: '#f59e0b' }}>Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* PACOTES */}
            {pacotes.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <div className="card-header-icon">📦</div>
                  <div className="card-title">Pacotes Disponíveis</div>
                </div>
                <div className="card-body">
                  {pacotes.map((pac: any) => {
                    const selected = itens.filter(i => pac.itens_ids.includes(i.id));
                    const valorKey = isContador ? 'honorario' : 'honorario_minimo_contador';
                    const precoSem = selected.reduce((s: number, i: any) => s + ((i[valorKey] || i.honorario || 0) * i.quantidade), 0);
                    const preco = precoSem * (1 - (pac.desconto_pct || 0) / 100);
                    const economia = precoSem - preco;
                    const featured = pac.nome.toLowerCase().includes('completo');
                    return (
                      <div key={pac.id} className={`package-item${featured ? ' featured' : ''}`}>
                        <div className="package-header">
                          <span className="package-name">{pac.nome}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {featured && <span className="package-badge">★ RECOMENDADO</span>}
                            <span className="package-discount">-{pac.desconto_pct}%</span>
                          </div>
                        </div>
                        <div className="package-items">
                          {selected.map((i: any) => <div key={i.id} className="package-service">{i.descricao}</div>)}
                        </div>
                        <div className="package-pricing">
                          <div className="package-old-price"><span>Sem desconto</span><span>{fmt(precoSem)}</span></div>
                          <div className="package-new-price"><span>Com -{pac.desconto_pct}%</span><span>{fmt(preco)}</span></div>
                          <div className="package-saving">↓ Economia de {fmt(economia)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RESUMO */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-icon">💰</div>
                <div className="card-title">Resumo do Investimento</div>
              </div>
              <div className="card-body">
                <div className="totals">
                  {(orc?.desconto_pct > 0 || totalTaxaMin > 0 || totalTaxaMax > 0) && (
                    <div className="total-row">
                      <span className="label">Honorários</span>
                      <span className="value">{fmt(subtotal)}</span>
                    </div>
                  )}
                  {orc?.desconto_pct > 0 && (
                    <div className="total-row discount">
                      <span className="label">Desconto ({orc.desconto_pct}%)</span>
                      <span className="value">- {fmt(desconto)}</span>
                    </div>
                  )}
                  {(totalTaxaMin > 0 || totalTaxaMax > 0) && (
                    <div className="total-row taxes">
                      <span className="label">Taxas estimadas</span>
                      <span className="value">{fmt(totalTaxaMin)} a {fmt(totalTaxaMax)}</span>
                    </div>
                  )}
                </div>
                <div className="total-final">
                  <span className="total-final-label">Total</span>
                  <span className="total-final-value">{totalStr}</span>
                </div>
              </div>
              {/* DOWNLOAD BAR */}
              <div className="download-bar">
                <button className="btn-download" onClick={handleDownloadHTML}>
                  <Download style={{ width: 14, height: 14 }} />
                  Salvar HTML
                </button>
                <button className="btn-download" onClick={handleDownloadPDF}>
                  <FileText style={{ width: 14, height: 14 }} />
                  Baixar PDF
                </button>
              </div>
            </div>

            {/* CONDIÇÕES */}
            <div className="card">
              <div className="card-header">
                <div className="card-header-icon">📄</div>
                <div className="card-title">Condições</div>
              </div>
              <div className="card-body">
                <div className="conditions-grid">
                  <div className="condition-item">
                    <div className="condition-label">Validade</div>
                    <div className="condition-value">{orc?.validade_dias} dias</div>
                  </div>
                  <div className="condition-item">
                    <div className="condition-label">Pagamento</div>
                    <div className="condition-value">{orc?.pagamento || 'A combinar'}</div>
                  </div>
                </div>
                {orc?.observacoes && (
                  <div className="obs-box" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(orc.observacoes || '') }} />
                )}
              </div>
            </div>

            {/* RASCUNHO WARNING */}
            {orc?.status === 'rascunho' && (
              <div className="alert-rascunho">
                Esta proposta ainda está sendo preparada. Você será notificado quando estiver pronta para aprovação.
              </div>
            )}

            {/* FOOTER */}
            <div className="footer">
              <div className="footer-name">{isContador ? 'Trevo Legaliza' : (escritorioNome || 'Trevo Legaliza')}</div>
              {isContador ? (
                <div className="footer-info">
                  <div>CNPJ 39.969.412/0001-70 · Rua Brasil, nº 1170, Rudge Ramos, SBC/SP</div>
                  <div>(11) 93492-7001 · administrativo@trevolegaliza.com.br · trevolegaliza.com.br</div>
                  <div style={{ marginTop: 8, fontStyle: 'italic', fontSize: 10 }}>Desde 2018 · Referência nacional em regularização empresarial · 27 estados</div>
                </div>
              ) : (
                <div className="footer-info">
                  <div>CNPJ 39.969.412/0001-70</div>
                  <div>(11) 93492-7001 · administrativo@trevolegaliza.com.br</div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* STICKY CTA */}
        {(orc?.status === 'enviado' || orc?.status === 'recusado') && (
          <div className="sticky-cta">
            <button className="btn-approve" onClick={() => setShowAprovacao(true)}>
              <CheckCircle style={{ height: 18, width: 18 }} />
              {orc?.status === 'recusado' ? 'Mudei de ideia — Aprovar' : 'Aprovar Proposta'}
            </button>
            {orc?.status === 'enviado' && (
              <button className="btn-reject" onClick={() => setShowRecusa(true)} title="Recusar proposta">
                <XCircle style={{ height: 20, width: 20 }} />
              </button>
            )}
          </div>
        )}

      </div>

      {/* MODAL APROVAÇÃO */}
      {showAprovacao && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAprovacao(false); }}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">Confirmar Aprovação</div>
            <div className="modal-sub">Ao aprovar, nossa equipe será notificada imediatamente.</div>
            <div className="modal-value-box">
              <div className="modal-value-label">Valor total</div>
              <div className="modal-value">{totalStr}</div>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowAprovacao(false)} disabled={processando}>Cancelar</button>
              <button className="btn-confirm" onClick={handleAprovar} disabled={processando}>
                {processando ? <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" /> : <CheckCircle style={{ height: 14, width: 14 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RECUSA */}
      {showRecusa && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowRecusa(false); }}>
          <div className="modal">
            <div className="modal-handle" />
            <div className="modal-title">Recusar Proposta</div>
            <div className="modal-sub">Informe o motivo para que possamos melhorar.</div>
            <label className="form-label">Motivo da recusa *</label>
            <textarea
              value={motivoRecusa}
              onChange={e => setMotivoRecusa(e.target.value)}
              placeholder="Ex: Valor acima do orçamento, optamos por outro fornecedor…"
              rows={3}
              className="textarea-field"
              style={{ marginBottom: 16 }}
            />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowRecusa(false)} disabled={processando}>Cancelar</button>
              <button className="btn-confirm red" onClick={handleRecusar} disabled={processando || !motivoRecusa.trim()}>
                {processando ? <Loader2 style={{ height: 14, width: 14 }} className="animate-spin" /> : <XCircle style={{ height: 14, width: 14 }} />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
