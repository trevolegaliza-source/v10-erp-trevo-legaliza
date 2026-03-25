import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload } from 'lucide-react';
import { CATEGORIAS_DESPESAS, type CategoriaKey } from '@/constants/categorias-despesas';
import { useColaboradores } from '@/hooks/useColaboradores';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { toast } from 'sonner';
import * as LucideIcons from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (lancamento: Record<string, any>, recorrente?: Record<string, any>) => void;
  editData?: any;
  defaultMes: number;
  defaultAno: number;
}

export default function DespesaFormModal({ open, onClose, onSave, editData, defaultMes, defaultAno }: Props) {
  const { data: colaboradores } = useColaboradores();
  const activeColabs = (colaboradores || []).filter(c => c.status === 'ativo');

  const [categoria, setCategoria] = useState<CategoriaKey>('infraestrutura');
  const [subcategoria, setSubcategoria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [vincularColab, setVincularColab] = useState(false);
  const [colaboradorId, setColaboradorId] = useState('');
  const [compMes, setCompMes] = useState(defaultMes);
  const [compAno, setCompAno] = useState(defaultAno);
  const [observacoes, setObservacoes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [salvarRecorrente, setSalvarRecorrente] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editData) {
      setCategoria((editData.categoria || 'outros') as CategoriaKey);
      setSubcategoria(editData.subcategoria || '');
      setDescricao(editData.descricao || '');
      setValor(String(editData.valor || ''));
      setVencimento(editData.data_vencimento || '');
      setFornecedor(editData.fornecedor || '');
      setColaboradorId(editData.colaborador_id || '');
      setVincularColab(!!editData.colaborador_id);
      setCompMes(editData.competencia_mes || defaultMes);
      setCompAno(editData.competencia_ano || defaultAno);
      setObservacoes(editData.observacoes_financeiro || '');
      setSalvarRecorrente(false);
    } else {
      resetForm();
    }
  }, [editData, open, defaultMes, defaultAno]);

  const resetForm = () => {
    setCategoria('infraestrutura');
    setSubcategoria('');
    setDescricao('');
    setValor('');
    setVencimento('');
    setFornecedor('');
    setVincularColab(false);
    setColaboradorId('');
    setCompMes(defaultMes);
    setCompAno(defaultAno);
    setObservacoes('');
    setFile(null);
    setSalvarRecorrente(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor || !vencimento) return;
    setSaving(true);

    let comprovanteUrl: string | null = null;
    if (file) {
      try {
        const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const path = `comprovantes/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file, { upsert: true });
        if (error) throw error;
        comprovanteUrl = path;
      } catch (err: any) {
        toast.error('Erro no upload: ' + err.message);
        setSaving(false);
        return;
      }
    }

    const descFinal = `${subcategoria || categoria}${descricao ? ' - ' + descricao : ''}`;

    const lancamento: Record<string, any> = {
      tipo: 'pagar',
      descricao: descFinal,
      valor: Number(valor),
      data_vencimento: vencimento,
      status: editData?.status || 'pendente',
      categoria,
      subcategoria: subcategoria || null,
      fornecedor: fornecedor || null,
      colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
      competencia_mes: compMes,
      competencia_ano: compAno,
      etapa_financeiro: 'solicitacao_criada',
      observacoes_financeiro: observacoes || null,
      comprovante_url: comprovanteUrl || editData?.comprovante_url || null,
    };

    if (editData?.id) lancamento.id = editData.id;

    let recorrente: Record<string, any> | undefined;
    if (salvarRecorrente && !editData) {
      const diaVenc = new Date(vencimento).getDate();
      recorrente = {
        descricao: descFinal,
        categoria,
        subcategoria: subcategoria || null,
        valor: Number(valor),
        dia_vencimento: diaVenc,
        fornecedor: fornecedor || null,
        colaborador_id: vincularColab && colaboradorId ? colaboradorId : null,
        ativo: true,
        data_inicio: vencimento,
      };
    }

    onSave(lancamento, recorrente);
    setSaving(false);
    onClose();
  };

  const subcategorias = CATEGORIAS_DESPESAS[categoria]?.subcategorias || [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editData ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Categoria */}
          <div className="grid gap-2">
            <Label>Categoria *</Label>
            <Select value={categoria} onValueChange={v => { setCategoria(v as CategoriaKey); setSubcategoria(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORIAS_DESPESAS).map(([k, v]) => {
                  const Icon = (LucideIcons as any)[v.icon] || LucideIcons.Circle;
                  return (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" style={{ color: v.color }} />
                        {v.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Subcategoria */}
          <div className="grid gap-2">
            <Label>Subcategoria *</Label>
            <Select value={subcategoria} onValueChange={setSubcategoria}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {subcategorias.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes adicionais..." />
          </div>

          {/* Valor + Vencimento */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Valor *</Label>
              <Input type="number" step="0.01" min="0" required value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" />
            </div>
            <div className="grid gap-2">
              <Label>Vencimento *</Label>
              <Input type="date" required value={vencimento} onChange={e => {
                setVencimento(e.target.value);
                if (e.target.value) {
                  const d = new Date(e.target.value);
                  setCompMes(d.getMonth() + 1);
                  setCompAno(d.getFullYear());
                }
              }} />
            </div>
          </div>

          {/* Fornecedor */}
          <div className="grid gap-2">
            <Label>Fornecedor</Label>
            <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Quem recebe o pagamento..." />
          </div>

          {/* Vincular Colaborador */}
          <div className="rounded-lg border border-border/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">🔗 Vincular Colaborador</Label>
              <Switch checked={vincularColab} onCheckedChange={c => { setVincularColab(c); if (!c) setColaboradorId(''); }} />
            </div>
            {vincularColab && (
              <Select value={colaboradorId} onValueChange={setColaboradorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {activeColabs.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome} ({c.regime})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Competência */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Competência Mês</Label>
              <Input type="number" min={1} max={12} value={compMes} onChange={e => setCompMes(Number(e.target.value))} />
            </div>
            <div className="grid gap-2">
              <Label>Competência Ano</Label>
              <Input type="number" min={2020} max={2099} value={compAno} onChange={e => setCompAno(Number(e.target.value))} />
            </div>
          </div>

          {/* Observações */}
          <div className="grid gap-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas internas..." rows={2} />
          </div>

          {/* Upload */}
          <div className="grid gap-2">
            <Label>📎 Anexar Comprovante</Label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-border rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{file ? file.name : 'Selecionar arquivo...'}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {/* Checkbox recorrente */}
          {!editData && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 p-3">
              <Checkbox id="salvarRecorrente" checked={salvarRecorrente} onCheckedChange={c => setSalvarRecorrente(!!c)} />
              <label htmlFor="salvarRecorrente" className="text-sm cursor-pointer">Salvar também como Despesa Recorrente</label>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : editData ? 'Salvar Alterações' : 'Salvar Despesa'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
