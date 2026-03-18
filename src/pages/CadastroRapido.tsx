import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

  const [processoForm, setProcessoForm] = useState({
    cliente_id: '',
    razao_social: '',
    tipo: 'abertura' as TipoProcesso,
    prioridade: 'normal',
    responsavel: '',
    valor_manual: '',
    definir_manual: false,
  });
  const createProcesso = useCreateProcesso();
  const { data: clientes } = useClientes();
  const [clienteComboOpen, setClienteComboOpen] = useState(false);

  const selectedCliente = (clientes || []).find(c => c.id === processoForm.cliente_id);

  const isAvulso = clienteForm.tipo === 'AVULSO_4D';
  const isMensalista = clienteForm.tipo === 'MENSALISTA';

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
      .from('contratos')
      .upload(path, contratoFile, { upsert: true });
    if (error) {
      toast.error('Erro ao enviar contrato: ' + error.message);
    } else {
      toast.success('Contrato anexado com sucesso!');
    }
  }, [contratoFile]);

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      codigo_identificador: clienteForm.codigo_identificador,
      nome: clienteForm.nome,
      cnpj: clienteForm.cnpj || null,
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
        onSuccess: (data: any) => {
          const clienteId = data?.id || data?.[0]?.id;
          if (contratoFile && clienteId) {
            uploadContrato(clienteId);
          }
          setClienteForm(INITIAL_CLIENTE);
          setContratoFile(null);
        },
      },
    );
  };

  const handleCreateProcesso = (e: React.FormEvent) => {
    e.preventDefault();
    createProcesso.mutate(
      {
        cliente_id: processoForm.cliente_id,
        razao_social: processoForm.razao_social,
        tipo: processoForm.tipo,
        prioridade: processoForm.prioridade,
        responsavel: processoForm.responsavel,
        valor_manual: processoForm.definir_manual && processoForm.valor_manual ? Number(processoForm.valor_manual) : undefined,
      },
      {
        onSuccess: () =>
          setProcessoForm({ cliente_id: '', razao_social: '', tipo: 'abertura', prioridade: 'normal', responsavel: '', valor_manual: '', definir_manual: false }),
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
                    <Label>Código Identificador *</Label>
                    <Input required placeholder="Ex: CONT-001" value={clienteForm.codigo_identificador} onChange={(e) => update('codigo_identificador', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Nome *</Label>
                    <Input required placeholder="Nome da contabilidade" value={clienteForm.nome} onChange={(e) => update('nome', e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label>CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={clienteForm.cnpj} onChange={(e) => update('cnpj', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Nome do Contador</Label>
                    <Input placeholder="Contador responsável" value={clienteForm.nome_contador} onChange={(e) => update('nome_contador', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Apelido</Label>
                    <Input placeholder="Apelido da contabilidade" value={clienteForm.apelido} onChange={(e) => update('apelido', e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label>Email</Label>
                    <Input type="email" placeholder="email@contabilidade.com" value={clienteForm.email} onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 99999-0000" value={clienteForm.telefone} onChange={(e) => update('telefone', e.target.value)} />
                  </div>
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
                      Clique para selecionar (PDF, DOC — máx. 10MB)
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" onChange={handleFileChange} />
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
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Filtrar clientes..." />
                        <CommandList>
                          <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                          <CommandGroup>
                            {(clientes || []).map((c) => (
                              <CommandItem
                                key={c.id}
                                value={`${c.nome} ${c.codigo_identificador} ${c.apelido || ''} ${c.nome_contador || ''}`}
                                onSelect={() => {
                                  setProcessoForm((f) => ({ ...f, cliente_id: c.id }));
                                  setClienteComboOpen(false);
                                }}
                              >
                                <Check className={cn('mr-2 h-4 w-4', processoForm.cliente_id === c.id ? 'opacity-100' : 'opacity-0')} />
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{c.apelido || c.nome}</span>
                                  <span className="text-muted-foreground ml-1.5 text-xs">({c.codigo_identificador})</span>
                                  {c.nome_contador && <span className="text-muted-foreground text-xs ml-1">· {c.nome_contador}</span>}
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
                  <Input required placeholder="Nome da empresa" value={processoForm.razao_social} onChange={(e) => setProcessoForm((f) => ({ ...f, razao_social: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Processo *</Label>
                    <Select value={processoForm.tipo} onValueChange={(v) => setProcessoForm((f) => ({ ...f, tipo: v as TipoProcesso }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abertura">Abertura</SelectItem>
                        <SelectItem value="alteracao">Alteração</SelectItem>
                        <SelectItem value="transformacao">Transformação</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                        <SelectItem value="avulso">Avulso</SelectItem>
                        <SelectItem value="orcamento">Orçamento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <Select value={processoForm.prioridade} onValueChange={(v) => setProcessoForm((f) => ({ ...f, prioridade: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente (+50%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Manual value toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <Label className="text-sm font-medium">Definir Valor Manualmente</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {processoForm.definir_manual ? 'Valor digitado abaixo será usado.' : 'O sistema calcula usando a Metodologia de Cobrança do cliente.'}
                    </p>
                  </div>
                  <Switch
                    checked={processoForm.definir_manual}
                    onCheckedChange={(checked) => setProcessoForm((f) => ({ ...f, definir_manual: checked }))}
                  />
                </div>

                {processoForm.definir_manual && (
                  <div className="grid gap-2">
                    <Label>Valor Manual (R$) *</Label>
                    <Input required type="number" step="0.01" min="0" placeholder="Informe o valor exato" value={processoForm.valor_manual} onChange={(e) => setProcessoForm((f) => ({ ...f, valor_manual: e.target.value }))} />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Responsável</Label>
                  <Input placeholder="Nome do responsável" value={processoForm.responsavel} onChange={(e) => setProcessoForm((f) => ({ ...f, responsavel: e.target.value }))} />
                </div>
                <Button type="submit" disabled={createProcesso.isPending} className="mt-2 w-fit">
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