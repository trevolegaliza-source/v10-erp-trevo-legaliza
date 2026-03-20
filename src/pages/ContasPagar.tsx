import { useState, useMemo } from 'react';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Plus, Search, CheckCircle, Wallet, Building2, Upload, AlertTriangle, Copy, Printer, Trash2, Pencil, History } from 'lucide-react';
import { useLancamentos, useCreateLancamento, useUpdateLancamento, useDeleteLancamento } from '@/hooks/useFinanceiro';
import { useColaboradores, type Colaborador } from '@/hooks/useColaboradores';
import { calcularCustoMensal, getBusinessDaysInMonth } from '@/lib/business-days';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro, Lancamento } from '@/types/financial';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { abrirRecibo } from '@/lib/recibo';
import { toast } from 'sonner';

const CATEGORIA_COLORS: Record<string, string> = {
  pessoal: 'bg-purple-500/15 text-purple-400',
  operacional: 'bg-info/10 text-info',
  imposto: 'bg-warning/10 text-warning',
  colaborador: 'bg-primary/10 text-primary',
  outros: 'bg-muted text-muted-foreground',
};

export default function ContasPagar() {
  const { data: lancamentos, isLoading } = useLancamentos('pagar');
  const { data: colaboradores } = useColaboradores();
  const createLancamento = useCreateLancamento();
  const updateLancamento = useUpdateLancamento();
  const deleteLancamento = useDeleteLancamento();
  const [filterStatus, setFilterStatus] = useState<string>('ativo');
  const [filterCategoria, setFilterCategoria] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [editDialog, setEditDialog] = useState<Lancamento | null>(null);
  const [compFile, setCompFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(undefined);

  const [form, setForm] = useState({
    descricao: '', valor: '', categoria: 'operacional',
    data_vencimento: '', recorrente: false, frequencia: 'mensal',
    parcelas: '12', vincularColab: false, colaboradorId: '',
    outrosDescricao: '',
  });

  const [editForm, setEditForm] = useState({ descricao: '', valor: '', data_vencimento: '', categoria: '' });

  const diasUteis = getBusinessDaysInMonth();
  const activeColabs = (colaboradores || []).filter(c => c.status === 'ativo');

  const colabMap = new Map<string, Colaborador>();
  (colaboradores || []).forEach(c => colabMap.set(c.id, c));

  // 5-day rule: hide paid items older than 5 days unless showing history
  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 86400000);

  const filtered = useMemo(() => {
    return (lancamentos || []).filter(l => {
      // History vs Active filter
      if (filterStatus === 'ativo') {
        // Hide paid items older than 5 days
        if (l.status === 'pago' && l.data_pagamento) {
          const paidDate = new Date(l.data_pagamento);
          if (paidDate < fiveDaysAgo) return false;
        }
      } else if (filterStatus === 'historico') {
        // Show only old paid items
        if (l.status !== 'pago') return false;
        if (l.data_pagamento) {
          const paidDate = new Date(l.data_pagamento);
          if (paidDate >= fiveDaysAgo) return false;
        }
      } else if (filterStatus !== 'all' && l.status !== filterStatus) {
        return false;
      }

      if (filterCategoria !== 'all' && (l.categoria || 'outros') !== filterCategoria) return false;
      if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;

      // Calendar date filter
      if (calendarDate) {
        const lDate = l.data_vencimento;
        const cDate = calendarDate.toISOString().split('T')[0];
        if (lDate !== cDate) return false;
      }

      return true;
    });
  }, [lancamentos, filterStatus, filterCategoria, search, calendarDate, fiveDaysAgo]);

  // Group by month
  const grouped = useMemo(() => {
    const groups: Record<string, Lancamento[]> = {};
    for (const l of filtered) {
      const d = new Date(l.data_vencimento);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(l);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalPendente = (lancamentos || []).filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = (lancamentos || []).filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  // Calendar dates
  const paymentDates = useMemo(() => {
    if (!lancamentos) return [];
    return lancamentos.filter(l => l.status === 'pendente').map(l => new Date(l.data_vencimento + 'T12:00:00'));
  }, [lancamentos]);

  const paidDates = useMemo(() => {
    if (!lancamentos) return [];
    return lancamentos.filter(l => l.status === 'pago').map(l => new Date(l.data_vencimento + 'T12:00:00'));
  }, [lancamentos]);

  const handleColabSelect = (colabId: string) => {
    const colab = activeColabs.find(c => c.id === colabId);
    if (colab) {
      const custo = calcularCustoMensal(Number(colab.salario_base), Number(colab.vt_diario), Number(colab.vr_diario), diasUteis);
      setForm(f => ({
        ...f, colaboradorId: colabId,
        descricao: `Pagamento - ${colab.nome} (${colab.regime})`,
        valor: custo.toFixed(2),
        categoria: 'colaborador',
      }));
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const valor = Number(form.valor);
    if (!valor || !form.descricao || !form.data_vencimento) return;

    const descricao = form.categoria === 'outros' && form.outrosDescricao
      ? `${form.descricao} - ${form.outrosDescricao}`
      : form.descricao;

    if (form.recorrente) {
      const parcelas = form.parcelas === 'indeterminado' ? 12 : Number(form.parcelas);
      const baseDate = new Date(form.data_vencimento);
      const promises: Promise<any>[] = [];
      for (let i = 0; i < parcelas; i++) {
        const venc = new Date(baseDate);
        if (form.frequencia === 'mensal') venc.setMonth(venc.getMonth() + i);
        else if (form.frequencia === 'semanal') venc.setDate(venc.getDate() + i * 7);
        promises.push(
          new Promise((resolve, reject) => {
            createLancamento.mutate({
              tipo: 'pagar', descricao: `${descricao} (${i + 1}/${parcelas})`,
              valor, categoria: form.categoria, status: 'pendente',
              data_vencimento: venc.toISOString().split('T')[0],
              colaborador_id: form.vincularColab ? form.colaboradorId : null,
            } as any, { onSuccess: resolve, onError: reject });
          })
        );
      }
      Promise.all(promises).then(() => {
        toast.success(`${parcelas} lançamentos recorrentes criados!`);
        resetForm();
      });
    } else {
      createLancamento.mutate({
        tipo: 'pagar', descricao, valor, categoria: form.categoria,
        status: 'pendente', data_vencimento: form.data_vencimento,
        colaborador_id: form.vincularColab ? form.colaboradorId : null,
      } as any, { onSuccess: () => resetForm() });
    }
  };

  const resetForm = () => {
    setDialog(false);
    setForm({ descricao: '', valor: '', categoria: 'operacional', data_vencimento: '', recorrente: false, frequencia: 'mensal', parcelas: '12', vincularColab: false, colaboradorId: '', outrosDescricao: '' });
  };

  const handlePay = async () => {
    if (!payDialog) return;
    if (!compFile) return toast.error('Anexe o comprovante para confirmar o pagamento.');
    setUploading(true);
    try {
      const ext = (compFile.name.split('.').pop() || 'pdf').toLowerCase();
      const storagePath = `comprovantes/${payDialog}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKETS.CONTRACTS)
        .upload(storagePath, compFile, { upsert: true });
      if (upErr) throw upErr;

      updateLancamento.mutate({
        id: payDialog, status: 'pago',
        data_pagamento: new Date().toISOString().split('T')[0],
        comprovante_url: storagePath,
      } as any, {
        onSuccess: () => { setPayDialog(null); setCompFile(null); toast.success('Pagamento confirmado!'); },
      });
    } catch (err: any) {
      toast.error('Erro no upload: ' + (err?.message || 'Desconhecido'));
    }
    setUploading(false);
  };

  const handleEdit = (l: Lancamento) => {
    setEditDialog(l);
    setEditForm({
      descricao: l.descricao,
      valor: String(l.valor),
      data_vencimento: l.data_vencimento,
      categoria: l.categoria || 'outros',
    });
  };

  const handleEditSave = () => {
    if (!editDialog) return;
    updateLancamento.mutate({
      id: editDialog.id,
      descricao: editForm.descricao,
      valor: Number(editForm.valor),
      data_vencimento: editForm.data_vencimento,
      categoria: editForm.categoria,
    } as any, {
      onSuccess: () => { setEditDialog(null); },
    });
  };

  const handleDelete = (l: Lancamento) => {
    if (!confirm(`Excluir "${l.descricao}"? Esta ação não pode ser desfeita.`)) return;
    deleteLancamento.mutate(l.id);
  };

  const copyPix = (chave: string) => {
    navigator.clipboard.writeText(chave);
    toast.success('Chave PIX copiada!');
  };

  const handleRecibo = (l: any) => {
    const mesAno = new Date(l.data_vencimento).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const colab = l.colaborador_id ? colabMap.get(l.colaborador_id) : null;
    abrirRecibo({
      nome: colab?.nome || 'Beneficiário',
      valor: Number(l.valor),
      descricao: l.descricao,
      mesAno,
    });
  };

  const handleCalendarClick = (date: Date | undefined) => {
    if (!date) { setCalendarDate(undefined); return; }
    // Toggle: click same date to clear filter
    if (calendarDate && date.toDateString() === calendarDate.toDateString()) {
      setCalendarDate(undefined);
    } else {
      setCalendarDate(date);
    }
  };

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const monthName = (key: string) => {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Custos operacionais e colaboradores</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9" onClick={() => { resetForm(); setDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="text-foreground">Nova Conta a Pagar</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <Label className="text-sm font-medium text-foreground">Vincular Colaborador</Label>
                <Switch checked={form.vincularColab} onCheckedChange={c => setForm(f => ({ ...f, vincularColab: c, colaboradorId: '' }))} />
              </div>
              {form.vincularColab && (
                <div className="grid gap-2">
                  <Label className="text-foreground">Colaborador</Label>
                  <Select value={form.colaboradorId} onValueChange={handleColabSelect}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {activeColabs.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} ({c.regime})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label className="text-foreground">Descrição *</Label>
                <Input required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, Salário..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-foreground">Valor *</Label>
                  <Input required type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-foreground">Vencimento *</Label>
                  <Input required type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label className="text-foreground">Categoria</Label>
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operacional">Operacional</SelectItem>
                    <SelectItem value="colaborador">Colaborador</SelectItem>
                    <SelectItem value="pessoal">Pessoal</SelectItem>
                    <SelectItem value="imposto">Imposto</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.categoria === 'outros' && (
                <div className="grid gap-2">
                  <Label className="text-foreground">Especifique a despesa *</Label>
                  <Input required value={form.outrosDescricao}
                    onChange={e => setForm(f => ({ ...f, outrosDescricao: e.target.value }))}
                    placeholder="Ex: Aluguel, Internet, Limpeza..." />
                </div>
              )}
              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="recorrente" checked={form.recorrente} onCheckedChange={c => setForm(f => ({ ...f, recorrente: !!c }))} />
                  <label htmlFor="recorrente" className="text-sm font-medium cursor-pointer text-foreground">Lançamento Recorrente</label>
                </div>
                {form.recorrente && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-foreground">Frequência</Label>
                      <Select value={form.frequencia} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-foreground">Parcelas</Label>
                      <Select value={form.parcelas} onValueChange={v => setForm(f => ({ ...f, parcelas: v }))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 parcelas</SelectItem>
                          <SelectItem value="6">6 parcelas</SelectItem>
                          <SelectItem value="12">12 parcelas</SelectItem>
                          <SelectItem value="24">24 parcelas</SelectItem>
                          <SelectItem value="indeterminado">Indeterminado (12)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              <Button type="submit" disabled={createLancamento.isPending}>Criar Lançamento</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><Wallet className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{fmtCurrency(totalPendente)}</p>
              <p className="text-xs text-muted-foreground">A Pagar</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5"><Building2 className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{fmtCurrency(totalPago)}</p>
              <p className="text-xs text-muted-foreground">Pago no Período</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters + Calendar */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 text-foreground" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
             <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setCalendarDate(undefined); }}>
              <SelectTrigger className="w-36 h-9 text-foreground"><SelectValue placeholder="Visão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendentes</SelectItem>
                <SelectItem value="pago">Pagos</SelectItem>
                <SelectItem value="historico">
                  <span className="flex items-center gap-1"><History className="h-3 w-3" /> Histórico</span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-40 h-9 text-foreground"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="operacional">Operacional</SelectItem>
                <SelectItem value="pessoal">Pessoal</SelectItem>
                <SelectItem value="imposto">Imposto</SelectItem>
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            {calendarDate && (
              <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={() => setCalendarDate(undefined)}>
                ✕ Limpar filtro de data
              </Button>
            )}
          </div>

          {/* Table grouped by month */}
          {grouped.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum lançamento encontrado.
              </CardContent>
            </Card>
          ) : (
            grouped.map(([monthKey, items]) => (
              <div key={monthKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-bold text-muted-foreground tracking-widest">{monthName(monthKey)}</span>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">{fmtCurrency(items.reduce((s, l) => s + Number(l.valor), 0))}</span>
                </div>
                <Card className="border-border/60">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-foreground">Descrição</TableHead>
                            <TableHead className="text-foreground">Categoria</TableHead>
                            <TableHead className="text-foreground">PIX</TableHead>
                            <TableHead className="text-foreground">Vencimento</TableHead>
                            <TableHead className="text-right text-foreground">Valor</TableHead>
                            <TableHead className="text-center text-foreground">Status</TableHead>
                            <TableHead className="text-center text-foreground">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map(l => {
                            const colab = (l as any).colaborador_id ? colabMap.get((l as any).colaborador_id) : null;
                            return (
                              <TableRow key={l.id} className="group">
                                <TableCell className="font-medium text-foreground">{l.descricao}</TableCell>
                                <TableCell>
                                  <Badge className={`${CATEGORIA_COLORS[l.categoria || 'outros']} border-0 text-[10px]`}>
                                    {(l.categoria || 'outros').charAt(0).toUpperCase() + (l.categoria || 'outros').slice(1)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {colab?.pix_chave ? (
                                    <button
                                      className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
                                      onClick={() => copyPix(colab.pix_chave!)}
                                      title="Clique para copiar"
                                    >
                                      <span className="text-[10px] truncate max-w-[100px] text-foreground">{colab.pix_chave}</span>
                                      <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-foreground">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                                <TableCell className="text-right font-medium text-foreground">
                                  {fmtCurrency(Number(l.valor))}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                                    {STATUS_LABELS[l.status as StatusFinanceiro]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                  <div className="flex items-center justify-center gap-0.5">
                                    {l.status === 'pendente' && (
                                      <>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs text-success hover:text-success"
                                          onClick={() => { setPayDialog(l.id); setCompFile(null); }}>
                                          <CheckCircle className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEdit(l)}>
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                      </>
                                    )}
                                    {l.status === 'pago' && (
                                      <Button variant="ghost" size="sm" className="h-7 text-xs text-foreground" onClick={() => handleRecibo(l)}>
                                        <Printer className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={() => handleDelete(l)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))
          )}
        </div>

        {/* Mini Calendar Sidebar */}
        <Card className="border-border/60 card-hover hidden lg:block self-start sticky top-4">
          <CardContent className="p-3">
            <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Calendário</p>
            <Calendar
              mode="single"
              selected={calendarDate}
              onSelect={handleCalendarClick}
              className="p-0 pointer-events-auto"
              locale={ptBR}
              modifiers={{
                paid: paidDates,
                pending: paymentDates,
              }}
              modifiersClassNames={{
                paid: '[&]:bg-success/20 [&]:text-success [&]:font-bold',
                pending: '[&]:bg-warning/20 [&]:text-warning [&]:font-bold',
              }}
            />
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning inline-block" /> Pendente</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success inline-block" /> Pago</span>
            </div>
            {calendarDate && (
              <p className="text-[10px] text-primary mt-1 font-medium">
                Filtrando: {calendarDate.toLocaleDateString('pt-BR')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment Modal */}
      <Dialog open={!!payDialog} onOpenChange={o => { if (!o) { setPayDialog(null); setCompFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-foreground">Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Para confirmar o pagamento, é <strong className="text-foreground">obrigatório</strong> anexar o comprovante (PDF ou imagem).
              </p>
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground">Comprovante *</Label>
              <div className="flex items-center gap-2">
                <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => setCompFile(e.target.files?.[0] || null)} />
                {compFile && <Upload className="h-4 w-4 text-primary shrink-0" />}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayDialog(null); setCompFile(null); }}>Cancelar</Button>
            <Button onClick={handlePay} disabled={!compFile || uploading}>
              {uploading ? 'Enviando...' : 'Confirmar Pagamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editDialog} onOpenChange={o => { if (!o) setEditDialog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-foreground">Editar Lançamento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-foreground">Descrição</Label>
              <Input value={editForm.descricao} onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-foreground">Valor</Label>
                <Input type="number" step="0.01" value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-foreground">Vencimento</Label>
                <Input type="date" value={editForm.data_vencimento} onChange={e => setEditForm(f => ({ ...f, data_vencimento: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label className="text-foreground">Categoria</Label>
              <Select value={editForm.categoria} onValueChange={v => setEditForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="colaborador">Colaborador</SelectItem>
                  <SelectItem value="pessoal">Pessoal</SelectItem>
                  <SelectItem value="imposto">Imposto</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleEditSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
