import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useColaboradores } from '@/hooks/useColaboradores';
import { AlertTriangle, Clock, Hourglass } from 'lucide-react';
import FluxoItemDetalheModal from './FluxoItemDetalheModal';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const DIAS_SEMANA = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

type Urgencia = 'atrasado' | 'urgente' | 'normal';

interface LancItem {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  categoria: string | null;
  subcategoria: string | null;
  colaborador_id: string | null;
  fornecedor: string | null;
  urgencia: Urgencia;
}

interface BeneficioRow {
  type: 'beneficio';
  colaborador_id: string;
  nome: string;
  valor: number;
  vt: LancItem | null;
  vr: LancItem | null;
  vt_diario: number;
  vr_diario: number;
  vt_dias: number;
  vr_dias: number;
  urgencia: Urgencia;
  data_vencimento: string;
}

interface NormalRow {
  type: 'normal';
  item: LancItem;
}

type AgendaRow = BeneficioRow | NormalRow;

function getUrgencia(dataVenc: string): Urgencia {
  const hoje = new Date().toISOString().split('T')[0];
  const em7 = new Date(); em7.setDate(em7.getDate() + 7);
  const em7Str = em7.toISOString().split('T')[0];
  if (dataVenc <= hoje) return 'atrasado';
  if (dataVenc <= em7Str) return 'urgente';
  return 'normal';
}

function UrgencyIcon({ urgencia }: { urgencia: Urgencia }) {
  if (urgencia === 'atrasado') return <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: '#EF4444' }} />;
  if (urgencia === 'urgente') return <Clock className="h-4 w-4 flex-shrink-0" style={{ color: '#F59E0B' }} />;
  return <Hourglass className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
}

function getDayLabel(dateStr: string): string {
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split('T')[0];
  const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = amanha.toISOString().split('T')[0];
  const d = new Date(dateStr + 'T12:00:00');
  const diaSemana = DIAS_SEMANA[d.getDay()];
  const dataFmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  if (dateStr === hojeStr) return `HOJE · ${diaSemana}, ${dataFmt}`;
  if (dateStr === amanhaStr) return `AMANHÃ · ${diaSemana}, ${dataFmt}`;
  return `${diaSemana}, ${dataFmt}`;
}

