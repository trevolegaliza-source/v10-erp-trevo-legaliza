import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, FileText } from 'lucide-react';
import { useClientes, useCreateCliente, useCreateProcesso } from '@/hooks/useFinanceiro';
import type { TipoCliente, TipoProcesso } from '@/types/financial';

export default function CadastroRapido() {
  // Client form
  const [clienteForm, setClienteForm] = useState({
    codigo_identificador: '',
    nome: '',
    tipo: 'AVULSO_4D' as TipoCliente,
    email: '',
    telefone: '',
    dia_vencimento_mensal: 15,
  });
  const createCliente = useCreateCliente();

  // Process form
  const [processoForm, setProcessoForm] = useState({
    cliente_id: '',
    razao_social: '',
    tipo: 'abertura' as TipoProcesso,
    prioridade: 'normal',
    responsavel: '',
  });
  const createProcesso = useCreateProcesso();
  const { data: clientes } = useClientes();

  const handleCreateCliente = (e: React.FormEvent) => {
    e.preventDefault();
    createCliente.mutate(clienteForm, {
      onSuccess: () => setClienteForm({ codigo_identificador: '', nome: '', tipo: 'AVULSO_4D', email: '', telefone: '', dia_vencimento_mensal: 15 }),
    });
  };

  const handleCreateProcesso = (e: React.FormEvent) => {
    e.preventDefault();
    createProcesso.mutate(processoForm, {
      onSuccess: () => setProcessoForm({ cliente_id: '', razao_social: '', tipo: 'abertura', prioridade: 'normal', responsavel: '' }),
    });
  };

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

        <TabsContent value="cliente">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Cadastro de Contabilidade</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCliente} className="grid gap-4 max-w-lg">
                <div className="grid gap-2">
                  <Label>Código Identificador *</Label>
                  <Input
                    required
                    placeholder="Ex: CONT-001"
                    value={clienteForm.codigo_identificador}
                    onChange={(e) => setClienteForm(f => ({ ...f, codigo_identificador: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Nome *</Label>
                  <Input
                    required
                    placeholder="Nome da contabilidade"
                    value={clienteForm.nome}
                    onChange={(e) => setClienteForm(f => ({ ...f, nome: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tipo *</Label>
                  <Select
                    value={clienteForm.tipo}
                    onValueChange={(v) => setClienteForm(f => ({ ...f, tipo: v as TipoCliente }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                      <SelectItem value="AVULSO_4D">Avulso (4 dias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {clienteForm.tipo === 'MENSALISTA' && (
                  <div className="grid gap-2">
                    <Label>Dia de Vencimento Mensal</Label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={clienteForm.dia_vencimento_mensal}
                      onChange={(e) => setClienteForm(f => ({ ...f, dia_vencimento_mensal: Number(e.target.value) }))}
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      placeholder="email@contabilidade.com"
                      value={clienteForm.email}
                      onChange={(e) => setClienteForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="(11) 99999-0000"
                      value={clienteForm.telefone}
                      onChange={(e) => setClienteForm(f => ({ ...f, telefone: e.target.value }))}
                    />
                  </div>
                </div>
                <Button type="submit" disabled={createCliente.isPending} className="mt-2 w-fit">
                  {createCliente.isPending ? 'Criando...' : 'Cadastrar Cliente'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="processo">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Novo Processo</CardTitle>
              <p className="text-xs text-muted-foreground">O valor e vencimento serão calculados automaticamente pelo motor de cobrança</p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProcesso} className="grid gap-4 max-w-lg">
                <div className="grid gap-2">
                  <Label>Cliente (Contabilidade) *</Label>
                  <Select
                    value={processoForm.cliente_id}
                    onValueChange={(v) => setProcessoForm(f => ({ ...f, cliente_id: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                    <SelectContent>
                      {(clientes || []).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome} ({c.codigo_identificador})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Razão Social *</Label>
                  <Input
                    required
                    placeholder="Nome da empresa"
                    value={processoForm.razao_social}
                    onChange={(e) => setProcessoForm(f => ({ ...f, razao_social: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Tipo de Processo *</Label>
                    <Select
                      value={processoForm.tipo}
                      onValueChange={(v) => setProcessoForm(f => ({ ...f, tipo: v as TipoProcesso }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="abertura">Abertura</SelectItem>
                        <SelectItem value="alteracao">Alteração</SelectItem>
                        <SelectItem value="transformacao">Transformação</SelectItem>
                        <SelectItem value="baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={processoForm.prioridade}
                      onValueChange={(v) => setProcessoForm(f => ({ ...f, prioridade: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="urgente">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Responsável</Label>
                  <Input
                    placeholder="Nome do responsável"
                    value={processoForm.responsavel}
                    onChange={(e) => setProcessoForm(f => ({ ...f, responsavel: e.target.value }))}
                  />
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
