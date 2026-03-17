import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Building2, User, Settings, FileText, DollarSign, Download, Trash2, Upload, Edit2, Save, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useUpdateCliente } from '@/hooks/useFinanceiro';
import { KANBAN_STAGES } from '@/types/process';
import { STATUS_LABELS, STATUS_STYLES, TIPO_PROCESSO_LABELS } from '@/types/financial';
import type { ClienteDB, ProcessoDB, Lancamento, StatusFinanceiro, TipoProcesso } from '@/types/financial';
import { cn } from '@/lib/utils';

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [cliente, setCliente] = useState<ClienteDB | null>(null);
  const [processos, setProcessos] = useState<ProcessoDB[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [contracts, setContracts] = useState<{ name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<ClienteDB>>({});
  const [uploadingContract, setUploadingContract] = useState(false);
  const updateCliente = useUpdateCliente();

  useEffect(() => {
    if (!id) return;
    loadAll(id);
  }, [id]);

  const loadAll = async (clienteId: string) => {
    setLoading(true);
    const [cRes, pRes, lRes] = await Promise.all([
      supabase
        .from('clientes')
        .select('id,codigo_identificador,nome,tipo,email,telefone,nome_contador,apelido,dia_vencimento_mensal,momento_faturamento,valor_base,desconto_progressivo,dia_cobranca,valor_limite_desconto,mensalidade,vencimento,qtd_processos,created_at,updated_at')
        .eq('id', clienteId)
        .single(),
      supabase.from('processos').select('*').eq('cliente_id', clienteId).order('created_at', { ascending: false }),
      supabase.from('lancamentos').select('*').eq('cliente_id', clienteId).order('data_vencimento', { ascending: false }),
    ]);
    if (cRes.data) { setCliente(cRes.data as ClienteDB); setEditForm(cRes.data as ClienteDB); }
    setProcessos((pRes.data || []) as ProcessoDB[]);
    setLancamentos((lRes.data || []) as Lancamento[]);
    loadContracts(clienteId);
    setLoading(false);
  };

  const loadContracts = async (clienteId: string) => {
    const { data } = await supabase.storage.from('contratos').list(clienteId);
    setContracts((data || []).map(f => ({ name: f.name })));
  };

  const handleSaveParams = () => {
    if (!cliente) return;
    const payload: Record<string, any> = { id: cliente.id };
    const fields = ['valor_base', 'desconto_progressivo', 'dia_cobranca', 'valor_limite_desconto', 'mensalidade', 'vencimento', 'qtd_processos', 'momento_faturamento', 'dia_vencimento_mensal'] as const;
    for (const f of fields) {
      if ((editForm as any)[f] !== undefined) payload[f] = (editForm as any)[f];
    }
    updateCliente.mutate(payload as any, {
      onSuccess: () => { setEditing(false); loadAll(cliente.id); toast.success('Parâmetros atualizados!'); },
      onError: (err: any) => { toast.error('Erro ao salvar: ' + (err?.message || 'Erro desconhecido')); },
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!cliente || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) { toast.error('Máx. 10MB'); return; }
    setUploadingContract(true);
    const path = `${cliente.id}/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('contratos').upload(path, file);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Contrato anexado!'); loadContracts(cliente.id); }
    setUploadingContract(false);
  };

  const handleDownload = async (fileName: string) => {
    if (!cliente) return;
    const { data, error } = await supabase.storage.from('contratos').download(`${cliente.id}/${fileName}`);
    if (error) { toast.error('Erro ao baixar'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteContract = async (fileName: string) => {
    if (!cliente) return;
    const { error } = await supabase.storage.from('contratos').remove([`${cliente.id}/${fileName}`]);
    if (error) toast.error('Erro ao excluir');
    else { toast.success('Removido'); loadContracts(cliente.id); }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="link" asChild><Link to="/clientes">Voltar</Link></Button>
      </div>
    );
  }

  const isMensalista = cliente.tipo === 'MENSALISTA';
  const momentoFat = (cliente as any).momento_faturamento || 'na_solicitacao';
  const isDeferimento = momentoFat === 'no_deferimento';
  const totalProcessos = processos.length;
  const processosAtivos = processos.filter(p => p.etapa !== 'finalizados' && p.etapa !== 'arquivo').length;
  const totalFaturado = lancamentos.filter(l => l.tipo === 'receber').reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.tipo === 'receber' && l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);
  const formatCurrencyOrZero = (value: number | null | undefined) =>
    Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatValueOrZero = (value: number | null | undefined) =>
    value == null ? '0,00' : String(value);

  const DEFERIMENTO_STAGES = ['registro', 'finalizados'];
  const billedProcessIds = new Set(lancamentos.filter(l => l.tipo === 'receber' && l.processo_id).map(l => l.processo_id));
  const aguardandoDeferimento = isDeferimento
    ? processos.filter(p => !DEFERIMENTO_STAGES.includes(p.etapa) && p.etapa !== 'arquivo' && !billedProcessIds.has(p.id))
    : [];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1" asChild>
          <Link to="/clientes"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{cliente.apelido || cliente.nome}</h1>
            <Badge className={cn('text-xs', isMensalista ? 'bg-primary/10 text-primary border-primary/30' : 'bg-warning/10 text-warning border-warning/30')} variant="outline">
              {isMensalista ? 'Mensalista' : 'Avulso'}
            </Badge>
            {isDeferimento && (
              <Badge variant="outline" className="text-xs border-warning/30 text-warning">
                Fatura no Deferimento
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{cliente.nome}</span>
            {cliente.nome_contador && <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{cliente.nome_contador}</span>}
            <span className="text-xs">Código: {cliente.codigo_identificador}</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Processos</p>
            <p className="text-2xl font-bold">{totalProcessos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ativos</p>
            <p className="text-2xl font-bold text-primary">{processosAtivos}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Faturado</p>
            <p className="text-2xl font-bold">{totalFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold text-warning">{totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="financeiro-config" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="financeiro-config" className="text-xs gap-1"><Settings className="h-3.5 w-3.5" />Config. Financeira</TabsTrigger>
          <TabsTrigger value="processos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Processos</TabsTrigger>
          <TabsTrigger value="faturas" className="text-xs gap-1"><DollarSign className="h-3.5 w-3.5" />Financeiro</TabsTrigger>
          <TabsTrigger value="contratos" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" />Contratos</TabsTrigger>
        </TabsList>

        {/* ── Config Financeira ── */}
        <TabsContent value="financeiro-config">
          <Card className="border-border/60">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Parâmetros Financeiros</CardTitle>
              {!editing ? (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3.5 w-3.5" /> Editar Parâmetros
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setEditForm(cliente); }}><X className="h-3.5 w-3.5 mr-1" />Cancelar</Button>
                  <Button size="sm" className="gap-1.5" onClick={handleSaveParams} disabled={updateCliente.isPending}><Save className="h-3.5 w-3.5" />Salvar</Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo de Cliente</Label>
                  <p className="font-medium">{isMensalista ? 'Mensalista' : 'Avulso'}</p>
                </div>
                {isMensalista ? (
                  <>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor da Mensalidade</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).mensalidade ?? ''} onChange={e => setEditForm(f => ({ ...f, mensalidade: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).mensalidade)}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Vencimento</Label>
                      {editing ? (
                        <Input type="number" min={1} max={31} value={(editForm as any).vencimento ?? (editForm as any).dia_vencimento_mensal ?? ''} onChange={e => { const v = e.target.value ? Number(e.target.value) : null; setEditForm(f => ({ ...f, vencimento: v, dia_vencimento_mensal: v ?? undefined })); }} />
                      ) : (
                        <p className="font-medium">Dia {(cliente as any).vencimento ?? cliente.dia_vencimento_mensal ?? 0}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Qtd Processos Inclusos</Label>
                      {editing ? (
                        <Input type="number" min={0} value={(editForm as any).qtd_processos ?? ''} onChange={e => setEditForm(f => ({ ...f, qtd_processos: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatValueOrZero((cliente as any).qtd_processos)}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor Base</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).valor_base ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_base: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatCurrencyOrZero((cliente as any).valor_base)}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Desconto Progressivo (%)</Label>
                      {editing ? (
                        <Input type="number" step="0.1" value={(editForm as any).desconto_progressivo ?? ''} onChange={e => setEditForm(f => ({ ...f, desconto_progressivo: e.target.value ? Number(e.target.value) : null }))} placeholder="0,00" />
                      ) : (
                        <p className="font-medium">{formatValueOrZero((cliente as any).desconto_progressivo)}%</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Valor Limite de Desconto</Label>
                      {editing ? (
                        <Input type="number" step="0.01" value={(editForm as any).valor_limite_desconto ?? ''} onChange={e => setEditForm(f => ({ ...f, valor_limite_desconto: e.target.value ? Number(e.target.value) : null }))} placeholder="R$ 0,00" />
                      ) : (
                        <p className="font-medium">{(cliente as any).valor_limite_desconto ? Number((cliente as any).valor_limite_desconto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</p>
                      )}
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-muted-foreground">Dia de Cobrança (D+X)</Label>
                      {editing ? (
                        <Input type="number" min={1} max={30} value={(editForm as any).dia_cobranca ?? ''} onChange={e => setEditForm(f => ({ ...f, dia_cobranca: e.target.value ? Number(e.target.value) : null }))} placeholder="4" />
                      ) : (
                        <p className="font-medium">{(cliente as any).dia_cobranca != null ? `D+${(cliente as any).dia_cobranca}` : '—'}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Processos ── */}
        <TabsContent value="processos">
          {/* Aguardando Deferimento Banner */}
          {aguardandoDeferimento.length > 0 && (
            <div className="mb-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
              <p className="text-xs font-semibold text-warning mb-2">⏳ Aguardando Deferimento para Cobrança ({aguardandoDeferimento.length})</p>
              <div className="space-y-1">
                {aguardandoDeferimento.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-sm">
                    <span>{p.razao_social}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">A cobrança será gerada automaticamente ao mover para "Registro" ou "Finalizados" no Kanban.</p>
            </div>
          )}

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Processos ({totalProcessos})</CardTitle>
            </CardHeader>
            <CardContent>
              {processos.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processos.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.razao_social}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                            {TIPO_PROCESSO_LABELS[p.tipo as TipoProcesso] || p.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{KANBAN_STAGES.find(s => s.key === p.etapa)?.label || p.etapa}</TableCell>
                        <TableCell>
                          {p.prioridade === 'urgente'
                            ? <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                            : <span className="text-xs text-muted-foreground">Normal</span>}
                        </TableCell>
                        <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {p.valor ? Number(p.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum processo registrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Financeiro ── */}
        <TabsContent value="faturas">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Faturas e Fechamentos</CardTitle>
                <div className="flex gap-2 text-xs">
                  <Badge className="bg-success/10 text-success border-0">Pago: {totalPago.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                  <Badge className="bg-warning/10 text-warning border-0">Pendente: {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!isMensalista && (
                <div className="mb-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-medium">Próximo Fechamento (Avulso)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cobrança prevista para D+{cliente.dia_vencimento_mensal || 4} após a última solicitação
                  </p>
                </div>
              )}
              {lancamentos.filter(l => l.tipo === 'receber').length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lancamentos.filter(l => l.tipo === 'receber').map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium text-sm">{l.descricao}</TableCell>
                        <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px] border-0', STATUS_STYLES[l.status as StatusFinanceiro] || '')}>
                            {STATUS_LABELS[l.status as StatusFinanceiro] || l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {Number(l.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma fatura registrada</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Contratos ── */}
        <TabsContent value="contratos">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contratos Anexados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contracts.length > 0 ? (
                <div className="space-y-2">
                  {contracts.map(c => (
                    <div key={c.name} className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3 border border-border/40">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex-1 text-sm truncate">{c.name}</span>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => handleDownload(c.name)}>
                        <Download className="h-3 w-3" /> Baixar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => handleDeleteContract(c.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">Nenhum contrato anexado</p>
              )}
              <label className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground cursor-pointer hover:bg-muted/40 transition-colors">
                <Upload className="h-4 w-4" />
                {uploadingContract ? 'Enviando...' : 'Clique para anexar contrato (PDF, DOC — máx. 10MB)'}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={uploadingContract} />
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
