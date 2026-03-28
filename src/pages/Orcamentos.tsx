import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useOrcamentos, useOrcamentoKPIs, useSaveOrcamento, useDeleteOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, Send, CheckCircle, TrendingUp, MoreHorizontal,
  Copy, Download, Trash2, Pencil, Link as LinkIcon, Save, FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', color: 'bg-blue-500/10 text-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-primary/10 text-primary' },
  recusado: { label: 'Recusado', color: 'bg-destructive/10 text-destructive' },
  expirado: { label: 'Expirado', color: 'bg-amber-500/10 text-amber-500' },
  convertido: { label: 'Convertido', color: 'bg-primary/10 text-primary' },
};

export interface OrcamentoItem {
  id: string;
  descricao: string;
  detalhes: string;
  valor: number;
  quantidade: number;
}

interface OrcamentoForm {
  prospect_nome: string;
  prospect_cnpj: string;
  prospect_email: string;
  prospect_telefone: string;
  prospect_contato: string;
  cliente_id: string | null;
  itens: OrcamentoItem[];
  desconto_pct: number;
  validade_dias: number;
  prazo_execucao: string;
  pagamento: string;
  observacoes: string;
  status: string;
}

const emptyForm = (): OrcamentoForm => ({
  prospect_nome: '',
  prospect_cnpj: '',
  prospect_email: '',
  prospect_telefone: '',
  prospect_contato: '',
  cliente_id: null,
  itens: [],
  desconto_pct: 0,
  validade_dias: 15,
  prazo_execucao: '',
  pagamento: '',
  observacoes: '',
  status: 'rascunho',
});

function formFromOrcamento(orc: Orcamento): OrcamentoForm {
  // servicos jsonb stores items array now
  let itens: OrcamentoItem[] = [];
  try {
    const raw = orc.servicos as any;
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'object' && 'descricao' in raw[0]) {
      itens = raw.map((r: any) => ({
        id: r.id || crypto.randomUUID(),
        descricao: r.descricao || '',
        detalhes: r.detalhes || '',
        valor: Number(r.valor) || 0,
        quantidade: Number(r.quantidade) || 1,
      }));
    }
  } catch { /* ignore */ }

  return {
    prospect_nome: orc.prospect_nome,
    prospect_cnpj: orc.prospect_cnpj || '',
    prospect_email: orc.prospect_email || '',
    prospect_telefone: orc.prospect_telefone || '',
    prospect_contato: orc.prospect_contato || '',
    cliente_id: orc.cliente_id || null,
    itens,
    desconto_pct: orc.desconto_pct,
    validade_dias: orc.validade_dias,
    prazo_execucao: (orc as any).prazo_execucao || '',
    pagamento: orc.pagamento || '',
    observacoes: orc.observacoes || '',
    status: orc.status,
  };
}

