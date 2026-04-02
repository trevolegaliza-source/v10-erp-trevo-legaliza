import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSaveOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, FileText, Trash2, Save, FileDown, ArrowLeft, Link as LinkIcon, Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface OrcamentoItem {
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
}

const defaultForm = (): OrcamentoForm => ({
  prospect_nome: '',
  prospect_cnpj: '',
  prospect_email: '',
  prospect_telefone: '',
  prospect_contato: '',
  cliente_id: null,
  itens: [{ id: crypto.randomUUID(), descricao: '', detalhes: '', valor: 0, quantidade: 1 }],
  desconto_pct: 0,
  validade_dias: 15,
  prazo_execucao: 'Prazo de execução: até 15 dias úteis após recebimento da documentação completa.',
  pagamento: 'Pagamento à vista via PIX ou boleto bancário.',
  observacoes: '',
});

export default function OrcamentoNovo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [form, setForm] = useState<OrcamentoForm>(defaultForm());
  const [orcamentoId, setOrcamentoId] = useState<string | null>(editId);
  const [orcamentoNumero, setOrcamentoNumero] = useState<number>(0);
  const saveMutation = useSaveOrcamento();

  const { data: clientes } = useQuery({
    queryKey: ['clientes_select'],
    queryFn: async () => {
      const { data } = await supabase.from('clientes').select('id, nome, apelido, cnpj, email, telefone').eq('is_archived', false).order('nome');
      return data || [];
    },
  });

  // Load existing orcamento if editing
  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from('orcamentos').select('*').eq('id', editId).single();
      if (!data) return;
      const orc = data as unknown as Orcamento;
      setOrcamentoNumero(orc.numero);
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
      setForm({
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj || '',
        prospect_email: orc.prospect_email || '',
        prospect_telefone: orc.prospect_telefone || '',
        prospect_contato: orc.prospect_contato || '',
        cliente_id: orc.cliente_id || null,
        itens: itens.length ? itens : [{ id: crypto.randomUUID(), descricao: '', detalhes: '', valor: 0, quantidade: 1 }],
        desconto_pct: orc.desconto_pct,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento || '',
        observacoes: orc.observacoes || '',
      });
    })();
  }, [editId]);

  const subtotal = useMemo(() => form.itens.reduce((s, i) => s + i.valor * i.quantidade, 0), [form.itens]);
  const descontoValor = subtotal * (form.desconto_pct / 100);
  const totalFinal = subtotal - descontoValor;

  function addItem() {
    setForm(f => ({ ...f, itens: [...f.itens, { id: crypto.randomUUID(), descricao: '', detalhes: '', valor: 0, quantidade: 1 }] }));
  }

  function updateItem(idx: number, field: keyof OrcamentoItem, value: any) {
    setForm(f => ({ ...f, itens: f.itens.map((item, i) => i === idx ? { ...item, [field]: value } : item) }));
  }

  function removeItem(idx: number) {
    setForm(f => ({ ...f, itens: f.itens.filter((_, i) => i !== idx) }));
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

  function buildPayload(status: string) {
    return {
      prospect_nome: form.prospect_nome,
      prospect_cnpj: form.prospect_cnpj || null,
      prospect_email: form.prospect_email || null,
      prospect_telefone: form.prospect_telefone || null,
      prospect_contato: form.prospect_contato || null,
      cliente_id: form.cliente_id,
      servicos: form.itens as any,
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

  async function handleSave(status: string = 'rascunho') {
    if (!form.prospect_nome?.trim()) {
      toast.error('Informe o nome do cliente');
      return;
    }
    try {
      const payload: any = buildPayload(status);
      if (orcamentoId) payload.id = orcamentoId;
      const id = await saveMutation.mutateAsync(payload);
      setOrcamentoId(id);
      toast.success(status === 'enviado' ? 'Proposta salva e pronta!' : 'Rascunho salvo!');
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }

  async function gerarPDF() {
    if (!form.prospect_nome.trim()) {
      toast.error('Preencha o nome do cliente');
      return;
    }
    const itensValidos = form.itens.filter(i => i.descricao.trim());
    if (itensValidos.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    const toastId = toast.loading('Gerando PDF...');
    try {
      // Save first
      await handleSave('enviado');

      const doc = await gerarOrcamentoPDF({
        prospect_nome: form.prospect_nome,
        prospect_cnpj: form.prospect_cnpj,
        itens: itensValidos,
        desconto_pct: form.desconto_pct,
        subtotal,
        total: totalFinal,
        validade_dias: form.validade_dias,
        prazo_execucao: form.prazo_execucao,
        pagamento: form.pagamento,
        observacoes: form.observacoes,
        numero: orcamentoNumero || 0,
        data_emissao: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }),
      });
      doc.save(`Proposta_${form.prospect_nome.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.dismiss(toastId);
      toast.success('PDF gerado com sucesso!');
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Erro ao gerar PDF');
      console.error(err);
    }
  }

  function handleDuplicate() {
    setForm(f => ({ ...f, prospect_nome: f.prospect_nome + ' (cópia)' }));
    setOrcamentoId(null);
    setOrcamentoNumero(0);
    toast.success('Duplicado! Salve para criar um novo orçamento.');
  }

  const validItems = form.itens.filter(i => i.descricao.trim());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orcamentos')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {editId ? 'Editar Proposta' : 'Nova Proposta Comercial'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Preencha os dados e gere um PDF profissional em minutos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar Rascunho
          </Button>
          {orcamentoId && (
            <Button variant="outline" size="sm" onClick={handleDuplicate}>
              <Copy className="h-4 w-4 mr-1" /> Duplicar
            </Button>
          )}
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Form (60%) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Cliente */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Cliente</h3>
            <div className="space-y-3">
              <Select onValueChange={handleSelectCliente} value={form.cliente_id || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar cliente existente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {clientes?.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.apelido || c.nome}{c.cnpj ? ` · ${c.cnpj}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nome / Razão Social *</Label>
                  <Input value={form.prospect_nome} onChange={e => setForm(f => ({ ...f, prospect_nome: e.target.value }))} placeholder="Nome do cliente" />
                </div>
                <div>
                  <Label className="text-xs">CNPJ</Label>
                  <Input value={form.prospect_cnpj} onChange={e => setForm(f => ({ ...f, prospect_cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input value={form.prospect_email} onChange={e => setForm(f => ({ ...f, prospect_email: e.target.value }))} placeholder="email@empresa.com" />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={form.prospect_telefone} onChange={e => setForm(f => ({ ...f, prospect_telefone: e.target.value }))} placeholder="(11) 99999-9999" />
                </div>
              </div>
            </div>
          </Card>

          {/* Itens */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Itens da Proposta</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar Item
              </Button>
            </div>

            <div className="space-y-3">
              {form.itens.map((item, idx) => (
                <div key={item.id} className="p-4 rounded-lg border bg-card space-y-2">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        value={item.descricao}
                        onChange={e => updateItem(idx, 'descricao', e.target.value)}
                        placeholder="Descrição do serviço (ex: Retorno ao Simples Nacional)"
                        className="font-medium"
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        value={item.valor || ''}
                        onChange={e => updateItem(idx, 'valor', parseFloat(e.target.value) || 0)}
                        placeholder="Valor R$"
                        className="text-right"
                      />
                    </div>
                    <div className="w-16">
                      <Input
                        type="number"
                        value={item.quantidade}
                        onChange={e => updateItem(idx, 'quantidade', parseInt(e.target.value) || 1)}
                        min={1}
                        className="text-center"
                      />
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    value={item.detalhes}
                    onChange={e => updateItem(idx, 'detalhes', e.target.value)}
                    placeholder="Detalhes, escopo, o que está incluso... (opcional)"
                    rows={2}
                    className="text-sm"
                  />
                  <p className="text-right text-sm font-bold text-primary">
                    Subtotal: {fmt(item.valor * item.quantidade)}
                  </p>
                </div>
              ))}

              {form.itens.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed rounded-lg text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Adicione o primeiro item da proposta</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar Item
                  </Button>
                </div>
              )}
            </div>
          </Card>

          {/* Condições */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-3">Condições</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Validade (dias)</Label>
                  <Input type="number" value={form.validade_dias} onChange={e => setForm(f => ({ ...f, validade_dias: parseInt(e.target.value) || 15 }))} />
                </div>
                <div>
                  <Label className="text-xs">Desconto geral (%)</Label>
                  <Input type="number" value={form.desconto_pct || ''} onChange={e => setForm(f => ({ ...f, desconto_pct: parseFloat(e.target.value) || 0 }))} min={0} max={100} />
                </div>
                <div>
                  <Label className="text-xs">Prazo de execução</Label>
                  <Input value={form.prazo_execucao} onChange={e => setForm(f => ({ ...f, prazo_execucao: e.target.value }))} placeholder="Ex: 15 dias úteis" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Condições de pagamento</Label>
                <Textarea value={form.pagamento} onChange={e => setForm(f => ({ ...f, pagamento: e.target.value }))} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Observações</Label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Taxas governamentais não inclusas, documentação necessária, etc." />
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT: Preview (40%) */}
        <div className="lg:col-span-2">
          <div className="sticky top-20 space-y-4">
            {/* Live Preview Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-br from-[hsl(120,60%,8%)] to-[hsl(120,40%,12%)] p-5 text-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg font-extrabold">
                    <span className="text-primary">Trevo</span>{' '}
                    <span className="opacity-60">Legaliza</span>
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[3px] text-primary/80 mb-1">
                  Proposta Comercial
                </p>

                {form.prospect_nome && (
                  <div className="mb-4">
                    <p className="text-[10px] text-primary/60">Preparada para</p>
                    <p className="font-bold text-sm">{form.prospect_nome}</p>
                    {form.prospect_cnpj && <p className="text-[10px] opacity-40">{form.prospect_cnpj}</p>}
                  </div>
                )}

                {validItems.length > 0 && (
                  <div className="space-y-1.5 mb-4">
                    {validItems.map((item, idx) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="opacity-70 truncate mr-3">
                          {idx + 1}. {item.descricao}{item.quantidade > 1 ? ` (×${item.quantidade})` : ''}
                        </span>
                        <span className="font-bold whitespace-nowrap">
                          {fmt(item.valor * item.quantidade)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {form.desconto_pct > 0 && subtotal > 0 && (
                  <div className="flex justify-between text-xs border-t border-white/10 pt-2">
                    <span className="opacity-50">Desconto ({form.desconto_pct}%)</span>
                    <span className="text-primary/80">-{fmt(descontoValor)}</span>
                  </div>
                )}

                <div className="flex justify-between border-t border-white/20 pt-3 mt-3">
                  <span className="text-primary/80 font-bold text-[10px] uppercase">Total</span>
                  <span className="text-xl font-extrabold">
                    {fmt(totalFinal)}
                  </span>
                </div>

                <p className="mt-3 text-[10px] opacity-30">
                  Válida por {form.validade_dias} dias
                  {form.pagamento ? ` · ${form.pagamento.substring(0, 50)}${form.pagamento.length > 50 ? '...' : ''}` : ''}
                </p>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button onClick={gerarPDF} className="w-full gap-2" disabled={saveMutation.isPending}>
                <FileDown className="h-4 w-4" /> Gerar PDF
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => handleSave('rascunho')} disabled={saveMutation.isPending} className="gap-1">
                  <Save className="h-4 w-4" /> Salvar
                </Button>
                <Button variant="outline" onClick={handleDuplicate} className="gap-1">
                  <Copy className="h-4 w-4" /> Duplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