export default function FluxoProximos15Dias() {
  const [selectedItem, setSelectedItem] = useState<LancItem | null>(null);
  const queryClient = useQueryClient();
  const { data: colaboradores = [] } = useColaboradores();

  const { data: items = [] } = useQuery<LancItem[]>({
    queryKey: ['fluxo_agenda_15dias'],
    queryFn: async () => {
      const hoje = new Date();
      const em15 = new Date(hoje); em15.setDate(em15.getDate() + 15);
      const hojeStr = hoje.toISOString().split('T')[0];
      const em15Str = em15.toISOString().split('T')[0];

      const { data: rows } = await supabase
        .from('lancamentos')
        .select('id, descricao, valor, data_vencimento, status, categoria, subcategoria, colaborador_id, fornecedor')
        .eq('tipo', 'pagar')
        .in('status', ['pendente', 'atrasado'])
        .gte('data_vencimento', hojeStr)
        .lte('data_vencimento', em15Str)
        .order('data_vencimento', { ascending: true });

      return (rows || []).map(r => ({
        ...r,
        valor: Number(r.valor),
        urgencia: getUrgencia(r.data_vencimento),
      }));
    },
    refetchInterval: 30000,
  });

  // Build agenda grouped by date, merging VT+VR into Benefícios
  const agenda = useMemo(() => {
    const colabMap = new Map(colaboradores.map(c => [c.id, c]));

    const grouped: Record<string, LancItem[]> = {};
    items.forEach(item => {
      const key = item.data_vencimento;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    const result: { date: string; label: string; total: number; rows: AgendaRow[] }[] = [];

    Object.keys(grouped).sort().forEach(dateStr => {
      const dayItems = grouped[dateStr];
      const rows: AgendaRow[] = [];

      // Separate VT/VR for benefícios merge
      const vtVr = dayItems.filter(i => i.subcategoria === 'Vale Transporte (VT)' || i.subcategoria === 'Vale Refeição (VR)');
      const others = dayItems.filter(i => i.subcategoria !== 'Vale Transporte (VT)' && i.subcategoria !== 'Vale Refeição (VR)');

      // Group VT/VR by colaborador
      const byColab: Record<string, { vt: LancItem | null; vr: LancItem | null }> = {};
      vtVr.forEach(item => {
        const key = item.colaborador_id || 'none';
        if (!byColab[key]) byColab[key] = { vt: null, vr: null };
        if (item.subcategoria === 'Vale Transporte (VT)') byColab[key].vt = item;
        else byColab[key].vr = item;
      });

      Object.entries(byColab).forEach(([colabId, { vt, vr }]) => {
        const colab = colabMap.get(colabId);
        const vtDiario = colab?.vt_diario || 0;
        const vrDiario = colab?.vr_diario || 0;
        const vtDias = vt && vtDiario > 0 ? Math.round(vt.valor / vtDiario) : 0;
        const vrDias = vr && vrDiario > 0 ? Math.round(vr.valor / vrDiario) : 0;
        const totalVal = (vt?.valor || 0) + (vr?.valor || 0);
        const nome = colab?.nome || vt?.descricao || vr?.descricao || 'COLABORADOR';
        const dataVenc = vt?.data_vencimento || vr?.data_vencimento || dateStr;
        const urg: Urgencia = (vt?.urgencia === 'atrasado' || vr?.urgencia === 'atrasado') ? 'atrasado'
          : (vt?.urgencia === 'urgente' || vr?.urgencia === 'urgente') ? 'urgente' : 'normal';

        rows.push({
          type: 'beneficio',
          colaborador_id: colabId,
          nome: nome.toUpperCase(),
          valor: totalVal,
          vt, vr,
          vt_diario: vtDiario,
          vr_diario: vrDiario,
          vt_dias: vtDias,
          vr_dias: vrDias,
          urgencia: urg,
          data_vencimento: dataVenc,
        });
      });

      others.forEach(item => {
        rows.push({ type: 'normal', item });
      });

      const total = dayItems.reduce((s, i) => s + i.valor, 0);
      result.push({ date: dateStr, label: getDayLabel(dateStr), total, rows });
    });

    return result;
  }, [items, colaboradores]);

  if (items.length === 0) return null;

  const totalGeral = items.reduce((s, i) => s + i.valor, 0);
  const hoje = new Date();
  const em7 = new Date(hoje); em7.setDate(em7.getDate() + 7);
  const em7Str = em7.toISOString().split('T')[0];
  const criticos7 = items.filter(i => i.data_vencimento <= em7Str).length;

  const hojeStr = hoje.toLocaleDateString('pt-BR');

  const handleMarcarPago = async (id: string) => {
    const dataPagamento = new Date().toISOString().split('T')[0];
    await supabase.from('lancamentos').update({
      status: 'pago' as any,
      data_pagamento: dataPagamento,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['fluxo_agenda_15dias'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar'] });
    queryClient.invalidateQueries({ queryKey: ['lancamentos_pagar_date'] });
    setSelectedItem(null);
  };

  function getRowLabel(row: NormalRow): string {
    const item = row.item;
    const parts: string[] = [];
    if (item.subcategoria) parts.push(item.subcategoria.toUpperCase());
    else if (item.categoria) parts.push(item.categoria.toUpperCase());
    if (item.fornecedor) parts.push(item.fornecedor.toUpperCase());
    else parts.push(item.descricao.toUpperCase());
    return parts.join(' · ');
  }

  return (
    <>
      <div className="bg-card rounded-lg border border-border p-4 space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold tracking-widest text-muted-foreground">
            FLUXO · PRÓXIMOS 15 DIAS
          </span>
          <span className="text-xs text-muted-foreground">HOJE: {hojeStr.toUpperCase()}</span>
        </div>

        {/* Day groups */}
        {agenda.map((day, di) => (
          <div key={day.date}>
            {di > 0 && <div className="h-px bg-border my-3" />}
            {/* Day header */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground tracking-wide">{day.label}</span>
              <span className="text-sm font-bold text-foreground">{fmt(day.total)}</span>
            </div>
            {/* Items */}
            <div className="space-y-1 pl-2">
              {day.rows.map((row, ri) => {
                if (row.type === 'beneficio') {
                  const bRow = row;
                  return (
                    <div
                      key={`ben-${bRow.colaborador_id}-${di}`}
                      className="cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        // Open detail for the first underlying item
                        const firstItem = bRow.vt || bRow.vr;
                        if (firstItem) setSelectedItem(firstItem);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <UrgencyIcon urgencia={bRow.urgencia} />
                        <span className="text-xs font-semibold text-foreground flex-1 truncate">
                          BENEFÍCIOS · {bRow.nome}
                        </span>
                        <span className="text-xs font-bold text-foreground whitespace-nowrap">{fmt(bRow.valor)}</span>
                      </div>
                      <div className="pl-6 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {bRow.vt && `VT R$ ${bRow.vt_diario.toFixed(2).replace('.', ',')}/DIA × ${bRow.vt_dias} DIAS`}
                          {bRow.vt && bRow.vr && ' + '}
                          {bRow.vr && `VR R$ ${bRow.vr_diario.toFixed(2).replace('.', ',')}/DIA × ${bRow.vr_dias} DIAS`}
                        </span>
                      </div>
                    </div>
                  );
                }

                const item = row.item;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedItem(item)}
                  >
                    <UrgencyIcon urgencia={item.urgencia} />
                    <span className="text-xs font-semibold text-foreground flex-1 truncate">
                      {getRowLabel(row)}
                    </span>
                    <span className="text-xs font-bold text-foreground whitespace-nowrap">{fmt(item.valor)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div className="h-px bg-border my-3" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground tracking-wide">TOTAL DOS PRÓXIMOS 15 DIAS</span>
          <span className="text-sm font-bold text-foreground">{fmt(totalGeral)}</span>
        </div>
        {criticos7 > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: '#F59E0B' }}>
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>⚠ {criticos7} VENCE{criticos7 !== 1 ? 'M' : ''} EM ATÉ 7 DIAS</span>
          </div>
        )}
      </div>

      <FluxoItemDetalheModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onMarcarPago={handleMarcarPago}
      />
    </>
  );
}