export default function Orcamentos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrcamentoForm>(emptyForm());

  const { data: orcamentos, isLoading } = useOrcamentos(tab);
  const { data: kpis } = useOrcamentoKPIs();
  const saveMutation = useSaveOrcamento();
  const deleteMutation = useDeleteOrcamento();

  // Load clients for selector
  const { data: clientes } = useQuery({
    queryKey: ['clientes_select'],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('id, nome, apelido, cnpj, email, telefone').eq('is_archived', false).order('nome');
      return data || [];
    },
  });

  // Ctrl+O shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        openNew();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Computed values
  const subtotal = form.itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
  const descontoValor = subtotal * (form.desconto_pct / 100);
  const totalFinal = subtotal - descontoValor;

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(orc: Orcamento) {
    setForm(formFromOrcamento(orc));
    setEditingId(orc.id);
    setShowForm(true);
  }

  function handleSelectCliente(clienteId: string) {
    const c = clientes?.find(cl => cl.id === clienteId);
    if (!c) return;
    setForm(f => ({
      ...f,
      cliente_id: c.id,
      prospect_nome: c.apelido || c.nome,
      prospect_cnpj: c.cnpj || '',
      prospect_email: c.email || '',
      prospect_telefone: c.telefone || '',
    }));
  }

  function addItem() {
    setForm(f => ({
      ...f,
      itens: [...f.itens, { id: crypto.randomUUID(), descricao: '', detalhes: '', valor: 0, quantidade: 1 }],
    }));
  }

  function updateItem(idx: number, field: keyof OrcamentoItem, value: any) {
    setForm(f => ({
      ...f,
      itens: f.itens.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
  }

  function buildPayload(status: string) {
    return {
      prospect_nome: form.prospect_nome,
      prospect_cnpj: form.prospect_cnpj || null,
      prospect_email: form.prospect_email || null,
      prospect_telefone: form.prospect_telefone || null,
      prospect_contato: form.prospect_contato || null,
      cliente_id: form.cliente_id,
      servicos: form.itens as any, // store items in servicos jsonb
      naturezas: [] as any,
      escopo: [] as any,
      tipo_contrato: 'avulso',
      valor_base: subtotal,
      valor_final: totalFinal,
      desconto_pct: form.desconto_pct,
      qtd_processos: 1,
      desconto_progressivo_ativo: false,
      desconto_progressivo_pct: 0,
      desconto_progressivo_limite: 0,
      validade_dias: form.validade_dias,
      pagamento: form.pagamento || null,
      sla: null,
      observacoes: form.observacoes || null,
      prazo_execucao: form.prazo_execucao || null,
      status,
      created_by: null,
      pdf_url: null,
    };
  }

  async function handleSave(status: string) {
    if (!form.prospect_nome?.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    try {
      const payload: any = buildPayload(status);
      if (editingId) payload.id = editingId;
      const id = await saveMutation.mutateAsync(payload);
      toast.success(status === 'enviado' ? 'Orçamento salvo e pronto para envio!' : 'Rascunho salvo!');

      if (status === 'enviado') {
        try {
          const doc = await gerarOrcamentoPDF({
            prospect_nome: form.prospect_nome,
            prospect_cnpj: form.prospect_cnpj,
            itens: form.itens,
            desconto_pct: form.desconto_pct,
            subtotal,
            total: totalFinal,
            validade_dias: form.validade_dias,
            prazo_execucao: form.prazo_execucao,
            pagamento: form.pagamento,
            observacoes: form.observacoes,
            numero: (orcamentos?.find(o => o.id === id) as any)?.numero || 0,
            data_emissao: new Date().toLocaleDateString('pt-BR'),
          });
          doc.save(`orcamento_${form.prospect_nome.replace(/\s/g, '_')}.pdf`);
        } catch { /* PDF generation optional */ }
      }
      setShowForm(false);
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }

  async function handleDownloadPDF(orc: Orcamento) {
    try {
      const f = formFromOrcamento(orc);
      const sub = f.itens.reduce((s, i) => s + i.valor * i.quantidade, 0);
      const desc = sub * (f.desconto_pct / 100);
      const doc = await gerarOrcamentoPDF({
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj,
        itens: f.itens,
        desconto_pct: f.desconto_pct,
        subtotal: sub,
        total: sub - desc,
        validade_dias: orc.validade_dias,
        prazo_execucao: f.prazo_execucao,
        pagamento: orc.pagamento,
        observacoes: orc.observacoes,
        numero: orc.numero,
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
      });
      doc.save(`orcamento_${String(orc.numero).padStart(3, '0')}_${orc.prospect_nome.replace(/\s/g, '_')}.pdf`);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    }
  }

  function handleDuplicate(orc: Orcamento) {
    const f = formFromOrcamento(orc);
    setForm({ ...f, prospect_nome: f.prospect_nome + ' (cópia)', status: 'rascunho' });
    setEditingId(null);
    setShowForm(true);
  }

  function handleCopyLink(orc: Orcamento) {
    const url = `${window.location.origin}/orcamento/${orc.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Propostas comerciais personalizadas</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> Novo Orçamento</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: kpis?.total ?? 0, icon: FileText, color: 'text-foreground' },
          { label: 'Enviados', value: kpis?.enviados ?? 0, icon: Send, color: 'text-blue-500' },
          { label: 'Aprovados', value: kpis?.aprovados ?? 0, icon: CheckCircle, color: 'text-primary' },
          { label: 'Taxa Conversão', value: `${kpis?.taxa ?? 0}%`, icon: TrendingUp, color: 'text-primary' },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              </div>
              <k.icon className={`h-5 w-5 ${k.color} opacity-50`} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos</TabsTrigger>
          <TabsTrigger value="rascunho">Rascunhos</TabsTrigger>
          <TabsTrigger value="enviado">Enviados</TabsTrigger>
          <TabsTrigger value="aprovado">Aprovados</TabsTrigger>
          <TabsTrigger value="convertido">Convertidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : !orcamentos?.length ? (
            <Card className="p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum orçamento encontrado</p>
              <Button variant="outline" className="mt-3" onClick={openNew}>Criar primeiro orçamento</Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {orcamentos.map(orc => {
                const st = STATUS_MAP[orc.status] || STATUS_MAP.rascunho;
                const itemCount = Array.isArray(orc.servicos) ? orc.servicos.length : 0;
                return (
                  <Card key={orc.id} className="p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">#{String(orc.numero).padStart(3, '0')}</span>
                        <div>
                          <p className="text-sm font-semibold">{orc.prospect_nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {itemCount} {itemCount === 1 ? 'item' : 'itens'} · {new Date(orc.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold">{fmt(orc.valor_final)}</p>
                        <Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(orc)}><Pencil className="h-3.5 w-3.5 mr-2" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(orc)}><Copy className="h-3.5 w-3.5 mr-2" />Duplicar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCopyLink(orc)}><LinkIcon className="h-3.5 w-3.5 mr-2" />Copiar Link</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownloadPDF(orc)}><Download className="h-3.5 w-3.5 mr-2" />Baixar PDF</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => deleteMutation.mutate(orc.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Excluir</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Orçamento' : 'Nova Proposta Comercial'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Section 1: Cliente */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Cliente</h3>
              <div>
                <Label>Buscar cliente existente (opcional)</Label>
                <Select onValueChange={handleSelectCliente} value={form.cliente_id || undefined}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente existente..." /></SelectTrigger>
                  <SelectContent>
                    {clientes?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.apelido || c.nome}{c.cnpj ? ` · ${c.cnpj}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome / Razão Social *</Label><Input value={form.prospect_nome} onChange={e => setForm(f => ({ ...f, prospect_nome: e.target.value }))} placeholder="Nome do cliente ou prospect" /></div>
                <div><Label>CNPJ</Label><Input value={form.prospect_cnpj} onChange={e => setForm(f => ({ ...f, prospect_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contato</Label><Input value={form.prospect_contato} onChange={e => setForm(f => ({ ...f, prospect_contato: e.target.value }))} placeholder="Nome da pessoa de contato" /></div>
                <div><Label>Email</Label><Input value={form.prospect_email} onChange={e => setForm(f => ({ ...f, prospect_email: e.target.value }))} placeholder="email@empresa.com" /></div>
              </div>
            </div>

            {/* Section 2: Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Itens da Proposta</h3>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-4 w-4 mr-1" /> Adicionar Item</Button>
              </div>

              {form.itens.map((item, idx) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                      <Input
                        value={item.descricao}
                        onChange={e => updateItem(idx, 'descricao', e.target.value)}
                        placeholder="Descrição do serviço (ex: Transferência de empresa da Alemanha para o Brasil)"
                        className="font-medium"
                      />
                      <Textarea
                        value={item.detalhes}
                        onChange={e => updateItem(idx, 'detalhes', e.target.value)}
                        placeholder="Detalhes adicionais, escopo, observações deste item... (opcional)"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-2 w-36">
                      <div>
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          type="number"
                          value={item.valor || ''}
                          onChange={e => updateItem(idx, 'valor', parseFloat(e.target.value) || 0)}
                          placeholder="0,00"
                          className="text-right font-bold"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input
                          type="number"
                          value={item.quantidade}
                          onChange={e => updateItem(idx, 'quantidade', parseInt(e.target.value) || 1)}
                          min={1}
                          className="text-center"
                        />
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive mt-1">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="text-right mt-2 text-sm font-bold text-primary">
                    Subtotal: {fmt(item.valor * item.quantidade)}
                  </div>
                </Card>
              ))}

              {form.itens.length === 0 && (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum item adicionado</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar primeiro item
                  </Button>
                </div>
              )}
            </div>

            {/* Section 3: Financial Summary */}
            {form.itens.some(i => i.descricao) && (
              <Card className="p-5 bg-[hsl(var(--primary)/0.05)] border-primary/20">
                <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-4">Resumo Financeiro</h3>
                <div className="space-y-2 text-sm">
                  {form.itens.filter(i => i.descricao).map(item => (
                    <div key={item.id} className="flex justify-between">
                      <span className="text-muted-foreground truncate mr-4">
                        {item.descricao} {item.quantidade > 1 ? `(×${item.quantidade})` : ''}
                      </span>
                      <span className="font-bold whitespace-nowrap">{fmt(item.valor * item.quantidade)}</span>
                    </div>
                  ))}
                </div>
                {form.desconto_pct > 0 && (
                  <div className="flex justify-between mt-2 pt-2 border-t border-border text-sm">
                    <span className="text-muted-foreground">Desconto ({form.desconto_pct}%)</span>
                    <span className="text-destructive">- {fmt(descontoValor)}</span>
                  </div>
                )}
                <div className="flex justify-between mt-3 pt-3 border-t border-border">
                  <span className="font-bold uppercase text-xs tracking-wider text-muted-foreground">Total</span>
                  <span className="text-2xl font-extrabold text-primary">{fmt(totalFinal)}</span>
                </div>
              </Card>
            )}

            {/* Section 4: Conditions */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Condições</h3>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Validade (dias)</Label><Input type="number" value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: Number(e.target.value) || 15 }))} /></div>
                <div><Label>Desconto geral (%)</Label><Input type="number" value={form.desconto_pct || ''} onChange={e => setForm(f => ({ ...f, desconto_pct: Number(e.target.value) || 0 }))} min={0} max={100} /></div>
                <div><Label>Prazo de execução</Label><Input value={form.prazo_execucao} onChange={e => setForm(f => ({ ...f, prazo_execucao: e.target.value }))} placeholder="Ex: 15 dias úteis" /></div>
              </div>
              <div><Label>Condições de pagamento</Label><Textarea value={form.pagamento} onChange={e => setForm(f => ({ ...f, pagamento: e.target.value }))} rows={2} placeholder="Ex: 50% no aceite + 50% na conclusão" /></div>
              <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Observações adicionais, ressalvas, informações importantes..." /></div>
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
            </Button>
            <Button onClick={() => handleSave('enviado')} disabled={saveMutation.isPending}>
              <FileDown className="h-4 w-4 mr-1" /> Gerar PDF & Copiar Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
