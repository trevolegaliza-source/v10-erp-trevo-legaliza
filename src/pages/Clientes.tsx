import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Users, Mail, Phone, Search, UserX, Upload, FileText, Download, Trash2, Archive, ArchiveRestore, ExternalLink, AlertTriangle, Eye } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import PasswordConfirmDialog from '@/components/PasswordConfirmDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useClientes, useUpdateCliente, useDeleteCliente, useArchiveCliente, useUnarchiveCliente } from '@/hooks/useFinanceiro';
import { useProcessos } from '@/hooks/useFinanceiro';
import type { ClienteDB, TipoCliente } from '@/types/financial';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { STORAGE_BUCKETS } from '@/constants/storage';
import ContractDropzone from '@/components/contratos/ContractDropzone';
import ContractPreviewModal from '@/components/contratos/ContractPreviewModal';

function ContractButton({ clienteId, contrato_url }: { clienteId: string; contrato_url?: string | null }) {
  const [hasContract, setHasContract] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(clienteId).then(({ data }) => {
      setHasContract(!!(data && data.length > 0));
    });
  }, [clienteId]);

  if (hasContract === null) return <span className="text-muted-foreground text-xs">...</span>;
  if (!hasContract) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Atenção: Contrato não anexado</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const handleView = async () => {
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(clienteId);
    if (!data || data.length === 0) return;
    const fileName = data[0].name;
    const { data: signed } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).createSignedUrl(`${clienteId}/${fileName}`, 3600);
    if (signed?.signedUrl) window.open(signed.signedUrl, '_blank');
  };

  return (
    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary" onClick={handleView}>
      <ExternalLink className="h-3 w-3" /> Ver Contrato
    </Button>
  );
}

