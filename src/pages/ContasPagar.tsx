import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, CheckCircle, Wallet, Building2 } from 'lucide-react';
import { useLancamentos, useCreateLancamento, useUpdateLancamento } from '@/hooks/useFinanceiro';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';

export default function ContasPagar() {
  const { data: lancamentos, isLoading } = useLancamentos('pagar');
  const createLancamento = useCreateLancamento();
  const updateLancamento = useUpdateLancamento();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ descricao: '', valor: '', categoria: 'operacional', data_vencimento: '' });

  const filtered = (lancamentos || []).filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalPendente = (lancamentos || []).filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = (lancamentos || []).filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLancamento.mutate({
      tipo: 'pagar',
      descricao: form.descricao,
      valor: Number(form.valor),
      categoria: form.categoria,
      status: 'pendente',
      data_vencimento: form.data_vencimento,
    } as any, {
      onSuccess: () => {
        setDialog(false);
        setForm({ descricao: '', valor: '', categoria: 'operacional', data_vencimento: '' });
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-sm text-muted-foreground">Custos operacionais e colaboradores</p>
        </div>
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="h-4 w-4 mr-1" />
              Novo Lançamento
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Conta a Pagar</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="grid gap-4 py-2">
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
                    <SelectItem value="imposto">Imposto</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createLancamento.isPending}>Criar Lançamento</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><Wallet className="h-5 w-5 text-warning" /></div>
            <div>
              <p className="text-2xl font-bold">{totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              <p className="text-xs text-muted-foreground">A Pagar</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5"><Building2 className="h-5 w-5 text-success" /></div>
            <div>
              <p className="text-2xl font-bold">{totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.descricao}</TableCell>
                    <TableCell className="text-sm capitalize">{l.categoria || '-'}</TableCell>
                    <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                        {STATUS_LABELS[l.status as StatusFinanceiro]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {l.status === 'pendente' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-success hover:text-success"
                          onClick={() => updateLancamento.mutate({ id: l.id, status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })}
                        >
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento</TableCell>
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
