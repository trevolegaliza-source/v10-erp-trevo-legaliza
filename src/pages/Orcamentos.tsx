import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrcamentos, useOrcamentoKPIs, useSaveOrcamento, useDeleteOrcamento, useConverterOrcamento, type Orcamento } from '@/hooks/useOrcamentos';
import { gerarOrcamentoPDF } from '@/lib/orcamento-pdf';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Plus, FileText, Send, CheckCircle, TrendingUp, MoreHorizontal,
  Copy, Download, Trash2, UserPlus, Pencil, Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  rascunho: { label: 'Rascunho', color: 'bg-muted text-muted-foreground' },
  enviado: { label: 'Enviado', color: 'bg-blue-500/10 text-blue-500' },
  aprovado: { label: 'Aprovado', color: 'bg-primary/10 text-primary' },
  recusado: { label: 'Recusado', color: 'bg-destructive/10 text-destructive' },
  expirado: { label: 'Expirado', color: 'bg-amber-500/10 text-amber-500' },
  convertido: { label: 'Convertido', color: 'bg-primary/10 text-primary' },
};

const SERVICOS_OPTIONS = ['Abertura', 'Alteração', 'Baixa', 'Transformação', 'Cisão', 'Fusão', 'Incorporação', 'Marcas e Patentes'];
const NATUREZAS_OPTIONS = ['LTDA', 'SLU', 'MEI', 'EI', 'S.A', 'Fundação', 'OSC', 'Consórcio'];
const ESCOPO_OPTIONS = ['Plataforma Trevo', 'Minuta Padrão Junta', 'Minuta Redação Própria', 'Registro', 'Acompanhamento Deferimento', 'MAT', 'Inscrição Municipal/Estadual', 'Alvarás e Licenças', 'Conselho de Classe'];
const CLAUSULAS = [
  { key: 'mat', label: 'MAT', text: 'Inclui emissão de MAT (Módulo de Atualização Tributária).' },
  { key: 'troca_uf', label: 'Troca UF', text: 'Processos em UFs diferentes podem ter valores adicionais de taxas.' },
  { key: 'doc_completa', label: 'Doc Completa', text: 'O prazo só inicia após recebimento completo da documentação.' },
  { key: 'alvaras', label: 'Alvarás +R$600', text: 'Alvarás e licenças especiais possuem custo adicional a partir de R$ 600.' },
  { key: 'taxas_fora', label: 'Taxas Fora', text: 'Taxas governamentais não estão inclusas nos valores apresentados.' },
  { key: 'fast_track', label: 'Fast Track', text: 'Serviço de urgência disponível com acréscimo de 50% sobre o valor.' },
  { key: 'retrabalho', label: 'Retrabalho', text: 'Retrabalho decorrente de informações incorretas será cobrado separadamente.' },
  { key: 'inadimplencia', label: 'Inadimplência', text: 'Em caso de inadimplência, os serviços serão suspensos até a regularização.' },
  { key: 'lgpd', label: 'LGPD', text: 'Os dados fornecidos serão tratados conforme a LGPD.' },
];

const emptyForm = (): Partial<Orcamento> => ({
  prospect_nome: '',
  prospect_cnpj: '',
  prospect_email: '',
  prospect_telefone: '',
  prospect_contato: '',
  tipo_contrato: 'avulso',
  servicos: [] as any,
  naturezas: [] as any,
  escopo: [...ESCOPO_OPTIONS.slice(0, 6)] as any,
  valor_base: 880,
  qtd_processos: 1,
  desconto_pct: 0,
  valor_final: 880,
  desconto_progressivo_ativo: false,
  desconto_progressivo_pct: 5,
  desconto_progressivo_limite: 600,
  validade_dias: 15,
  pagamento: '',
  sla: 'Prazo para início: até 5 dias úteis após recebimento COMPLETO da documentação. SLA de atendimento: 48 horas úteis.',
  observacoes: '',
  status: 'rascunho',
});

