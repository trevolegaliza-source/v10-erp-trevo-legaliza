import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { UserPlus, FileText, Upload, X, Check, ChevronsUpDown } from 'lucide-react';
import { useClientes, useCreateCliente, useCreateProcesso } from '@/hooks/useFinanceiro';
import type { TipoCliente, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { STORAGE_BUCKETS } from '@/constants/storage';
import { maskCNPJ, isValidCNPJ, maskCodigo } from '@/lib/cnpj';
import { TIPO_PROCESSO_LABELS } from '@/types/financial';
import { useServiceNegotiations, useUpsertServiceNegotiations } from '@/hooks/useServiceNegotiations';
import HonorariosInlineRepeater, { type InlineNegotiationRow } from '@/components/clientes/HonorariosInlineRepeater';

const INITIAL_CLIENTE = {
  codigo_identificador: '',
  nome: '',
  cnpj: '',
  tipo: 'AVULSO_4D' as TipoCliente,
  email: '',
  telefone: '',
  nome_contador: '',
  apelido: '',
  dia_vencimento_mensal: 15,
  momento_faturamento: 'na_solicitacao' as 'na_solicitacao' | 'no_deferimento',
  observacoes: '',
  valor_base: '',
  desconto_tier2: '',
  dia_cobranca: '4',
  valor_limite_desconto: '',
  valor_mensalidade: '',
  qtd_processos_inclusos: '',
};

export default function CadastroRapido() {
  const [clienteForm, setClienteForm] = useState(INITIAL_CLIENTE);
  const [contratoFile, setContratoFile] = useState<File | null>(null);
  const createCliente = useCreateCliente();
  const upsertNegotiations = useUpsertServiceNegotiations();
  const [honorariosRows, setHonorariosRows] = useState<InlineNegotiationRow[]>([]);

  const [processoForm, setProcessoForm] = useState({
    cliente_id: '',
    razao_social: '',
    tipo: 'abertura' as string,
    prioridade: 'normal',
    responsavel: '',
    valor_manual: '',
    definir_manual: false,
    descricao_avulso: '',
    ja_pago: false,
    observacoes: '',
  });
  const createProcesso = useCreateProcesso();
  const { data: clientes } = useClientes();
  const [clienteComboOpen, setClienteComboOpen] = useState(false);
  const { data: negotiations } = useServiceNegotiations(processoForm.cliente_id || undefined);

  const selectedCliente = (clientes || []).find(c => c.id === processoForm.cliente_id);

  const isAvulso = clienteForm.tipo === 'AVULSO_4D';
  const isMensalista = clienteForm.tipo === 'MENSALISTA';

  // Auto-fill codigo from CNPJ (first 6 digits)
  const handleCnpjChange = (value: string) => {
    const masked = maskCNPJ(value);
    const digits = value.replace(/\D/g, '');
    const codigo = digits.slice(0, 6);
    setClienteForm(f => ({
      ...f,
      cnpj: masked,
      codigo_identificador: codigo ? maskCodigo(codigo) : f.codigo_identificador,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande (máx. 10MB)');
        return;
      }
      setContratoFile(file);
    }
  };

  const uploadContrato = useCallback(async (clienteId: string) => {
    if (!contratoFile) return;
    const ext = contratoFile.name.split('.').pop();
    const path = `${clienteId}/contrato_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(STORAGE_BUCKETS.CONTRACTS)
      .upload(path, contratoFile, { upsert: true });

    if (error) {
      toast.error('Erro ao enviar contrato: ' + error.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('clientes')
      .update({ contrato_url: path, updated_at: new Date().toISOString() } as any)
      .eq('id', clienteId);

    if (updateError) {
      toast.error('Contrato enviado, mas não foi possível salvar o vínculo: ' + updateError.message);
      return;
    }

    toast.success('Contrato anexado com sucesso!');
  }, [contratoFile]);

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate CNPJ if provided
    const cnpjDigits = clienteForm.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && !isValidCNPJ(clienteForm.cnpj)) {
      toast.error('Erro ao validar CNPJ: deve conter 14 dígitos.');
      return;
    }

    const payload: Record<string, any> = {
      codigo_identificador: clienteForm.codigo_identificador.replace(/\D/g, ''),
      nome: clienteForm.nome,
      cnpj: cnpjDigits || null,
      tipo: clienteForm.tipo,
      email: clienteForm.email || null,
      telefone: clienteForm.telefone || null,
      nome_contador: clienteForm.nome_contador || '',
      apelido: clienteForm.apelido || '',
      momento_faturamento: clienteForm.momento_faturamento,
      observacoes: clienteForm.observacoes || null,
    };

    if (isAvulso) {
      payload.valor_base = clienteForm.valor_base ? Number(clienteForm.valor_base) : null;
      payload.desconto_progressivo = clienteForm.desconto_tier2 ? Number(clienteForm.desconto_tier2) : null;
      payload.dia_cobranca = clienteForm.dia_cobranca ? Number(clienteForm.dia_cobranca) : null;
      payload.valor_limite_desconto = clienteForm.valor_limite_desconto ? Number(clienteForm.valor_limite_desconto) : null;
      payload.dia_vencimento_mensal = 0;
    } else {
      payload.mensalidade = clienteForm.valor_mensalidade ? Number(clienteForm.valor_mensalidade) : null;
      payload.vencimento = clienteForm.dia_vencimento_mensal;
      payload.dia_vencimento_mensal = clienteForm.dia_vencimento_mensal;
      payload.qtd_processos = clienteForm.qtd_processos_inclusos ? Number(clienteForm.qtd_processos_inclusos) : null;
    }

    createCliente.mutate(
      payload as any,
      {
        onSuccess: async (data: any) => {
          const clienteId = data?.id || data?.[0]?.id;
          if (contratoFile && clienteId) {
            uploadContrato(clienteId);
          }
          // Save honorários if any
          if (clienteId && honorariosRows.length > 0) {
            const validRows = honorariosRows.filter(r => r.service_name.trim() && r.fixed_price);
            if (validRows.length > 0) {
              await upsertNegotiations.mutateAsync({
                clienteId,
                negotiations: validRows.map(r => ({
                  service_name: r.service_name.trim(),
                  fixed_price: Number(r.fixed_price),
                  billing_trigger: r.billing_trigger,
                  trigger_days: Number(r.trigger_days) || 0,
                  is_custom: true as const,
                })),
              });
            }
          }
          setClienteForm(INITIAL_CLIENTE);
          setContratoFile(null);
          setHonorariosRows([]);
        },
      },
    );
  };

  const isProcessoAvulso = processoForm.tipo === 'avulso';

  const handleCreateProcesso = (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessoAvulso && !processoForm.descricao_avulso.trim()) {
      toast.error('Preencha a Descrição do Serviço Avulso.');
      return;
    }
    // Check if negotiated service selected
    const neg = negotiations?.find(n => n.id === processoForm.tipo);
    const tipoFinal = neg ? 'avulso' : processoForm.tipo;
    const valorFinal = neg
      ? neg.fixed_price
      : isProcessoAvulso
        ? (processoForm.valor_manual ? Number(processoForm.valor_manual) : undefined)
        : (processoForm.definir_manual && processoForm.valor_manual ? Number(processoForm.valor_manual) : undefined);

    // Build notas: for avulso, prefix with description marker
    let notas = processoForm.observacoes || null;
    if (isProcessoAvulso && processoForm.descricao_avulso.trim()) {
      notas = `[AVULSO:${processoForm.descricao_avulso.trim()}]${notas ? '\n' + notas : ''}`;
    }
    if (neg) {
      notas = `Valor fixo conforme negociação contratual para o serviço: ${neg.service_name}. Gatilho: ${neg.billing_trigger}.${notas ? '\n' + notas : ''}`;
    }

    createProcesso.mutate(
      {
        cliente_id: processoForm.cliente_id,
        razao_social: processoForm.razao_social,
        tipo: tipoFinal as TipoProcesso,
        prioridade: processoForm.prioridade,
        responsavel: processoForm.responsavel,
        valor_manual: valorFinal,
        notas,
        ja_pago: processoForm.ja_pago,
        descricao_avulso: isProcessoAvulso ? processoForm.descricao_avulso.trim() : undefined,
      },
      {
        onSuccess: () =>
          setProcessoForm({ cliente_id: '', razao_social: '', tipo: 'abertura', prioridade: 'normal', responsavel: '', valor_manual: '', definir_manual: false, descricao_avulso: '', ja_pago: false, observacoes: '' }),
      },
    );
  };

  const update = (field: string, value: any) => setClienteForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cadastro Rápido</h1>
        <p className="text-sm text-muted-foreground">Registre clientes e processos manualmente</p>
      </div>

      <Tabs defaultValue="cliente" className="w-full">
        <TabsList>
          <TabsTrigger value="cliente" className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Novo Cliente
          </TabsTrigger>
          <TabsTrigger value="processo" className="gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Novo Processo
          </TabsTrigger>
        </TabsList>

        {/* ── CLIENTE TAB ── */}
        <TabsContent value="cliente">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cadastro de Contabilidade</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCliente} className="grid gap-5 max-w-xl">
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>CNPJ *</Label>
                    <Input
                      required
                      placeholder="00.000.000/0000-00"
                      value={clienteForm.cnpj}
                      onChange={(e) => handleCnpjChange(e.target.value)}
                      maxLength={18}
                    />
                    {clienteForm.cnpj && clienteForm.cnpj.replace(/\D/g, '').length > 0 && !isValidCNPJ(clienteForm.cnpj) && (
                      <p className="text-[10px] text-destructive">CNPJ deve conter 14 dígitos</p>
                    )}
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Código do Cliente</Label>
                    <Input
                      placeholder="000.000 (auto)"
                      value={clienteForm.codigo_identificador}
                      onChange={(e) => update('codigo_identificador', maskCodigo(e.target.value))}
                      maxLength={7}
                    />
                    <p className="text-[10px] text-muted-foreground">Preenchido automaticamente a partir do CNPJ</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Nome da Contabilidade *</Label>
                    <Input required placeholder="Nome da contabilidade" value={clienteForm.nome} onChange={(e) => update('nome', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Apelido</Label>
                    <Input placeholder="Apelido da contabilidade" value={clienteForm.apelido} onChange={(e) => update('apelido', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Nome do Contador</Label>
                    <Input placeholder="Contador responsável" value={clienteForm.nome_contador} onChange={(e) => update('nome_contador', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 99999-0000" value={clienteForm.telefone} onChange={(e) => update('telefone', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@contabilidade.com" value={clienteForm.email} onChange={(e) => update('email', e.target.value)} />
                </div>

                <div className="grid gap-1.5">
                  <Label>Tipo de Cliente *</Label>
                  <Select value={clienteForm.tipo} onValueChange={(v) => update('tipo', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                      <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-1.5">
                  <Label>Momento do Faturamento *</Label>
                  <Select value={clienteForm.momento_faturamento} onValueChange={(v) => update('momento_faturamento', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="na_solicitacao">Na Solicitação</SelectItem>
                      <SelectItem value="no_deferimento">No Deferimento (Sucesso)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    {clienteForm.momento_faturamento === 'no_deferimento'
                      ? 'A cobrança será gerada somente quando o processo for deferido.'
                      : 'A cobrança será gerada no momento da criação do processo.'}
                  </p>
                </div>

                {isAvulso && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
                    <p className="text-xs font-medium text-warning">Configuração Avulso</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <Label>Valor Base (R$)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0,00" value={clienteForm.valor_base} onChange={(e) => update('valor_base', e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Desconto Progressivo (%)</Label>
                        <Input type="number" step="0.1" min="0" max="100" placeholder="0" value={clienteForm.desconto_tier2} onChange={(e) => update('desconto_tier2', e.target.value)} />
                      </div>
                    </div>
                    <div className={cn("grid gap-4", clienteForm.momento_faturamento === 'no_deferimento' ? 'grid-cols-1' : 'grid-cols-2')}>
                      {clienteForm.momento_faturamento !== 'no_deferimento' && (
                        <div className="grid gap-1.5">
                          <Label>Dia de Cobrança (dias após solicitação)</Label>
                          <Input type="number" min={1} max={30} placeholder="4" value={clienteForm.dia_cobranca} onChange={(e) => update('dia_cobranca', e.target.value)} />
                        </div>
                      )}
                      <div className="grid gap-1.5">
                        <Label>Valor Limite de Desconto (R$) *</Label>
                        <Input type="number" step="0.01" min="0" placeholder="Piso mínimo do valor" value={clienteForm.valor_limite_desconto} onChange={(e) => update('valor_limite_desconto', e.target.value)} />
                        <p className="text-[10px] text-muted-foreground">O valor final nunca será inferior a este limite, mesmo com desconto progressivo.</p>
                      </div>
                    </div>
                  </div>
                )}

                {isMensalista && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                    <p className="text-xs font-medium text-primary">Configuração Mensalista</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-1.5">
                        <Label>Valor Mensalidade (R$)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0,00" value={clienteForm.valor_mensalidade} onChange={(e) => update('valor_mensalidade', e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Dia de Vencimento</Label>
                        <Input type="number" min={1} max={28} value={clienteForm.dia_vencimento_mensal} onChange={(e) => update('dia_vencimento_mensal', Number(e.target.value))} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Qtd Processos Inclusos</Label>
                        <Input type="number" min={0} placeholder="Ex: 5" value={clienteForm.qtd_processos_inclusos} onChange={(e) => update('qtd_processos_inclusos', e.target.value)} />
                        <p className="text-[10px] text-muted-foreground">Processos inclusos no contrato mensal.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Observações */}
                <div className="grid gap-1.5">
                  <Label>Observações Adicionais</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                    placeholder="Observações sobre o cliente, condições especiais, etc."
                    value={clienteForm.observacoes}
                    onChange={(e) => update('observacoes', e.target.value)}
                  />
                </div>

                {/* Honorários Específicos */}
                <HonorariosInlineRepeater rows={honorariosRows} onChange={setHonorariosRows} />

                {/* Document Upload */}
                <div className="grid gap-1.5">
                  <Label>Anexar Contrato Assinado</Label>
                  {contratoFile ? (
                    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1">{contratoFile.name}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setContratoFile(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-4 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                      <Upload className="h-4 w-4" />
                      Clique para selecionar (PDF, PNG, JPG — máx. 10MB)
                      <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
                    </label>
                  )}
                </div>

                <Button type="submit" disabled={createCliente.isPending} className="mt-1 w-fit">
                  {createCliente.isPending ? 'Criando...' : 'Cadastrar Cliente'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PROCESSO TAB ── */}
        <TabsContent value="processo">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Novo Processo</CardTitle>
              <p className="text-xs text-muted-foreground">Valor calculado automaticamente pela metodologia do cliente. Use o toggle para definir valor manual.</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProcesso} className="grid gap-4 max-w-lg">
                {/* Searchable Client Combobox */}
                <div className="grid gap-2">
                  <Label>Contabilidade / Cliente *</Label>
                  <Popover open={clienteComboOpen} onOpenChange={setClienteComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={clienteComboOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedCliente
                          ? `${selectedCliente.apelido || selectedCliente.nome} (${selectedCliente.codigo_identificador})`
                          : 'Buscar por nome, código ou apelido...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar cliente..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {(clientes || []).filter(c => !(c as any).is_archived).map(c => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome} ${c.apelido || ''} ${c.codigo_identificador}`}
                                onSelect={() => {
                                  setProcessoForm(f => ({ ...f, cliente_id: c.id }));
                                  setClienteComboOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", processoForm.cliente_id === c.id ? "opacity-100" : "opacity-0")} />
                                <div>
                                  <p className="text-sm font-medium">{c.apelido || c.nome}</p>
                                  <p className="text-xs text-muted-foreground">{c.codigo_identificador} · {c.tipo === 'MENSALISTA' ? 'Mensalista' : 'Avulso'}</p>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label>Razão Social *</Label>
                  <Input required placeholder="Nome da empresa" value={processoForm.razao_social} onChange={(e) => setProcessoForm(f => ({ ...f, razao_social: e.target.value }))} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Serviço</Label>
                    <Select
                      value={processoForm.tipo}
                      onValueChange={v => {
                        const neg = negotiations?.find(n => n.id === v);
                        if (neg) {
                          setProcessoForm(f => ({
                            ...f,
                            tipo: v,
                            definir_manual: true,
                            valor_manual: String(neg.fixed_price),
                            descricao_avulso: '',
                          }));
                        } else {
                          setProcessoForm(f => ({ ...f, tipo: v as TipoProcesso, definir_manual: v === 'avulso', valor_manual: v === 'avulso' ? f.valor_manual : '', descricao_avulso: v === 'avulso' ? f.descricao_avulso : '' }));
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem disabled value="__header_std" className="text-[10px] font-semibold text-muted-foreground">— Serviços Padrão —</SelectItem>
                        {Object.entries(TIPO_PROCESSO_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                        {negotiations && negotiations.length > 0 && (
                          <>
                            <SelectItem disabled value="__header_neg" className="text-[10px] font-semibold text-muted-foreground">— Serviços Negociados —</SelectItem>
                            {negotiations.map(n => (
                              <SelectItem key={n.id} value={n.id}>
                                {n.service_name} — {Number(n.fixed_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <Select value={processoForm.prioridade} onValueChange={v => setProcessoForm(f => ({ ...f, prioridade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente (+50%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Conditional: Avulso description */}
                {isProcessoAvulso && (
                  <div className="grid gap-2">
                    <Label>Descrição do Serviço Avulso *</Label>
                    <Input
                      required
                      placeholder="Ex: Inscrição Municipal, Certidão Negativa..."
                      value={processoForm.descricao_avulso}
                      onChange={e => setProcessoForm(f => ({ ...f, descricao_avulso: e.target.value }))}
                    />
                    <p className="text-[10px] text-muted-foreground">Este nome será exibido no Kanban em vez de &quot;Avulso&quot;.</p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Responsável (opcional)</Label>
                  <Input value={processoForm.responsavel} onChange={(e) => setProcessoForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
                </div>

                {/* Manual value toggle — always enabled for avulso */}
                {!isProcessoAvulso && (
                  <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                    <div>
                      <Label className="text-sm font-medium">Definir Valor Manualmente</Label>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {processoForm.definir_manual ? 'Valor digitado abaixo será usado.' : 'Sistema calcula pela Metodologia de Cobrança.'}
                      </p>
                    </div>
                    <Switch
                      checked={processoForm.definir_manual}
                      onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, definir_manual: checked }))}
                    />
                  </div>
                )}
                {(processoForm.definir_manual || isProcessoAvulso) && (
                  <div className="grid gap-2">
                    <Label>{isProcessoAvulso ? 'Valor do Serviço (R$) *' : 'Valor Manual (R$)'}</Label>
                    <Input type="number" step="0.01" value={processoForm.valor_manual} onChange={e => setProcessoForm(f => ({ ...f, valor_manual: e.target.value }))} placeholder="0,00" />
                    {isProcessoAvulso && <p className="text-[10px] text-muted-foreground">O valor digitado é final — sem desconto progressivo.</p>}
                  </div>
                )}

                {/* Já pago switch */}
                <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/5 p-3">
                  <div>
                    <Label className="text-sm font-medium">Este serviço já foi pago/liquidado?</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {processoForm.ja_pago ? 'O processo entrará direto como Honorário Pago.' : 'Seguirá o fluxo normal de cobrança.'}
                    </p>
                  </div>
                  <Switch
                    checked={processoForm.ja_pago}
                    onCheckedChange={(checked) => setProcessoForm(f => ({ ...f, ja_pago: checked }))}
                  />
                </div>

                {/* Observações */}
                <div className="grid gap-2">
                  <Label>Observações</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
                    placeholder="Protocolo, detalhes da Receita Federal, etc."
                    value={processoForm.observacoes}
                    onChange={e => setProcessoForm(f => ({ ...f, observacoes: e.target.value }))}
                  />
                </div>

                {selectedCliente && (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      Cliente selecionado: <span className="font-medium text-foreground">{selectedCliente.nome}</span>
                      {' · '}
                      {selectedCliente.tipo === 'MENSALISTA' ? 'Mensalista' : 'Avulso'}
                      {selectedCliente.tipo !== 'MENSALISTA' && (selectedCliente as any).valor_base != null && (
                        <> · Base: {Number((selectedCliente as any).valor_base).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</>
                      )}
                    </p>
                  </div>
                )}

                <Button type="submit" disabled={createProcesso.isPending || !processoForm.cliente_id || !processoForm.razao_social} className="w-fit">
                  {createProcesso.isPending ? 'Criando...' : 'Criar Processo'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