export default function Clientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editClient, setEditClient] = useState<ClienteDB | null>(null);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [pendingDeleteAction, setPendingDeleteAction] = useState<(() => void) | null>(null);

  const { data: clientes, isLoading } = useClientes(search);
  const { data: processos } = useProcessos();
  const updateCliente = useUpdateCliente();
  const deleteCliente = useDeleteCliente();
  const archiveCliente = useArchiveCliente();
  const unarchiveCliente = useUnarchiveCliente();

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
    const archived = !!(c as any).is_archived;
    if (showArchived) return archived;
    if (archived) return false; // hide archived by default
    if (showInactive) return isInactive(c.id);
    return true;
  });

  const [contracts, setContracts] = useState<{ name: string; id: string }[]>([]);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState('');

  const openEdit = (client: ClienteDB) => {
    setEditClient(client);
    setEditForm({ ...client });
    loadContracts(client.id);
  };

  const loadContracts = async (clienteId: string) => {
    const { data } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).list(clienteId);
    setContracts((data || []).map(f => ({ name: f.name, id: f.id })));
  };

  const handleUploadContract = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!editClient || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error('Máx. 10MB'); return; }
    setUploadingContract(true);
    const path = `${editClient.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).upload(path, file);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Contrato anexado!'); loadContracts(editClient.id); }
    setUploadingContract(false);
  };

  const handleDownloadContract = async (fileName: string) => {
    if (!editClient) return;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).download(`${editClient.id}/${fileName}`);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (fileName: string) => {
    if (!editClient) return;
    setPendingDeleteAction(() => async () => {
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.CONTRACTS).remove([`${editClient.id}/${fileName}`]);
      if (error) toast.error('Erro ao excluir');
      else { toast.success('Contrato removido'); loadContracts(editClient.id); }
    });
    setShowDeletePassword(true);
  };

  const handleSave = () => {
    if (!editClient) return;
    updateCliente.mutate({ id: editClient.id, ...editForm } as any, {
      onSuccess: () => setEditClient(null),
    });
  };

  const handleDelete = () => {
    if (!editClient) return;
    setPendingDeleteAction(() => () => {
      deleteCliente.mutate(editClient.id, {
        onSuccess: () => setEditClient(null),
      });
    });
    setShowDeletePassword(true);
  };

  const handleArchive = (clientId: string) => {
    setPendingDeleteAction(() => () => {
      archiveCliente.mutate(clientId, {
        onSuccess: () => setEditClient(null),
      });
    });
    setShowDeletePassword(true);
  };

  const handleUnarchive = (clientId: string) => {
    setPendingDeleteAction(() => () => {
      unarchiveCliente.mutate(clientId, {
        onSuccess: () => setEditClient(null),
      });
    });
    setShowDeletePassword(true);
  };

  const activeClientes = (clientes || []).filter(c => !(c as any).is_archived);
  const totalClientes = activeClientes.length;
  const mensalistas = activeClientes.filter(c => c.tipo === 'MENSALISTA').length;
  const avulsos = activeClientes.filter(c => c.tipo === 'AVULSO_4D').length;

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
          onClick={() => { setShowInactive(!showInactive); setShowArchived(false); }}
        >
          <UserX className="h-3.5 w-3.5" />
          Inativos ({(clientes || []).filter(c => !(c as any).is_archived && isInactive(c.id)).length})
        </Button>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => { setShowArchived(!showArchived); setShowInactive(false); }}
        >
          <Archive className="h-3.5 w-3.5" />
          Arquivados ({(clientes || []).filter(c => (c as any).is_archived).length})
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
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Valor Base / Mensalidade</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead className="text-center">Processos</TableHead>
                  <TableHead className="text-center">Contrato</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((client) => {
                  const isMens = client.tipo === 'MENSALISTA';
                  const valorExibir = isMens
                    ? (client as any).mensalidade
                    : (client as any).valor_base;
                  const descontoExibir = (client as any).desconto_progressivo;
                  const limiteExibir = (client as any).valor_limite_desconto;

                  return (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/clientes/${client.id}`)}
                      onDoubleClick={() => openEdit(client)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{client.nome}</p>
                          {client.apelido && <p className="text-xs text-muted-foreground">{client.apelido}</p>}
                          {client.nome_contador && <p className="text-[10px] text-muted-foreground">Contador: {client.nome_contador}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{(client as any).cnpj || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={isMens ? 'border-primary/30 text-primary' : 'border-warning/30 text-warning'}>
                          {isMens ? 'Mensalista' : 'Avulso'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {valorExibir != null
                            ? Number(valorExibir).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            : '—'}
                        </span>
                        {isMens && (client as any).qtd_processos != null && (
                          <p className="text-[10px] text-muted-foreground">{(client as any).qtd_processos} proc. inclusos</p>
                        )}
                      </TableCell>
                      <TableCell>
                        {descontoExibir != null && descontoExibir > 0 ? (
                          <div>
                            <span className="text-sm font-medium">{descontoExibir}%</span>
                            {limiteExibir != null && (
                              <p className="text-[10px] text-muted-foreground">
                                Mín. {Number(limiteExibir).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-primary/10 text-primary border-0">{activeCount(client.id)}/{processCount(client.id)}</Badge>
                      </TableCell>
                      <TableCell className="text-center" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                        <ContractButton clienteId={client.id} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
                          {(client as any).is_archived ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Desarquivar" onClick={() => handleUnarchive(client.id)}>
                              <ArchiveRestore className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Arquivar" onClick={() => handleArchive(client.id)}>
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
            {/* Financial params in edit modal */}
            {editForm.tipo === 'MENSALISTA' ? (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary">Configuração Mensalista</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Mensalidade (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).mensalidade ?? ''} onChange={e => setEditForm(f => ({ ...f, mensalidade: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Dia Vencimento</Label>
                    <Input type="number" min={1} max={31} value={(editForm as any).vencimento ?? editForm.dia_vencimento_mensal ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setEditForm(f => ({ ...f, vencimento: v, dia_vencimento_mensal: v ?? undefined })); }} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Processos Inclusos</Label>
                    <Input type="number" min={0} value={(editForm as any).qtd_processos ?? ''} onChange={e => setEditForm(f => ({ ...f, qtd_processos: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-3">
                <p className="text-xs font-medium text-warning">Configuração Avulso</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label className="text-xs">Valor Base (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Desconto (%)</Label>
                    <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => setEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Limite Desconto (R$)</Label>
                    <Input type="number" step="0.01" value={(editForm as any).valor_limite_desconto ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_limite_desconto: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Dia Cobrança (D+X)</Label>
                    <Input type="number" min={1} max={30} value={(editForm as any).dia_cobranca ?? ''} onChange={e => setEditForm(f => ({ ...f, dia_cobranca: e.target.value ? Number(e.target.value) : null }))} />
                  </div>
                </div>
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
              <div className="flex gap-2">
                <Button variant="destructive" size="sm" onClick={handleDelete}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>
                {!(editClient as any)?.is_archived ? (
                  <Button variant="outline" size="sm" onClick={() => editClient && handleArchive(editClient.id)}><Archive className="h-3.5 w-3.5 mr-1" />Arquivar</Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => editClient && handleUnarchive(editClient.id)}><ArchiveRestore className="h-3.5 w-3.5 mr-1" />Desarquivar</Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditClient(null)}>Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={updateCliente.isPending}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={showDeletePassword}
        onOpenChange={setShowDeletePassword}
        onConfirm={() => { pendingDeleteAction?.(); setPendingDeleteAction(null); }}
      />
    </div>
  );
}
