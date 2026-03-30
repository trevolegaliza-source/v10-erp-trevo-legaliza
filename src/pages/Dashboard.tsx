import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboardData, useCountUp } from '@/hooks/useDashboardData';
import { getNomeUsuario, getSaudacao } from '@/hooks/useDashboard';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, Clock, CheckCircle, Activity, TrendingUp, TrendingDown,
  AlertTriangle, FileText, Send, PauseCircle, ChevronRight, Check,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

import type { LucideIcon } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Alerta {
  id: string;
  titulo: string;
  descricao: string;
  severity: 'critical' | 'warning' | 'info';
  icon: LucideIcon;
  link: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useDashboardData();

  const calc = useMemo(() => {
    if (!data) return null;
    const { lancamentosMes, lancamentosMesAnterior, processos, proximosVencimentos, lancamentosHistorico } = data;

    const totalFaturado = lancamentosMes.reduce((s, l) => s + Number(l.valor), 0);
    const totalRecebido = lancamentosMes
      .filter(l => l.status === 'pago' && l.confirmado_recebimento === true && l.data_pagamento != null)
      .reduce((s, l) => s + Number(l.valor), 0);
    const totalPendente = totalFaturado - totalRecebido;
    const taxaRecebimento = totalFaturado > 0 ? Math.round(totalRecebido / totalFaturado * 100) : 0;

    const totalFatAnt = lancamentosMesAnterior.reduce((s, l) => s + Number(l.valor), 0);
    const variacaoReceita = totalFatAnt > 0
      ? Math.round((totalFaturado - totalFatAnt) / totalFatAnt * 100)
      : totalFaturado > 0 ? 100 : 0;

    const processosAtivos = processos.filter(p => !['finalizados', 'arquivo'].includes(p.etapa)).length;
    const seteDiasAtras = new Date(); seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    const processosNovos = processos.filter(p => new Date(p.created_at || '') >= seteDiasAtras).length;

    // Alertas
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alertas: Alerta[] = [];

    const vencidas = lancamentosMes.filter(l => {
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      return venc < hoje && l.status !== 'pago';
    });
    if (vencidas.length > 0) {
      const valorVencido = vencidas.reduce((s, l) => s + Number(l.valor), 0);
      alertas.push({ id: 'vencidas', titulo: `${vencidas.length} cobranças vencidas`, descricao: `${fmt(valorVencido)} em atraso`, severity: 'critical', icon: AlertTriangle, link: '/financeiro?tab=vencidos' });
    }

    const semExtrato = lancamentosMes.filter(l => !l.extrato_id && l.etapa_financeiro === 'solicitacao_criada');
    const clientesSemExtrato = new Set(semExtrato.map(l => l.cliente_id)).size;
    if (clientesSemExtrato > 0) {
      alertas.push({ id: 'sem_extrato', titulo: `${clientesSemExtrato} clientes sem extrato`, descricao: 'Processos aguardando geração de extrato', severity: 'warning', icon: FileText, link: '/financeiro?tab=cobrar' });
    }

    const naoEnviados = lancamentosMes.filter(l => l.etapa_financeiro === 'cobranca_gerada');
    const clientesNaoEnviados = new Set(naoEnviados.map(l => l.cliente_id)).size;
    if (clientesNaoEnviados > 0) {
      alertas.push({ id: 'nao_enviadas', titulo: `${clientesNaoEnviados} extratos não enviados`, descricao: 'Extratos gerados aguardando envio', severity: 'warning', icon: Send, link: '/financeiro?tab=enviados' });
    }

    const parados = processos.filter(p => {
      const dias = Math.floor((Date.now() - new Date(p.updated_at || p.created_at || '').getTime()) / 86400000);
      return dias >= 7 && !['finalizados', 'arquivo'].includes(p.etapa);
    });
    if (parados.length > 0) {
      alertas.push({ id: 'parados', titulo: `${parados.length} processos parados`, descricao: 'Sem movimentação há 7+ dias', severity: 'info', icon: PauseCircle, link: '/processos' });
    }

    // Pipeline
    const fases = [
      { id: 'entrada', nome: 'Entrada', etapas: ['recebidos', 'analise_documental'], cor: 'bg-blue-500' },
      { id: 'andamento', nome: 'Em andamento', etapas: ['contrato', 'viabilidade', 'dbe', 'vre', 'em_analise'], cor: 'bg-teal-500' },
      { id: 'pendencias', nome: 'Pendências', etapas: ['aguardando_pagamento', 'taxa_paga', 'assinaturas', 'assinado'], cor: 'bg-amber-500' },
      { id: 'finalizacao', nome: 'Finalização', etapas: ['registro', 'mat', 'inscricao_me', 'alvaras', 'conselho'], cor: 'bg-purple-500' },
      { id: 'concluido', nome: 'Concluídos', etapas: ['finalizados'], cor: 'bg-green-500' },
    ].map(f => ({ ...f, qtd: processos.filter(p => f.etapas.includes(p.etapa)).length }));

    // Gráfico 6 meses
    const dadosMensais: { mes: string; recebido: number; pendente: number }[] = [];
    const agora = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const mes = d.getMonth();
      const ano = d.getFullYear();
      const label = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(ano).slice(2);
      const lancMes = lancamentosHistorico.filter(l => {
        const ld = new Date(l.data_vencimento || l.created_at || '');
        return ld.getMonth() === mes && ld.getFullYear() === ano;
      });
      const fat = lancMes.reduce((s, l) => s + Number(l.valor), 0);
      const rec = lancMes.filter(l => l.status === 'pago' && l.confirmado_recebimento === true).reduce((s, l) => s + Number(l.valor), 0);
      dadosMensais.push({ mes: label, recebido: rec, pendente: fat - rec });
    }

    // Top clientes
    const clienteMap: Record<string, { nome: string; total: number; qtd: number; clienteId: string; temVencido: boolean; temExtrato: boolean }> = {};
    lancamentosMes.forEach(l => {
      if (!l.cliente_id) return;
      if (!clienteMap[l.cliente_id]) {
        const c = l.clientes as any;
        clienteMap[l.cliente_id] = { nome: c?.apelido || c?.nome || '—', total: 0, qtd: 0, clienteId: l.cliente_id, temVencido: false, temExtrato: false };
      }
      clienteMap[l.cliente_id].total += Number(l.valor);
      clienteMap[l.cliente_id].qtd++;
      if (l.status === 'pago') clienteMap[l.cliente_id].temExtrato = true;
      const venc = new Date(l.data_vencimento + 'T00:00:00');
      if (venc < hoje && l.status !== 'pago') clienteMap[l.cliente_id].temVencido = true;
      if (l.extrato_id) clienteMap[l.cliente_id].temExtrato = true;
    });
    const topClientes = Object.values(clienteMap).sort((a, b) => b.total - a.total).slice(0, 5).map(c => ({
      ...c,
      status: c.temVencido ? 'vencido' as const : c.temExtrato ? 'pendente' as const : 'sem_extrato' as const,
    }));

    return {
      totalFaturado, totalRecebido, totalPendente, taxaRecebimento, variacaoReceita,
      processosAtivos, processosNovos,
      alertas, fases, dadosMensais, topClientes,
      proximosVencimentos: proximosVencimentos.map(v => ({
        ...v,
        cliente_nome: (v.clientes as any)?.nome || '—',
        cliente_apelido: (v.clientes as any)?.apelido || null,
      })),
    };
  }, [data]);

  const animFaturado = useCountUp(calc?.totalFaturado ?? 0);
  const animPendente = useCountUp(calc?.totalPendente ?? 0);
  const animRecebido = useCountUp(calc?.totalRecebido ?? 0);
  const animAtivos = useCountUp(calc?.processosAtivos ?? 0, 500);

  if (isLoading || !calc) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  const { alertas, fases, dadosMensais, topClientes, proximosVencimentos, variacaoReceita, taxaRecebimento, processosNovos } = calc;
  const totalPipeline = fases.reduce((s, f) => s + f.qtd, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="dashboard-section">
        <h1 className="text-2xl font-bold text-foreground">
          {getSaudacao()}, {getNomeUsuario(user?.email)} <span className="animate-trevo-wave">🍀</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* SEÇÃO 1: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 dashboard-section">
        {/* Receita */}
        <Card className="p-5 cursor-pointer group hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 transition-all duration-300" onClick={() => navigate('/financeiro')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Receita do mês</span>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{fmt(animFaturado)}</p>
          <div className="flex items-center gap-1 mt-2">
            {variacaoReceita >= 0 ? <TrendingUp className="h-3 w-3 text-green-500" /> : <TrendingDown className="h-3 w-3 text-destructive" />}
            <span className={`text-xs ${variacaoReceita >= 0 ? 'text-green-500' : 'text-destructive'}`}>
              {variacaoReceita >= 0 ? '+' : ''}{variacaoReceita}% vs mês anterior
            </span>
          </div>
        </Card>

        {/* A Receber */}
        <Card className="p-5 cursor-pointer group hover:-translate-y-1 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300" onClick={() => navigate('/financeiro')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">A receber</span>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-500">{fmt(animPendente)}</p>
          <p className="text-xs text-muted-foreground mt-2">pendente de confirmação</p>
        </Card>

        {/* Recebido */}
        <Card className="p-5 group hover:-translate-y-1 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Recebido</span>
            <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-green-500">{fmt(animRecebido)}</p>
          <div className="w-full bg-muted rounded-full h-2 mt-2">
            <div className="bg-green-500 h-2 rounded-full transition-all duration-500" style={{ width: `${taxaRecebimento}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">{taxaRecebimento}% do faturado</p>
        </Card>

        {/* Processos Ativos */}
        <Card className="p-5 cursor-pointer group hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300" onClick={() => navigate('/processos')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Processos ativos</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight text-foreground">{animAtivos}</p>
          <p className="text-xs text-muted-foreground mt-2">{processosNovos} novos esta semana</p>
        </Card>
      </div>

      {/* SEÇÃO 2: Ações Urgentes */}
      <div className="space-y-2 dashboard-section">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações urgentes</h3>
        {alertas.length === 0 ? (
          <Card className="p-4 border-green-500/30 bg-green-500/5">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">Tudo em dia!</p>
                <p className="text-xs text-muted-foreground">Nenhuma ação urgente no momento.</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alertas.map(alerta => {
              const colors = {
                critical: { border: 'border-destructive/30 bg-destructive/5', circle: 'bg-destructive/20', icon: 'text-destructive' },
                warning: { border: 'border-amber-500/30 bg-amber-500/5', circle: 'bg-amber-500/20', icon: 'text-amber-500' },
                info: { border: 'border-blue-500/30 bg-blue-500/5', circle: 'bg-blue-500/20', icon: 'text-blue-500' },
              }[alerta.severity];
              return (
                <Card key={alerta.id} className={`p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-200 ${colors.border}`} onClick={() => navigate(alerta.link)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${colors.circle}`}>
                        <alerta.icon className={`h-4 w-4 ${colors.icon}`} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{alerta.titulo}</p>
                        <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO 3: Pipeline */}
      {totalPipeline > 0 && (
        <div className="space-y-3 dashboard-section">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline de processos</h3>
          <div className="flex gap-0.5 h-8 rounded-lg overflow-hidden">
            {fases.filter(f => f.qtd > 0).map(fase => (
              <div
                key={fase.id}
                className={`flex items-center justify-center cursor-pointer transition-opacity hover:opacity-80 ${fase.cor}`}
                style={{ flex: fase.qtd }}
                onClick={() => navigate('/processos')}
                title={`${fase.nome}: ${fase.qtd}`}
              >
                <span className="text-[10px] font-bold text-white drop-shadow-sm">{fase.qtd}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {fases.map(fase => (
              <span key={fase.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${fase.cor}`} />
                {fase.nome} ({fase.qtd})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SEÇÃO 4: Gráfico de Receita */}
      <div className="space-y-3 dashboard-section">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Receita mensal</h3>
        <Card className="p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dadosMensais} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} className="fill-muted-foreground" tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: number, name: string) => [fmt(value), name === 'recebido' ? 'Recebido' : 'Pendente']}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '13px' }}
              />
              <Bar dataKey="recebido" stackId="a" fill="hsl(var(--primary))" name="Recebido" />
              <Bar dataKey="pendente" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Pendente" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* SEÇÃO 5: Top Clientes + Próximos Vencimentos */}
      <div className="grid gap-6 lg:grid-cols-2 dashboard-section">
        {/* Top Clientes */}
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Top clientes do mês</h3>
          {topClientes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento neste mês</p>
          ) : (
            <div className="space-y-3">
              {topClientes.map((c, i) => {
                const statusConfig = {
                  vencido: { bg: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', label: 'Vencido' },
                  pendente: { bg: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500', label: 'Pendente' },
                  sem_extrato: { bg: 'bg-amber-500/10 text-amber-500', dot: 'bg-amber-500', label: 'Sem extrato' },
                }[c.status];
                return (
                  <div key={c.clienteId} className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors" onClick={() => navigate(`/clientes/${c.clienteId}`)}>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                      <div>
                        <p className="text-sm font-medium">{c.nome}</p>
                        <p className="text-xs text-muted-foreground">{c.qtd} processos</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{fmt(c.total)}</p>
                      <div className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${statusConfig.bg}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        {statusConfig.label}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Próximos Vencimentos */}
        <Card className="p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Próximos vencimentos</h3>
          {proximosVencimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum vencimento próximo</p>
          ) : (
            <div className="space-y-2">
              {proximosVencimentos.map(item => {
                const diasAte = Math.ceil((new Date(item.data_vencimento + 'T00:00:00').getTime() - Date.now()) / 86400000);
                const dotColor = diasAte < 0 ? 'bg-destructive' : diasAte <= 2 ? 'bg-amber-500' : 'bg-green-500';
                return (
                  <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                      <div>
                        <p className="text-sm">{item.cliente_apelido || item.cliente_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          {diasAte < 0 ? ` · Vencido há ${Math.abs(diasAte)}d` : diasAte === 0 ? ' · Hoje' : ` · Em ${diasAte}d`}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{fmt(Number(item.valor))}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
