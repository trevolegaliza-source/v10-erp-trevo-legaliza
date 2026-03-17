import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Users, Mail, Phone, Search, UserX, Upload, FileText, Download, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClientes, useUpdateCliente, useDeleteCliente } from '@/hooks/useFinanceiro';
import { useProcessos } from '@/hooks/useFinanceiro';
import type { ClienteDB, TipoCliente } from '@/types/financial';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Clientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editClient, setEditClient] = useState<ClienteDB | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});

  const { data: clientes, isLoading } = useClientes(search);
  const { data: processos } = useProcessos();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();

  // Count processes per client
  const processCount = (clienteId: string) =>
    (processos || []).filter(p => p.cliente_id === clienteId).length;
  const activeCount = (clienteId: string) =>
    (processos || []).filter(p => p.cliente_id === clienteId && p.etapa !== 'finalizados' && p.etapa !== 'arquivo').length;

  // Inactive = no processes in last 10 days
  const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
  const isInactive = (clienteId: string) => {
    const clientProcesses = (processos || []).filter(p => p.cliente_id === clienteId);
    if (clientProcesses.length === 0) return true;
    return !clientProcesses.some(p => p.created_at >= tenDaysAgo);
  };

  const filtered = (clientes || []).filter(c => {
    if (showInactive) return isInactive(c.id);
    return true;
  });

  const [contracts, setContracts] = useState<{ name: string; id: string }[]>([]);
  const [uploadingContract, setUploadingContract] = useState(false);

  const openEdit = (client: ClienteDB) => {
    setEditClient(client);
    setEditForm({ ...client });
    loadContracts(client.id);
  };

  const loadContracts = async (clienteId: string) => {
    const { data } = await supabase.storage.from('contratos').list(clienteId);
    setContracts((data || []).map(f => ({ name: f.name, id: f.id })));
  };

  const handleUploadContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editClient || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error('Máx. 10MB'); return; }
    setUploadingContract(true);
    const ext = file.name.split('.').pop();
    const path = `${editClient.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('contratos').upload(path, file);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Contrato anexado!'); loadContracts(editClient.id); }
    setUploadingContract(false);
  };

  const handleDownloadContract = async (fileName: string) => {
    if (!editClient) return;
    const { data, error } = await supabase.storage.from('contratos').download(`${editClient.id}/${fileName}`);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (fileName: string) => {
    if (!editClient) return;
    const { error } = await supabase.storage.from('contratos').remove([`${editClient.id}/${fileName}`]);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Contrato removido'); loadContracts(editClient.id); }
  };

  const handleSave = () => {
    if (!editClient) return;
    updateCliente.mutate({ id: editClient.id, ...editForm } as any, {
      onSuccess: () => setEditClient(null),
    });
  };

  const handleDelete = () => {
    if (!editClient) return;
    if (!window.confirm(`Excluir ${editClient.nome}?`)) return;
    deleteCliente.mutate(editClient.id, {
      onSuccess: () => setEditClient(null),
    });
  };

  const totalClientes = (clientes || []).length;
  const mensalistas = (clientes || []).filter(c => c.tipo === 'MENSALISTA').length;
  const avulsos = (clientes || []).filter(c => c.tipo === 'AVULSO_4D').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{totalClientes} contabilidades cadastradas</p>
        </div>
        <Button size="sm" className="h-9" asChild>
          <Link to="/cadastro-rapido">
            <Plus className="h-4 w-4 mr-1" />
            Novo Cliente
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{totalClientes}</p><p className="text-xs text-muted-foreground">Total de Clientes</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2.5"><Users className="h-5 w-5 text-info" /></div>
            <div><p className="text-2xl font-bold">{mensalistas}</p><p className="text-xs text-muted-foreground">Mensalistas</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><Users className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{avulsos}</p><p className="text-xs text-muted-foreground">Avulsos</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, código, contador..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Button
          variant={showInactive ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => setShowInactive(!showInactive)}
        >
          <UserX className="h-3.5 w-3.5" />
          Inativos ({(clientes || []).filter(c => isInactive(c.id)).length})
        </Button>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Listagem de Clientes</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome / Apelido</TableHead>
                  <TableHead>Contador</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Processos</TableHead>
                  <TableHead className="text-center">Ativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/clientes/${client.id}`}
                    onDoubleClick={() => openEdit(client)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{client.nome}</p>
                        {client.apelido && <p className="text-xs text-muted-foreground">{client.apelido}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{client.nome_contador || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={client.tipo === 'MENSALISTA' ? 'border-primary/30 text-primary' : 'border-warning/30 text-warning'}>
                        {client.tipo === 'MENSALISTA' ? 'Mensalista' : 'Avulso'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {client.email && <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{client.email}</div>}
                        {client.telefone && <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{client.telefone}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-medium">{processCount(client.id)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-primary/10 text-primary border-0">{activeCount(client.id)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {showInactive ? 'Nenhum cliente inativo' : 'Nenhum cliente encontrado'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">💡 Dê um duplo-clique para editar um cliente</p>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={!!editClient} onOpenChange={(o) => !o && setEditClient(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input value={editForm.nome || ''} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nome do Contador</Label>
                <Input value={editForm.nome_contador || ''} onChange={e => setEditForm(f => ({ ...f, nome_contador: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Apelido</Label>
                <Input value={editForm.apelido || ''} onChange={e => setEditForm(f => ({ ...f, apelido: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={editForm.tipo} onValueChange={(v) => setEditForm(f => ({ ...f, tipo: v as TipoCliente }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                  <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={editForm.email || ''} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Telefone</Label>
                <Input value={editForm.telefone || ''} onChange={e => setEditForm(f => ({ ...f, telefone: e.target.value }))} />
              </div>
            </div>
            {editForm.tipo === 'MENSALISTA' && (
              <div className="grid gap-2">
                <Label>Dia de Vencimento</Label>
                <Input type="number" min={1} max={28} value={editForm.dia_vencimento_mensal || 15} onChange={e => setEditForm(f => ({ ...f, dia_vencimento_mensal: Number(e.target.value) }))} />
              </div>
            )}
            {/* Contratos */}
            <div className="grid gap-2 border-t border-border/40 pt-3">
              <Label className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Contratos Anexados</Label>
              {contracts.length > 0 ? (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {contracts.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md px-3 py-1.5">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{c.name}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDownloadContract(c.name)}>
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteContract(c.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum contrato anexado</p>
              )}
              <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-4 w-4" />
                {uploadingContract ? 'Enviando...' : 'Anexar Contrato (PDF, DOC — máx. 10MB)'}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUploadContract} disabled={uploadingContract} />
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditClient(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={updateCliente.isPending}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
