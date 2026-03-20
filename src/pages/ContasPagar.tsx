import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Plus, Search, CheckCircle, Wallet, Building2, Upload, AlertTriangle, Copy, Printer } from 'lucide-react';
import { useLancamentos, useCreateLancamento, useUpdateLancamento } from '@/hooks/useFinanceiro';
import { useColaboradores, type Colaborador } from '@/hooks/useColaboradores';
import { calcularCustoMensal, getBusinessDaysInMonth } from '@/lib/business-days';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import { uploadFile } from '@/hooks/useStorageUpload';
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
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [payDialog, setPayDialog] = useState<string | null>(null);
  const [compFile, setCompFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    descricao: '', valor: '', categoria: 'operacional',
    data_vencimento: '', recorrente: false, frequencia: 'mensal',
    parcelas: '12', vincularColab: false, colaboradorId: '',
  });

  const diasUteis = getBusinessDaysInMonth();
  const activeColabs = (colaboradores || []).filter(c => c.status === 'ativo');

  // Build a map colaborador_id -> Colaborador for PIX display
  const colabMap = new Map<string, Colaborador>();
  (colaboradores || []).forEach(c => colabMap.set(c.id, c));

  const filtered = (lancamentos || []).filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPendente = (lancamentos || []).filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = (lancamentos || []).filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

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
              tipo: 'pagar', descricao: `${form.descricao} (${i + 1}/${parcelas})`,
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
        tipo: 'pagar', descricao: form.descricao, valor, categoria: form.categoria,
        status: 'pendente', data_vencimento: form.data_vencimento,
        colaborador_id: form.vincularColab ? form.colaboradorId : null,
      } as any, { onSuccess: () => resetForm() });
    }
  };

  const resetForm = () => {
    setDialog(false);
    setForm({ descricao: '', valor: '', categoria: 'operacional', data_vencimento: '', recorrente: false, frequencia: 'mensal', parcelas: '12', vincularColab: false, colaboradorId: '' });
  };

  const handlePay = async () => {
    if (!payDialog) return;
    if (!compFile) return toast.error('Anexe o comprovante para confirmar o pagamento.');
    setUploading(true);
    try {
      // Find the lancamento to build the filename
      const lanc = (lancamentos || []).find(l => l.id === payDialog);
      const descClean = (lanc?.descricao || 'pagamento').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '_').substring(0, 60);
      const mesAno = new Date().toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }).replace('/', '-');
      const ext = compFile.name.split('.').pop() || 'pdf';
      const fileName = `comprovante_${descClean}_${mesAno}.${ext}`;

      // Upload with renamed path
      const storagePath = `comprovantes/${payDialog}/${fileName}`;
      const { supabase } = await import('@/integrations/supabase/client');
      const { STORAGE_BUCKETS } = await import('@/constants/storage');
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

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Custos operacionais e colaboradores</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9" onClick={() => { resetForm(); setDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4 py-2">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <Label className="text-sm font-medium">Vincular Colaborador</Label>
                <Switch checked={form.vincularColab} onCheckedChange={c => setForm(f => ({ ...f, vincularColab: c, colaboradorId: '' }))} />
              </div>
              {form.vincularColab && (
                <div className="grid gap-2">
                  <Label>Colaborador</Label>
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
                <Label>Descrição *</Label>
                <Input required value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Aluguel, Salário..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Valor *</Label>
                  <Input required type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Vencimento *</Label>
                  <Input required type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
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
              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox id="recorrente" checked={form.recorrente} onCheckedChange={c => setForm(f => ({ ...f, recorrente: !!c }))} />
                  <label htmlFor="recorrente" className="text-sm font-medium cursor-pointer">Lançamento Recorrente</label>
                </div>
                {form.recorrente && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Frequência</Label>
                      <Select value={form.frequencia} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mensal">Mensal</SelectItem>
                          <SelectItem value="semanal">Semanal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Parcelas</Label>
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
              <p className="text-2xl font-bold">{fmtCurrency(totalPendente)}</p>
              <p className="text-xs text-muted-foreground">A Pagar</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5"><Building2 className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{fmtCurrency(totalPago)}</p>
              <p className="text-xs text-muted-foreground">Pago no Período</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>PIX</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(l => {
                    const colab = (l as any).colaborador_id ? colabMap.get((l as any).colaborador_id) : null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.descricao}</TableCell>
                        <TableCell>
                          <Badge className={`${CATEGORIA_COLORS[l.categoria || 'outros']} border-0 text-[10px]`}>
                            {(l.categoria || 'outros').charAt(0).toUpperCase() + (l.categoria || 'outros').slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {colab?.pix_chave ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] truncate max-w-[100px]" title={colab.pix_chave}>{colab.pix_chave}</span>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0" onClick={() => copyPix(colab.pix_chave!)}>
                                <Copy className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtCurrency(Number(l.valor))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                            {STATUS_LABELS[l.status as StatusFinanceiro]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {l.status === 'pendente' && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-success hover:text-success"
                                onClick={() => { setPayDialog(l.id); setCompFile(null); }}>
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Pagar
                              </Button>
                            )}
                            {l.status === 'pago' && (
                              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleRecibo(l)}>
                                <Printer className="h-3.5 w-3.5 mr-1" /> Recibo
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog open={!!payDialog} onOpenChange={o => { if (!o) { setPayDialog(null); setCompFile(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirmar Pagamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Para confirmar o pagamento, é <strong>obrigatório</strong> anexar o comprovante (PDF ou imagem).
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Comprovante *</Label>
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
    </div>
  );
}
