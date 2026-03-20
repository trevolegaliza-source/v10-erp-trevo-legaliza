import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Users, Search, Pencil, Trash2, Zap, Copy } from 'lucide-react';
import { useColaboradores, useCreateColaborador, useUpdateColaborador, useDeleteColaborador, type Colaborador } from '@/hooks/useColaboradores';
import { getBusinessDaysInMonth, calcularCustoMensal } from '@/lib/business-days';
import { gerarVerbasDoMes } from '@/lib/gerar-verbas';
import ColaboradorForm, { EMPTY_FORM, type ColaboradorFormData } from '@/components/colaboradores/ColaboradorForm';
import ColaboradorDetalheModal from '@/components/colaboradores/ColaboradorDetalheModal';
import { toast } from 'sonner';

export default function Colaboradores() {
  const { data: colaboradores, isLoading } = useColaboradores();
  const create = useCreateColaborador();
  const update = useUpdateColaborador();
  const del = useDeleteColaborador();
  const [dialog, setDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ColaboradorFormData>(EMPTY_FORM);
  const [search, setSearch] = useState('');
  const [gerando, setGerando] = useState(false);
  const [detalheColab, setDetalheColab] = useState<Colaborador | null>(null);

  const diasUteis = getBusinessDaysInMonth();

  const filtered = (colaboradores || []).filter(c =>
    !search || c.nome.toLowerCase().includes(search.toLowerCase())
  );

  const totalAtivos = (colaboradores || []).filter(c => c.status === 'ativo');
  const custoTotalMensal = totalAtivos.reduce((s, c) =>
    s + calcularCustoMensal(Number(c.salario_base), Number(c.vt_diario), Number(c.vr_diario), diasUteis), 0
  );

  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setDialog(true); };
  const openEdit = (c: Colaborador, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditId(c.id);
    setForm({
      nome: c.nome, email: c.email || '', regime: c.regime,
      salario_base: String(c.salario_base), vt_diario: String(c.vt_diario),
      vr_diario: String(c.vr_diario), status: c.status,
      possui_adiantamento: c.possui_adiantamento ?? true,
      adiantamento_tipo: c.adiantamento_tipo || 'percentual',
      adiantamento_valor: String(c.adiantamento_valor || 0),
      dia_pagamento_integral: String(c.dia_pagamento_integral || 5),
      pix_tipo: c.pix_tipo || '', pix_chave: c.pix_chave || '',
      valor_das: String(c.valor_das || 0),
      aumento_previsto_valor: String(c.aumento_previsto_valor || ''),
      aumento_previsto_data: c.aumento_previsto_data || '',
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
      adiantamento_tipo: form.adiantamento_tipo,
      adiantamento_valor: Number(form.adiantamento_valor) || 0,
      pix_tipo: form.pix_tipo || null,
      pix_chave: form.pix_chave || null,
      valor_das: Number(form.valor_das) || 0,
      aumento_previsto_valor: Number(form.aumento_previsto_valor) || 0,
      aumento_previsto_data: form.aumento_previsto_data || null,
    };
    if (!payload.nome) return toast.error('Nome é obrigatório');

    if (editId) {
      update.mutate({ id: editId, ...payload } as any, { onSuccess: () => setDialog(false) });
    } else {
      create.mutate(payload as any, { onSuccess: () => setDialog(false) });
    }
  };

  const handleGerarVerbas = async () => {
    if (!colaboradores || totalAtivos.length === 0) return toast.error('Nenhum colaborador ativo.');
    setGerando(true);
    try {
      const now = new Date();
      const total = await gerarVerbasDoMes(colaboradores, now.getFullYear(), now.getMonth());
      if (total === 0) {
        toast.info('Verbas já geradas para este mês. Valores atualizados se houve mudança.');
      } else {
        toast.success(`${total} novos lançamentos gerados para ${totalAtivos.length} colaboradores!`);
      }
    } catch { /* handled */ }
    setGerando(false);
  };

  const copyPix = (chave: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(chave);
    toast.success('Chave PIX copiada!');
  };

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Gestão de RH e custo de pessoal</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" className="h-9 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleGerarVerbas} disabled={gerando}>
            <Zap className="h-4 w-4 mr-1" /> {gerando ? 'Gerando...' : 'Gerar Verbas do Mês'}
          </Button>
          <Dialog open={dialog} onOpenChange={setDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" /> Novo Colaborador
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle className="text-foreground">{editId ? 'Editar' : 'Novo'} Colaborador</DialogTitle></DialogHeader>
              <ColaboradorForm
                form={form} setForm={setForm} onSubmit={handleSubmit}
                isPending={create.isPending || update.isPending}
                isEdit={!!editId} diasUteis={diasUteis}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60 card-hover">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAtivos.length}</p>
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
            <p className="text-2xl font-bold text-foreground">{diasUteis}</p>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Nome</TableHead>
                    <TableHead className="text-foreground">Regime</TableHead>
                    <TableHead className="text-right text-foreground">Salário</TableHead>
                    <TableHead className="text-right text-foreground">Custo Mensal</TableHead>
                    <TableHead className="text-foreground">Chave PIX</TableHead>
                    <TableHead className="text-center text-foreground">Status</TableHead>
                    <TableHead className="text-center text-foreground">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(c => {
                    const custo = calcularCustoMensal(Number(c.salario_base), Number(c.vt_diario), Number(c.vr_diario), diasUteis);
                    return (
                      <TableRow key={c.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => setDetalheColab(c)}>
                        <TableCell className="font-medium text-foreground">
                          {c.nome}
                          {c.email && <span className="block text-[10px] text-muted-foreground">{c.email}</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={c.regime === 'CLT' ? 'border-info/40 text-info' : 'border-warning/40 text-warning'}>
                            {c.regime}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-foreground">{fmt(Number(c.salario_base))}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">{fmt(custo)}</TableCell>
                        <TableCell>
                          {c.pix_chave ? (
                            <button
                              className="flex items-center gap-1.5 hover:text-primary transition-colors cursor-pointer bg-transparent border-0 p-0"
                              onClick={(e) => copyPix(c.pix_chave!, e)}
                              title="Clique para copiar"
                            >
                              <span className="text-xs truncate max-w-[140px] text-foreground">{c.pix_chave}</span>
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`border-0 text-[10px] ${c.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                            {c.status === 'ativo' ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => openEdit(c, e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); del.mutate(c.id); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum colaborador</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Collaborator Detail Modal */}
      <ColaboradorDetalheModal
        colab={detalheColab}
        open={!!detalheColab}
        onOpenChange={(open) => { if (!open) setDetalheColab(null); }}
      />
    </div>
  );
}
