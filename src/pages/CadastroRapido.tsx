import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, FileText, Upload, X } from 'lucide-react';
import { useClientes, useCreateCliente, useCreateProcesso } from '@/hooks/useFinanceiro';
import type { TipoCliente, TipoProcesso } from '@/types/financial';
import { toast } from 'sonner';

const INITIAL_CLIENTE = {
  codigo_identificador: '',
  nome: '',
  tipo: 'AVULSO_4D' as TipoCliente,
  email: '',
  telefone: '',
  nome_contador: '',
  apelido: '',
  dia_vencimento_mensal: 15,
  // Avulso-specific
  valor_base: '',
  desconto_tier2: '',
  dia_cobranca: 'D+4',
  // Mensalista-specific
  valor_mensalidade: '',
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
  });
  const createProcesso = useCreateProcesso();
  const [clientSearch, setClientSearch] = useState('');
  const { data: clientes } = useClientes(clientSearch);

  const isManualPrice = processoForm.tipo === 'avulso' || processoForm.tipo === 'orcamento';
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

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    createCliente.mutate(
      {
        codigo_identificador: clienteForm.codigo_identificador,
        nome: clienteForm.nome,
        tipo: clienteForm.tipo,
        email: clienteForm.email || null,
        telefone: clienteForm.telefone || null,
        nome_contador: clienteForm.nome_contador || '',
        apelido: clienteForm.apelido || '',
        dia_vencimento_mensal: isMensalista ? clienteForm.dia_vencimento_mensal : 0,
      },
      {
        onSuccess: () => {
          setClienteForm(INITIAL_CLIENTE);
          setContratoFile(null);
          // TODO: upload contratoFile to storage bucket when configured
          if (contratoFile) {
            toast.info('Contrato será vinculado após configuração do storage.');
          }
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
        valor_manual: isManualPrice ? Number(processoForm.valor_manual) : undefined,
      },
      {
        onSuccess: () =>
          setProcessoForm({ cliente_id: '', razao_social: '', tipo: 'abertura', prioridade: 'normal', responsavel: '', valor_manual: '' }),
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
                {/* Identification */}
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

                {/* Contact */}
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

                {/* Client Type Selector */}
                <div className="grid gap-1.5">
                  <Label>Tipo de Cliente *</Label>
                  <Select value={clienteForm.tipo} onValueChange={(v) => update('tipo', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AVULSO_4D">Avulso (D+4)</SelectItem>
                      <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* ── Conditional: AVULSO ── */}
                {isAvulso && (
                  <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 space-y-4">
                    <p className="text-xs font-medium text-warning">Configuração Avulso (D+4)</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-1.5">
                        <Label>Valor Base (R$)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0,00" value={clienteForm.valor_base} onChange={(e) => update('valor_base', e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Desconto Progressivo - Tier 2 (%)</Label>
                        <Input type="number" step="0.1" min="0" max="100" placeholder="0" value={clienteForm.desconto_tier2} onChange={(e) => update('desconto_tier2', e.target.value)} />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Regra de vencimento: D+4 após solicitação do processo.
                    </p>
                  </div>
                )}

                {/* ── Conditional: MENSALISTA ── */}
                {isMensalista && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-4">
                    <p className="text-xs font-medium text-primary">Configuração Mensalista</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="grid gap-1.5">
                        <Label>Qtd. Processos Contratados</Label>
                        <Input type="number" min="1" placeholder="10" value={clienteForm.qtd_processos_contratados} onChange={(e) => update('qtd_processos_contratados', e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Valor Mensalidade (R$)</Label>
                        <Input type="number" step="0.01" min="0" placeholder="0,00" value={clienteForm.valor_mensalidade} onChange={(e) => update('valor_mensalidade', e.target.value)} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label>Dia de Vencimento</Label>
                        <Input type="number" min={1} max={28} value={clienteForm.dia_vencimento_mensal} onChange={(e) => update('dia_vencimento_mensal', Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

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
              <p className="text-xs text-muted-foreground">Valor calculado automaticamente. Prioridade urgente adiciona +50% (×1.5).</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProcesso} className="grid gap-4 max-w-lg">
                <div className="grid gap-2">
                  <Label>Cliente (Contabilidade) *</Label>
                  <Input placeholder="Buscar por nome, código, contador, apelido..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="mb-1" />
                  <Select value={processoForm.cliente_id} onValueChange={(v) => setProcessoForm((f) => ({ ...f, cliente_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {(clientes || []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.codigo_identificador}) {c.nome_contador ? `- ${c.nome_contador}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Razão Social *</Label>
                  <Input required placeholder="Nome da empresa" value={processoForm.razao_social} onChange={(e) => setProcessoForm((f) => ({ ...f, razao_social: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Processo *</Label>
                    <Select value={processoForm.tipo} onValueChange={(v) => setProcessoForm((f) => ({ ...f, tipo: v as TipoProcesso }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente (+50%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {isManualPrice && (
                  <div className="grid gap-2">
                    <Label>Valor Manual (R$) *</Label>
                    <Input required type="number" step="0.01" min="0" placeholder="Informe o valor" value={processoForm.valor_manual} onChange={(e) => setProcessoForm((f) => ({ ...f, valor_manual: e.target.value }))} />
                    <p className="text-[11px] text-muted-foreground">Para tipos Avulso/Orçamento o valor é informado manualmente.</p>
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
