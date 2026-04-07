import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSaveOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF, sanitizeFilename } from '@/lib/orcamento-pdf';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Plus, FileText, Save, FileDown, ArrowLeft, Copy,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  type OrcamentoForm, type OrcamentoModo, type OrcamentoItem,
  DEFAULT_SECOES, createItem, normalizeItem, getItemValor,
} from '@/components/orcamentos/types';
import { ItemCardSimples } from '@/components/orcamentos/ItemCardSimples';
import { ItemCardDetalhado } from '@/components/orcamentos/ItemCardDetalhado';
import { PacotesEditor } from '@/components/orcamentos/PacotesEditor';
import { PreviewDetalhado } from '@/components/orcamentos/PreviewDetalhado';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const defaultForm = (): OrcamentoForm => ({
  prospect_nome: '',
  prospect_cnpj: '',
  prospect_email: '',
  prospect_telefone: '',
  prospect_contato: '',
  cliente_id: null,
  modo: 'simples',
  contexto: '',
  ordem_execucao: '',
  itens: [createItem()],
  pacotes: [],
  secoes: [...DEFAULT_SECOES],
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
  const [modoContador, setModoContador] = useState(false);
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
      const orc = data as unknown as Orcamento & { contexto?: string; ordem_execucao?: string; pacotes?: any; secoes?: any };
      setOrcamentoNumero(orc.numero);

      let itens: OrcamentoItem[] = [];
      try {
        const raw = orc.servicos as any;
        if (Array.isArray(raw) && raw.length > 0) {
          itens = raw.map(normalizeItem);
        }
      } catch { /* ignore */ }

      // Detect mode: if any item has taxa_min/taxa_max/prazo/docs, it's detailed
      const hasDetailedData = itens.some(i => i.taxa_min > 0 || i.taxa_max > 0 || i.prazo || i.docs_necessarios);
      const hasContexto = !!(orc as any).contexto;
      const modo: OrcamentoModo = (hasDetailedData || hasContexto) ? 'detalhado' : 'simples';

      const rawPacotes = (orc as any).pacotes;
      const rawSecoes = (orc as any).secoes;

      setForm({
        prospect_nome: orc.prospect_nome,
        prospect_cnpj: orc.prospect_cnpj || '',
        prospect_email: orc.prospect_email || '',
        prospect_telefone: orc.prospect_telefone || '',
        prospect_contato: orc.prospect_contato || '',
        cliente_id: orc.cliente_id || null,
        modo,
        contexto: (orc as any).contexto || '',
        ordem_execucao: (orc as any).ordem_execucao || '',
        itens: itens.length ? itens : [createItem()],
        pacotes: Array.isArray(rawPacotes) ? rawPacotes : [],
        secoes: Array.isArray(rawSecoes) && rawSecoes.length > 0 ? rawSecoes : [...DEFAULT_SECOES],
        desconto_pct: orc.desconto_pct,
        validade_dias: orc.validade_dias,
        prazo_execucao: orc.prazo_execucao || '',
        pagamento: orc.pagamento || '',
        observacoes: orc.observacoes || '',
      });
    })();
  }, [editId]);

  const isDetalhado = form.modo === 'detalhado';

  const subtotal = useMemo(() =>
    form.itens.reduce((s, i) => s + getItemValor(i) * i.quantidade, 0),
    [form.itens]
  );
  const descontoValor = subtotal * (form.desconto_pct / 100);
  const totalFinal = subtotal - descontoValor;

  function addItem() {
    setForm(f => ({
      ...f,
      itens: [...f.itens, createItem({ ordem: f.itens.length + 1 })],
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

  function handleAddSecao() {
    const nome = prompt('Nome da nova seção:');
    if (!nome) return;
    const key = nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
    setForm(f => ({
      ...f,
      secoes: [...f.secoes, { key, label: nome, descricao: '' }],
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
      contexto: isDetalhado ? (form.contexto || null) : null,
      ordem_execucao: isDetalhado ? (form.ordem_execucao || null) : null,
      pacotes: isDetalhado ? (form.pacotes as any) : ([] as any),
      secoes: isDetalhado ? (form.secoes as any) : ([] as any),
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
      await handleSave('enviado');

      const doc = await gerarOrcamentoPDF({
        modo: form.modo,
        modoContador,
        prospect_nome: form.prospect_nome,
        prospect_cnpj: form.prospect_cnpj,
        itens: itensValidos,
        pacotes: form.pacotes,
        secoes: form.secoes,
        contexto: form.contexto,
        ordem_execucao: form.ordem_execucao,
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
      const clienteName = (form.prospect_nome || 'proposta').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
      doc.save(`Proposta_${clienteName}_${new Date().toISOString().split('T')[0]}.pdf`);
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

  // Simple mode preview
  const previewSimples = (
    <div className="bg-gradient-to-br from-[hsl(120,60%,8%)] to-[hsl(120,40%,12%)] p-5 text-white rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg font-extrabold">
          <span className="text-primary">Trevo</span>{' '}
          <span className="opacity-60">Legaliza</span>
        </span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[3px] text-primary/80 mb-1">Proposta Comercial</p>
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
              <span className="font-bold whitespace-nowrap">{fmt(getItemValor(item) * item.quantidade)}</span>
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
        <span className="text-xl font-extrabold">{fmt(totalFinal)}</span>
      </div>
      <p className="mt-3 text-[10px] opacity-30">
        Válida por {form.validade_dias} dias
        {form.pagamento ? ` · ${form.pagamento.substring(0, 50)}${form.pagamento.length > 50 ? '...' : ''}` : ''}
      </p>
    </div>
  );

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
          {/* Cliente + Contexto */}
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

              {/* Modo toggle */}
              <div className="pt-3 border-t">
                <Label className="text-xs mb-2 block">Modo do orçamento</Label>
                <RadioGroup
                  value={form.modo}
                  onValueChange={(v: OrcamentoModo) => setForm(f => ({ ...f, modo: v }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="simples" id="modo-simples" />
                    <Label htmlFor="modo-simples" className="text-sm cursor-pointer">Simples</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="detalhado" id="modo-detalhado" />
                    <Label htmlFor="modo-detalhado" className="text-sm cursor-pointer">Detalhado</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Contexto fields (detailed only) */}
              {isDetalhado && (
                <div className="space-y-3 pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={modoContador} onCheckedChange={setModoContador} />
                    <span className="text-sm text-muted-foreground">Gerar proposta para cliente do contador (com markup)</span>
                  </div>
                  <div>
                    <Label className="text-xs">Contexto / Introdução</Label>
                    <Textarea
                      value={form.contexto}
                      onChange={e => setForm(f => ({ ...f, contexto: e.target.value }))}
                      placeholder="Descreva o cenário do cliente, riscos, urgência..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ordem de Execução Sugerida</Label>
                    <Textarea
                      value={form.ordem_execucao}
                      onChange={e => setForm(f => ({ ...f, ordem_execucao: e.target.value }))}
                      placeholder="1. Bombeiros → 2. Vigilância → 3. Prefeitura..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
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
                isDetalhado ? (
                  <ItemCardDetalhado
                    key={item.id}
                    item={item}
                    idx={idx}
                    secoes={form.secoes}
                    modoContador={modoContador}
                    onChange={updateItem}
                    onRemove={removeItem}
                    onAddSecao={handleAddSecao}
                  />
                ) : (
                  <ItemCardSimples
                    key={item.id}
                    item={item}
                    idx={idx}
                    onChange={updateItem}
                    onRemove={removeItem}
                  />
                )
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

          {/* Pacotes (detailed only) */}
          {isDetalhado && (
            <PacotesEditor
              pacotes={form.pacotes}
              itens={form.itens}
              onChange={pacotes => setForm(f => ({ ...f, pacotes }))}
            />
          )}

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
            <Card className="overflow-hidden">
              {isDetalhado ? (
                <PreviewDetalhado
                  prospect_nome={form.prospect_nome}
                  prospect_cnpj={form.prospect_cnpj}
                  itens={form.itens}
                  pacotes={form.pacotes}
                  secoes={form.secoes}
                  modoContador={modoContador}
                  desconto_pct={form.desconto_pct}
                  validade_dias={form.validade_dias}
                  pagamento={form.pagamento}
                />
              ) : previewSimples}
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
