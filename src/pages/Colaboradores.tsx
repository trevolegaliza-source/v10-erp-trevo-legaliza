import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search, Pencil, Trash2 } from 'lucide-react';
import { useColaboradores, useCreateColaborador, useUpdateColaborador, useDeleteColaborador, type Colaborador } from '@/hooks/useColaboradores';
import { getBusinessDaysInMonth, calcularCustoMensal } from '@/lib/business-days';
import { toast } from 'sonner';

const EMPTY_FORM = { nome: '', email: '', regime: 'CLT' as 'CLT' | 'PJ', salario_base: '', vt_diario: '', vr_diario: '', status: 'ativo' as 'ativo' | 'inativo' };

export default function Colaboradores() {
  const { data: colaboradores, isLoading } = useColaboradores();
  const create = useCreateColaborador();
  const update = useUpdateColaborador();
  const del = useDeleteColaborador();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [search, setSearch] = useState('');

  const diasUteis = getBusinessDaysInMonth();

  const filtered = (colaboradores || []).filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const totalAtivos = (colaboradores || []).filter(c => c.status === 'ativo');
  const custoTotalMensal = totalAtivos.reduce((s, c) =>
    s + calcularCustoMensal(Number(c.salario_base), Number(c.vt_diario), Number(c.vr_diario), diasUteis), 0
  );

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (c: Colaborador) => {
    setEditId(c.id);
    setForm({
      nome: c.nome, email: c.email || '', regime: c.regime,
      salario_base: String(c.salario_base), vt_diario: String(c.vt_diario),
      vr_diario: String(c.vr_diario), status: c.status,
    });
    setDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      nome: form.nome.trim(),
      email: form.email.trim() || null,
      regime: form.regime,
      salario_base: Number(form.salario_base) || 0,
      vt_diario: Number(form.vt_diario) || 0,
      vr_diario: Number(form.vr_diario) || 0,
      status: form.status,
    };
    if (!payload.nome) return toast.error('Nome é obrigatório');

    if (editId) {
      update.mutate({ id: editId, ...payload } as any, { onSuccess: () => setDialog(false) });
    } else {
      create.mutate(payload as any, { onSuccess: () => setDialog(false) });
    }
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gestão de RH e custo de pessoal</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-1" /> Novo Colaborador
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Nome *</Label>
                <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Regime</Label>
                  <Select value={form.regime} onValueChange={v => setForm(f => ({ ...f, regime: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLT">CLT</SelectItem>
                      <SelectItem value="PJ">PJ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Salário Base (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.salario_base} onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>VT Diário (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.vt_diario} onChange={e => setForm(f => ({ ...f, vt_diario: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>VR Diário (R$)</Label>
                  <Input type="number" step="0.01" min="0" value={form.vr_diario} onChange={e => setForm(f => ({ ...f, vr_diario: e.target.value }))} />
                </div>
              </div>

              {/* Live cost preview */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground mb-1">Custo Mensal Estimado ({diasUteis} dias úteis)</p>
                <p className="text-xl font-bold text-primary">
                  {fmt(calcularCustoMensal(
                    Number(form.salario_base) || 0,
                    Number(form.vt_diario) || 0,
                    Number(form.vr_diario) || 0,
                    diasUteis,
                  ))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Salário + (VT + VR) × {diasUteis} dias úteis
                </p>
              </div>

              <Button type="submit" disabled={create.isPending || update.isPending}>
                {editId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold">{totalAtivos.length}</p>
              <p className="text-xs text-muted-foreground">Colaboradores Ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Custo Total Mensal</p>
            <p className="text-2xl font-bold text-primary">{fmt(custoTotalMensal)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Dias Úteis (Mês Atual)</p>
            <p className="text-2xl font-bold">{diasUteis}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar colaborador..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Regime</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                  <TableHead className="text-right">VT/dia</TableHead>
                  <TableHead className="text-right">VR/dia</TableHead>
                  <TableHead className="text-right">Custo Mensal</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const custo = calcularCustoMensal(Number(c.salario_base), Number(c.vt_diario), Number(c.vr_diario), diasUteis);
                  return (
                    <TableRow key={c.id} className="group" onDoubleClick={() => openEdit(c)}>
                      <TableCell className="font-medium">
                        {c.nome}
                        {c.email && <span className="block text-[10px] text-muted-foreground">{c.email}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={c.regime === 'CLT' ? 'border-info/40 text-info' : 'border-warning/40 text-warning'}>
                          {c.regime}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{fmt(Number(c.salario_base))}</TableCell>
                      <TableCell className="text-right">{fmt(Number(c.vt_diario))}</TableCell>
                      <TableCell className="text-right">{fmt(Number(c.vr_diario))}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">{fmt(custo)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`border-0 text-[10px] ${c.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => del.mutate(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum colaborador</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
