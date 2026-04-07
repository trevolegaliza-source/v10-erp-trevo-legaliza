import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { usePlanoContas, useSaveConta, useDeleteConta, type PlanoContas } from '@/hooks/usePlanoContas';

const TIPOS = [
  { value: 'receita', label: 'Receita', color: 'text-emerald-400' },
  { value: 'deducao', label: 'Dedução', color: 'text-amber-400' },
  { value: 'custo', label: 'Custo', color: 'text-red-400' },
  { value: 'despesa', label: 'Despesa', color: 'text-orange-400' },
  { value: 'despesa_financeira', label: 'Desp. Financeira', color: 'text-rose-400' },
];

const CENTROS = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'comercial', label: 'Comercial' },
];

export default function PlanoContasTab() {
  const { data: contas, isLoading } = usePlanoContas();
  const saveMutation = useSaveConta();
  const deleteMutation = useDeleteConta();
  const [editConta, setEditConta] = useState<PlanoContas | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('despesa');
  const [grupo, setGrupo] = useState('despesa');
  const [subgrupo, setSubgrupo] = useState('');
  const [centroCusto, setCentroCusto] = useState('');

  function openNew(parentCodigo?: string) {
    setEditConta(null);
    setCodigo(parentCodigo ? parentCodigo + '.' : '');
    setNome('');
    setTipo('despesa');
    setGrupo('despesa');
    setSubgrupo('');
    setCentroCusto('');
    setShowForm(true);
  }

  function openEdit(c: PlanoContas) {
    setEditConta(c);
    setCodigo(c.codigo);
    setNome(c.nome);
    setTipo(c.tipo);
    setGrupo(c.grupo);
    setSubgrupo(c.subgrupo || '');
    setCentroCusto(c.centro_custo || '');
    setShowForm(true);
  }

  async function handleSave() {
    if (!codigo.trim() || !nome.trim()) return;
    await saveMutation.mutateAsync({
      ...(editConta ? { id: editConta.id } : {}),
      codigo: codigo.trim(),
      nome: nome.trim(),
      tipo,
      grupo,
      subgrupo: subgrupo || null,
      centro_custo: centroCusto || null,
      ativo: true,
    });
    setShowForm(false);
  }

  function getLevel(codigo: string): number {
    return codigo.split('.').length - 1;
  }

  function getTipoInfo(tipo: string) {
    return TIPOS.find(t => t.value === tipo) || TIPOS[3];
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Plano de Contas</CardTitle>
              <CardDescription>Classificação contábil para DRE e relatórios financeiros</CardDescription>
            </div>
            <Button size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4 mr-1" /> Nova Conta
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0.5">
            {(contas || []).map(conta => {
              const level = getLevel(conta.codigo);
              const tipoInfo = getTipoInfo(conta.tipo);
              const isHeader = level === 0;

              return (
                <div
                  key={conta.id}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 group ${isHeader ? 'mt-3 first:mt-0' : ''}`}
                  style={{ paddingLeft: `${level * 24 + 8}px` }}
                >
                  {level > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                  <span className={`font-mono text-xs ${isHeader ? 'font-bold' : 'text-muted-foreground'}`}>
                    {conta.codigo}
                  </span>
                  <span className={`text-sm flex-1 ${isHeader ? 'font-bold' : ''}`}>
                    {conta.nome}
                  </span>
                  <Badge variant="outline" className={`text-[10px] ${tipoInfo.color}`}>
                    {tipoInfo.label}
                  </Badge>
                  {conta.centro_custo && (
                    <Badge variant="secondary" className="text-[10px]">
                      {conta.centro_custo}
                    </Badge>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openNew(conta.codigo)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(conta)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    {level > 0 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir "${conta.codigo} — ${conta.nome}"?`)) {
                            deleteMutation.mutate(conta.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) setShowForm(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editConta ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Código *</Label>
                <Input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="4.1.5" className="font-mono" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nome *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da conta" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={tipo} onValueChange={v => { setTipo(v); setGrupo(v === 'despesa_financeira' ? 'despesa' : v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Centro de Custo</Label>
                <Select value={centroCusto} onValueChange={setCentroCusto}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {CENTROS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Subgrupo</Label>
              <Input value={subgrupo} onChange={e => setSubgrupo(e.target.value)} placeholder="Ex: folha, infraestrutura..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
