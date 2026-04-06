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
import { Search, Plus, Pencil, DollarSign, Trash2, BookOpen, Loader2, Save } from 'lucide-react';
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

const CATEGORIA_COLORS: Record<string, string> = {
  abertura: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  alteracao: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  transformacao: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
  baixa: 'bg-red-500/15 text-red-500 border-red-500/30',
  licenca: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  certidao: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
  regularizacao: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  consultoria: 'bg-pink-500/15 text-pink-500 border-pink-500/30',
  outros: 'bg-muted text-muted-foreground',
};

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Catalogo() {
  const { data: servicos = [], isLoading } = useServicos();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('todas');
  const [servicoModal, setServicoModal] = useState<ServicosCatalogo | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [precosServicoId, setPrecosServicoId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = servicos;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.nome.toLowerCase().includes(q) || (s.descricao || '').toLowerCase().includes(q));
    }
    if (catFilter !== 'todas') {
      list = list.filter(s => s.categoria === catFilter);
    }
    return list;
  }, [servicos, search, catFilter]);

  const precosServico = servicos.find(s => s.id === precosServicoId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Portfólio de Serviços
          </h1>
          <p className="text-sm text-muted-foreground">Catálogo de serviços e tabela de preços por UF</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Serviço
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar serviço..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-52 h-9">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {CATEGORIAS_SERVICO.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">Carregando...</div>
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
        <div className="rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium">Serviço</th>
                  <th className="text-left p-3 font-medium">Categoria</th>
                  <th className="text-left p-3 font-medium">Prazo</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const catLabel = CATEGORIAS_SERVICO.find(c => c.value === s.categoria)?.label || s.categoria;
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3">
                        <p className="font-medium">{s.nome}</p>
                        {s.descricao && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{s.descricao}</p>}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${CATEGORIA_COLORS[s.categoria] || ''}`}>
                          {catLabel}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{s.prazo_estimado || '—'}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={s.ativo ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs' : 'text-xs'}>
                          {s.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setServicoModal(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setPrecosServicoId(s.id)}>
                            <DollarSign className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal criar/editar */}
      <ServicoFormModal
        open={showCreate || !!servicoModal}
        servico={servicoModal}
        onClose={() => { setShowCreate(false); setServicoModal(null); }}
      />

      {/* Modal preços por UF */}
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

// ═══════════ MODAL SERVIÇO ═══════════
function ServicoFormModal({ open, servico, onClose }: { open: boolean; servico: ServicosCatalogo | null; onClose: () => void }) {
  const createMut = useCreateServico();
  const updateMut = useUpdateServico();
  const deleteMut = useDeleteServico();

  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('abertura');
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');

  const isEdit = !!servico;

  // Sync form when servico changes
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

// ═══════════ MODAL PREÇOS POR UF ═══════════
function PrecosUFModal({ servicoId, servicoNome, onClose }: { servicoId: string; servicoNome: string; onClose: () => void }) {
  const { data: precos = [], isLoading } = usePrecosUF(servicoId);
  const upsertMut = useUpsertPrecoUF();

  // Local state for all 27 UFs
  const [formData, setFormData] = useState<Record<string, { honorario: string; taxa: string; obs: string }>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize form from DB data
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

// Need toast import for PrecosUFModal
import { toast } from 'sonner';