export default function Orcamentos() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('todos');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Partial<Orcamento>>(emptyForm());

  const { data: orcamentos, isLoading } = useOrcamentos(tab);
  const { data: kpis } = useOrcamentoKPIs();
  const saveMutation = useSaveOrcamento();
  const deleteMutation = useDeleteOrcamento();
  const convertMutation = useConverterOrcamento();

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

  // Recalculate valor_final
  useEffect(() => {
    const base = Number(form.valor_base) || 0;
    const desc = Number(form.desconto_pct) || 0;
    const qtd = form.tipo_contrato === 'mensal' ? (Number(form.qtd_processos) || 1) : 1;
    const final_ = base * qtd * (1 - desc / 100);
    setForm(f => ({ ...f, valor_final: Math.round(final_ * 100) / 100 }));
  }, [form.valor_base, form.desconto_pct, form.qtd_processos, form.tipo_contrato]);

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
    setStep(0);
    setShowForm(true);
  }

  function openEdit(orc: Orcamento) {
    setForm({ ...orc });
    setEditingId(orc.id);
    setStep(0);
    setShowForm(true);
  }

  function toggleArray(arr: string[], item: string): string[] {
    return arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];
  }

  async function handleSave(status?: string) {
    if (!form.prospect_nome?.trim()) {
      toast.error('Informe a razão social do prospect');
      return;
    }
    try {
      const payload = { ...form, status: status || form.status || 'rascunho' };
      if (editingId) (payload as any).id = editingId;
      const id = await saveMutation.mutateAsync(payload as any);
      toast.success(status === 'enviado' ? 'Orçamento salvo e pronto para envio!' : 'Rascunho salvo!');
      setShowForm(false);

      if (status === 'enviado') {
        // Generate PDF
        const fullOrc = { ...form, id, numero: (form as any).numero || 0, status: 'enviado' } as Orcamento;
        try {
          const doc = await gerarOrcamentoPDF({
            ...fullOrc,
            servicos: (fullOrc.servicos || []) as string[],
            naturezas: (fullOrc.naturezas || []) as string[],
            escopo: (fullOrc.escopo || []) as string[],
            data_emissao: new Date().toLocaleDateString('pt-BR'),
          });
          doc.save(`orcamento_${(form.prospect_nome || '').replace(/\s/g, '_')}.pdf`);
        } catch { /* PDF optional */ }
      }
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + (err.message || ''));
    }
  }

  async function handleDownloadPDF(orc: Orcamento) {
    try {
      const doc = await gerarOrcamentoPDF({
        ...orc,
        servicos: (orc.servicos || []) as string[],
        naturezas: (orc.naturezas || []) as string[],
        escopo: (orc.escopo || []) as string[],
        data_emissao: new Date(orc.created_at).toLocaleDateString('pt-BR'),
      });
      doc.save(`orcamento_${String(orc.numero).padStart(3, '0')}_${orc.prospect_nome.replace(/\s/g, '_')}.pdf`);
      toast.success('PDF gerado!');
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    }
  }

  function handleDuplicate(orc: Orcamento) {
    setForm({ ...orc, status: 'rascunho', prospect_nome: orc.prospect_nome + ' (cópia)' });
    setEditingId(null);
    setStep(0);
    setShowForm(true);
  }

  function handleCopyLink(orc: Orcamento) {
    const url = `${window.location.origin}/orcamento/${orc.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  }

  async function handleConvert(orc: Orcamento) {
    try {
      const clienteId = await convertMutation.mutateAsync(orc);
      navigate(`/clientes/${clienteId}`);
    } catch (err: any) {
      toast.error('Erro na conversão: ' + (err.message || ''));
    }
  }

  const steps = ['Prospect', 'Contrato', 'Escopo', 'Financeiro', 'Condições', 'Revisão'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-sm text-muted-foreground">Propostas comerciais e conversão de prospects</p>
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
                return (
                  <Card key={orc.id} className="p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-muted-foreground">#{String(orc.numero).padStart(3, '0')}</span>
                        <div>
                          <p className="text-sm font-semibold">{orc.prospect_nome}</p>
                          <p className="text-xs text-muted-foreground">{orc.tipo_contrato === 'mensal' ? 'Mensal' : 'Avulso'} · {new Date(orc.created_at).toLocaleDateString('pt-BR')}</p>
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
                            {orc.status !== 'convertido' && (
                              <DropdownMenuItem onClick={() => handleConvert(orc)}><UserPlus className="h-3.5 w-3.5 mr-2" />Converter em Cliente</DropdownMenuItem>
                            )}
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex gap-1 mb-4">
            {steps.map((s, i) => (
              <button key={s} onClick={() => setStep(i)} className={`flex-1 text-[10px] py-1.5 rounded-md transition-colors ${i === step ? 'bg-primary text-primary-foreground font-bold' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                {s}
              </button>
            ))}
          </div>

          {/* Step 0: Prospect */}
          {step === 0 && (
            <div className="space-y-3">
              <div><Label>Razão Social *</Label><Input value={form.prospect_nome || ''} onChange={e => setForm(f => ({ ...f, prospect_nome: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>CNPJ</Label><Input value={form.prospect_cnpj || ''} onChange={e => setForm(f => ({ ...f, prospect_cnpj: e.target.value }))} /></div>
                <div><Label>Contato</Label><Input value={form.prospect_contato || ''} onChange={e => setForm(f => ({ ...f, prospect_contato: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Email</Label><Input type="email" value={form.prospect_email || ''} onChange={e => setForm(f => ({ ...f, prospect_email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.prospect_telefone || ''} onChange={e => setForm(f => ({ ...f, prospect_telefone: e.target.value }))} /></div>
              </div>
            </div>
          )}

          {/* Step 1: Contrato */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Tipo de Contrato:</Label>
                <div className="flex gap-2">
                  {['avulso', 'mensal'].map(t => (
                    <Button key={t} variant={form.tipo_contrato === t ? 'default' : 'outline'} size="sm" onClick={() => setForm(f => ({ ...f, tipo_contrato: t }))}>
                      {t === 'avulso' ? 'Avulso' : 'Mensal'}
                    </Button>
                  ))}
                </div>
              </div>
              {form.tipo_contrato === 'avulso' && (
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Desconto Progressivo</Label>
                    <Switch checked={form.desconto_progressivo_ativo || false} onCheckedChange={v => setForm(f => ({ ...f, desconto_progressivo_ativo: v }))} />
                  </div>
                  {form.desconto_progressivo_ativo && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">% por processo</Label><Input type="number" value={form.desconto_progressivo_pct || 5} onChange={e => setForm(f => ({ ...f, desconto_progressivo_pct: Number(e.target.value) }))} /></div>
                      <div><Label className="text-xs">Limite mínimo (R$)</Label><Input type="number" value={form.desconto_progressivo_limite || 600} onChange={e => setForm(f => ({ ...f, desconto_progressivo_limite: Number(e.target.value) }))} /></div>
                    </div>
                  )}
                </div>
              )}
              {form.tipo_contrato === 'mensal' && (
                <div><Label>Qtd Processos/mês</Label><Input type="number" value={form.qtd_processos || 1} onChange={e => setForm(f => ({ ...f, qtd_processos: Number(e.target.value) }))} /></div>
              )}
            </div>
          )}

          {/* Step 2: Escopo */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Serviços Societários</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {SERVICOS_OPTIONS.map(s => (
                    <Badge key={s} variant="outline" className={`cursor-pointer transition-colors ${((form.servicos as string[]) || []).includes(s) ? 'bg-primary/10 text-primary border-primary/30' : 'hover:bg-muted'}`} onClick={() => setForm(f => ({ ...f, servicos: toggleArray((f.servicos as string[]) || [], s) as any }))}>
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Natureza Jurídica</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {NATUREZAS_OPTIONS.map(n => (
                    <Badge key={n} variant="outline" className={`cursor-pointer transition-colors ${((form.naturezas as string[]) || []).includes(n) ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'hover:bg-muted'}`} onClick={() => setForm(f => ({ ...f, naturezas: toggleArray((f.naturezas as string[]) || [], n) as any }))}>
                      {n}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Escopo Técnico</Label>
                <div className="space-y-1.5 mt-2">
                  {ESCOPO_OPTIONS.map(e => (
                    <label key={e} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 px-2 py-1 rounded">
                      <input type="checkbox" checked={((form.escopo as string[]) || []).includes(e)} onChange={() => setForm(f => ({ ...f, escopo: toggleArray((f.escopo as string[]) || [], e) as any }))} className="rounded" />
                      {e}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Financeiro */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Valor Base (R$)</Label><Input type="number" value={form.valor_base || 880} onChange={e => setForm(f => ({ ...f, valor_base: Number(e.target.value) }))} /></div>
                <div><Label>Desconto (%)</Label><Input type="number" value={form.desconto_pct || 0} onChange={e => setForm(f => ({ ...f, desconto_pct: Number(e.target.value) }))} /></div>
                <div><Label>Validade (dias)</Label><Input type="number" value={form.validade_dias || 15} onChange={e => setForm(f => ({ ...f, validade_dias: Number(e.target.value) }))} /></div>
              </div>
              <Card className="p-4 bg-primary/5 border-primary/20 text-center">
                <p className="text-xs text-muted-foreground uppercase">Valor Final</p>
                <p className="text-3xl font-bold text-primary">{fmt(form.valor_final || 0)}</p>
                {form.tipo_contrato === 'mensal' && <p className="text-xs text-muted-foreground">{form.qtd_processos} processo(s)/mês</p>}
              </Card>
              {form.desconto_progressivo_ativo && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Simulação Desconto Progressivo</Label>
                  <div className="border rounded-lg mt-2 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted"><th className="text-left p-2 text-xs">Processo</th><th className="text-left p-2 text-xs">Valor</th><th className="text-left p-2 text-xs">Desconto</th></tr></thead>
                      <tbody>
                        {Array.from({ length: 5 }, (_, i) => {
                          let val = Number(form.valor_base) || 880;
                          for (let j = 1; j <= i; j++) val = Math.max(val * (1 - (form.desconto_progressivo_pct || 5) / 100), form.desconto_progressivo_limite || 600);
                          return (
                            <tr key={i} className="border-t border-border/50">
                              <td className="p-2">{i + 1}º processo</td>
                              <td className="p-2 font-medium">{fmt(val)}</td>
                              <td className="p-2 text-muted-foreground">{i > 0 ? `-${form.desconto_progressivo_pct}%` : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Condições */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cláusulas Rápidas</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {CLAUSULAS.map(c => (
                    <Badge key={c.key} variant="outline" className="cursor-pointer hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => setForm(f => ({ ...f, observacoes: ((f.observacoes || '') + '\n' + c.text).trim() }))}>
                      + {c.label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div><Label>Condições de Pagamento</Label><Textarea value={form.pagamento || ''} onChange={e => setForm(f => ({ ...f, pagamento: e.target.value }))} rows={2} /></div>
              <div><Label>SLA</Label><Textarea value={form.sla || ''} onChange={e => setForm(f => ({ ...f, sla: e.target.value }))} rows={2} /></div>
              <div><Label>Observações</Label><Textarea value={form.observacoes || ''} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={4} /></div>
            </div>
          )}

          {/* Step 5: Revisão */}
          {step === 5 && (
            <div className="space-y-3 text-sm">
              <Card className="p-4 space-y-2">
                <p className="font-semibold text-base">{form.prospect_nome}</p>
                <p className="text-muted-foreground">{form.prospect_cnpj} · {form.prospect_email}</p>
                <p className="text-muted-foreground">{form.tipo_contrato === 'mensal' ? 'Contrato Mensal' : 'Serviço Avulso'}</p>
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Serviços</p>
                  <div className="flex flex-wrap gap-1 mt-1">{((form.servicos as string[]) || []).map(s => <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>)}</div>
                </Card>
                <Card className="p-3">
                  <p className="text-xs text-muted-foreground">Naturezas</p>
                  <div className="flex flex-wrap gap-1 mt-1">{((form.naturezas as string[]) || []).map(n => <Badge key={n} variant="outline" className="text-[10px]">{n}</Badge>)}</div>
                </Card>
              </div>
              <Card className="p-4 bg-primary/5 border-primary/20 text-center">
                <p className="text-3xl font-bold text-primary">{fmt(form.valor_final || 0)}</p>
                <p className="text-xs text-muted-foreground">Validade: {form.validade_dias} dias</p>
              </Card>
            </div>
          )}

          <DialogFooter className="flex justify-between gap-2 mt-4">
            <div className="flex gap-2">
              {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>}
            </div>
            <div className="flex gap-2">
              {step < 5 ? (
                <Button onClick={() => setStep(s => s + 1)}>Próximo</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => handleSave('rascunho')}>Salvar Rascunho</Button>
                  <Button onClick={() => handleSave('enviado')}>Gerar e Enviar</Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
