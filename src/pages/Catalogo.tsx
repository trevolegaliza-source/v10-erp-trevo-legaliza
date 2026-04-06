import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Pencil, DollarSign, Trash2, BookOpen, Loader2, Save, ChevronDown, ChevronUp } from 'lucide-react';
import {
  useServicos,
  usePrecosUF,
  useCreateServico,
  useUpdateServico,
  useDeleteServico,
  useUpsertPrecoUF,
  CATEGORIAS_SERVICO,
  type ServicosCatalogo,
} from '@/hooks/useCatalogo';
import { UFS_BRASIL, UF_NOMES } from '@/constants/estados-brasil';
import { toast } from 'sonner';

const CATEGORIA_COLORS: Record<string, string> = {
  abertura: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  alteracao: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  transformacao: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  baixa: 'bg-red-500/15 text-red-500 border-red-500/30',
  licenca: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  certidao: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  regularizacao: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  registros_especiais: 'bg-indigo-500/15 text-indigo-500 border-indigo-500/30',
  marcas_patentes: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  cartorario: 'bg-slate-500/15 text-slate-500 border-slate-500/30',
  consultoria: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  recorrentes: 'bg-teal-500/15 text-teal-500 border-teal-500/30',
  outros: 'bg-muted text-muted-foreground',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ═══════════ CARD DE SERVIÇO ═══════════
function ServicoCard({
  servico,
  isExpanded,
  onToggle,
  onPrecos,
}: {
  servico: ServicosCatalogo;
  isExpanded: boolean;
  onToggle: () => void;
  onPrecos: () => void;
}) {
  const catLabel = CATEGORIAS_SERVICO.find(c => c.value === servico.categoria)?.label || servico.categoria;
  const updateMut = useUpdateServico();
  const deleteMut = useDeleteServico();

  const [editNome, setEditNome] = useState(servico.nome);
  const [editDesc, setEditDesc] = useState(servico.descricao || '');
  const [editPrazo, setEditPrazo] = useState(servico.prazo_estimado || '');
  const [editCat, setEditCat] = useState(servico.categoria);

  function handleSave() {
    updateMut.mutate({
      id: servico.id,
      updates: {
        nome: editNome,
        descricao: editDesc || undefined,
        prazo_estimado: editPrazo || undefined,
        categoria: editCat,
      },
    });
  }

  function handleDelete() {
    if (confirm('Tem certeza que deseja excluir este serviço e todos os preços associados?')) {
      deleteMut.mutate(servico.id);
    }
  }

  return (
    <Card className={`transition-all ${isExpanded ? 'ring-1 ring-primary/30' : 'hover:shadow-sm hover:bg-muted/20'}`}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{servico.nome}</span>
            <Badge variant="outline" className={`text-[10px] ${CATEGORIA_COLORS[servico.categoria] || ''}`}>
              {catLabel}
            </Badge>
          </div>
          {servico.descricao && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{servico.descricao}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {servico.prazo_estimado && (
              <Badge variant="outline" className="text-[10px] bg-muted/50">
                Prazo: {servico.prazo_estimado}
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${servico.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-red-500/10 text-red-500'}`}>
              {servico.ativo ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
      </button>

      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4">
          <Separator />

          {servico.descricao && (
            <div className="text-xs text-muted-foreground whitespace-pre-line bg-muted/30 rounded-lg p-3 max-h-60 overflow-y-auto">
              {servico.descricao}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Nome</label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Categoria</label>
              <Select value={editCat} onValueChange={setEditCat}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS_SERVICO.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground">Prazo estimado</label>
              <Input value={editPrazo} onChange={e => setEditPrazo(e.target.value)} className="h-8 text-xs mt-1" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground">Descrição</label>
            <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="text-xs mt-1" />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onPrecos}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Preços por UF
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ═══════════ COMPONENTE PRINCIPAL ═══════════
export default function Catalogo() {
  const { data: servicos = [], isLoading } = useServicos();
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('todas');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [servicoModal, setServicoModal] = useState<ServicosCatalogo | null>(null);
  const [precosServicoId, setPrecosServicoId] = useState<string | null>(null);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    servicos.forEach(s => {
      counts[s.categoria] = (counts[s.categoria] || 0) + 1;
    });
    return counts;
  }, [servicos]);

  const filtered = useMemo(() => {
    let list = servicos;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.nome.toLowerCase().includes(q) ||
        (s.descricao || '').toLowerCase().includes(q)
      );
    } else if (selectedCat !== 'todas') {
      list = list.filter(s => s.categoria === selectedCat);
    }
    return list;
  }, [servicos, search, selectedCat]);

  const precosServico = servicos.find(s => s.id === precosServicoId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Portfólio de Serviços
          </h1>
          <p className="text-sm text-muted-foreground">
            {servicos.length} serviços cadastrados · {CATEGORIAS_SERVICO.length} categorias
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      {/* Mobile: busca + select categoria */}
      <div className="md:hidden space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={selectedCat} onValueChange={v => { setSelectedCat(v); setSearch(''); }}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas ({servicos.length})</SelectItem>
            {CATEGORIAS_SERVICO.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label} ({catCounts[c.value] || 0})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Layout 2 colunas */}
      <div className="flex gap-6">
        {/* Sidebar categorias — desktop */}
        <div className="hidden md:flex flex-col gap-1 w-60 shrink-0">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar serviço..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>

          {search && (
            <p className="text-xs text-muted-foreground mb-2 px-2">
              {filtered.length} resultado(s) encontrado(s)
            </p>
          )}

          <button
            onClick={() => { setSelectedCat('todas'); setSearch(''); }}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              selectedCat === 'todas' && !search
                ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <span>Todos os serviços</span>
            <Badge variant="outline" className="text-[10px] h-5">{servicos.length}</Badge>
          </button>

          <Separator className="my-2" />

          {CATEGORIAS_SERVICO.map(cat => {
            const count = catCounts[cat.value] || 0;
            if (count === 0) return null;
            return (
              <button
                key={cat.value}
                onClick={() => { setSelectedCat(cat.value); setSearch(''); }}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCat === cat.value && !search
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <span className="truncate">{cat.label}</span>
                <Badge variant="outline" className="text-[10px] h-5 shrink-0 ml-2">{count}</Badge>
              </button>
            );
          })}
        </div>

        {/* Grid de cards */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando catálogo...
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BookOpen className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {servicos.length === 0 ? 'Nenhum serviço cadastrado. Clique em "+ Novo Serviço" para começar.' : 'Nenhum serviço encontrado com os filtros aplicados.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map(s => (
                <ServicoCard
                  key={s.id}
                  servico={s}
                  isExpanded={expandedId === s.id}
                  onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  onPrecos={() => setPrecosServicoId(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modais — INALTERADOS */}
      <ServicoFormModal
        open={showCreate || !!servicoModal}
        servico={servicoModal}
        onClose={() => { setShowCreate(false); setServicoModal(null); }}
      />
      {precosServicoId && precosServico && (
        <PrecosUFModal
          servicoId={precosServicoId}
          servicoNome={precosServico.nome}
          onClose={() => setPrecosServicoId(null)}
        />
      )}
    </div>
  );
}

// ═══════════ MODAL SERVIÇO (INALTERADO) ═══════════
function ServicoFormModal({ open, servico, onClose }: { open: boolean; servico: ServicosCatalogo | null; onClose: () => void }) {
  const createMut = useCreateServico();
  const updateMut = useUpdateServico();
  const deleteMut = useDeleteServico();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('abertura');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');

  const isEdit = !!servico;

  const [lastId, setLastId] = useState<string | null>(null);
  if (open && servico && servico.id !== lastId) {
    setNome(servico.nome);
    setCategoria(servico.categoria);
    setDescricao(servico.descricao || '');
    setPrazo(servico.prazo_estimado || '');
    setLastId(servico.id);
  } else if (open && !servico && lastId !== 'new') {
    setNome('');
    setCategoria('abertura');
    setDescricao('');
    setPrazo('');
    setLastId('new');
  }

  function handleSave() {
    if (!nome.trim()) return;
    const payload = { nome: nome.trim(), categoria, descricao: descricao.trim() || undefined, prazo_estimado: prazo.trim() || undefined };
    if (isEdit && servico) {
      updateMut.mutate({ id: servico.id, updates: payload }, { onSuccess: () => { onClose(); setLastId(null); } });
    } else {
      createMut.mutate(payload, { onSuccess: () => { onClose(); setLastId(null); } });
    }
  }

  function handleDelete() {
    if (!servico) return;
    if (!confirm('Excluir este serviço e todos os preços associados?')) return;
    deleteMut.mutate(servico.id, { onSuccess: () => { onClose(); setLastId(null); } });
  }

  const loading = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setLastId(null); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium">Nome do serviço *</label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Abertura de MEI" />
          </div>
          <div>
            <label className="text-xs font-medium">Categoria *</label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS_SERVICO.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium">Descrição</label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do serviço..." rows={3} />
          </div>
          <div>
            <label className="text-xs font-medium">Prazo estimado</label>
            <Input value={prazo} onChange={e => setPrazo(e.target.value)} placeholder="Ex: 15-20 dias úteis" />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEdit && (
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleteMut.isPending} className="mr-auto">
              <Trash2 className="h-4 w-4 mr-1" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={() => { onClose(); setLastId(null); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading || !nome.trim()}>
            {loading && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════ MODAL PREÇOS POR UF (INALTERADO) ═══════════
function PrecosUFModal({ servicoId, servicoNome, onClose }: { servicoId: string; servicoNome: string; onClose: () => void }) {
  const { data: precos = [], isLoading } = usePrecosUF(servicoId);
  const upsertMut = useUpsertPrecoUF();

  const [formData, setFormData] = useState<Record<string, { honorario: string; taxa: string; obs: string }>>({});
  const [initialized, setInitialized] = useState(false);

  if (!isLoading && !initialized) {
    const initial: typeof formData = {};
    for (const uf of UFS_BRASIL) {
      const existing = precos.find(p => p.uf === uf);
      initial[uf] = {
        honorario: existing ? String(existing.honorario_trevo) : '',
        taxa: existing ? String(existing.taxa_orgao) : '',
        obs: existing?.observacoes || '',
      };
    }
    setFormData(initial);
    setInitialized(true);
  }

  function updateField(uf: string, field: 'honorario' | 'taxa' | 'obs', value: string) {
    setFormData(prev => ({
      ...prev,
      [uf]: { ...prev[uf], [field]: value },
    }));
  }

  async function handleSaveAll() {
    let count = 0;
    for (const uf of UFS_BRASIL) {
      const d = formData[uf];
      if (!d) continue;
      const hon = parseFloat(d.honorario) || 0;
      const taxa = parseFloat(d.taxa) || 0;
      if (hon === 0 && taxa === 0 && !d.obs) continue;
      await upsertMut.mutateAsync({
        servico_id: servicoId,
        uf,
        honorario_trevo: hon,
        taxa_orgao: taxa,
        observacoes: d.obs || undefined,
      });
      count++;
    }
    if (count === 0) {
      toast.info('Nenhum preço preenchido para salvar.');
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Preços — {servicoNome}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando preços...</div>
        ) : (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10">
                  <tr className="border-b bg-muted/40">
                    <th className="text-left p-2 font-medium w-24">UF</th>
                    <th className="text-left p-2 font-medium">Honorário (R$)</th>
                    <th className="text-left p-2 font-medium">Taxa Órgão (R$)</th>
                    <th className="text-right p-2 font-medium w-28">Total</th>
                    <th className="text-left p-2 font-medium">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {UFS_BRASIL.map(uf => {
                    const d = formData[uf] || { honorario: '', taxa: '', obs: '' };
                    const total = (parseFloat(d.honorario) || 0) + (parseFloat(d.taxa) || 0);
                    return (
                      <tr key={uf} className="border-b last:border-0 hover:bg-muted/10">
                        <td className="p-2">
                          <span className="font-medium">{uf}</span>
                          <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">{UF_NOMES[uf]}</span>
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={d.honorario}
                            onChange={e => updateField(uf, 'honorario', e.target.value)}
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="p-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0,00"
                            value={d.taxa}
                            onChange={e => updateField(uf, 'taxa', e.target.value)}
                            className="h-8 w-28"
                          />
                        </td>
                        <td className="p-2 text-right font-medium text-muted-foreground">
                          {total > 0 ? fmt(total) : '—'}
                        </td>
                        <td className="p-2">
                          <Input
                            placeholder="Observações"
                            value={d.obs}
                            onChange={e => updateField(uf, 'obs', e.target.value)}
                            className="h-8"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        )}

        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handleSaveAll} disabled={upsertMut.isPending}>
            {upsertMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Salvar Todos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
