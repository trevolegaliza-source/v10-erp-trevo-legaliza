import { useState, useMemo, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { parseFile, mapRows, type ProcessoImportRow, type ClienteLookup } from '@/lib/importar-processos';
import { useQuery, useQueryClient } from '@tanstack/react-query';

function useClientesLookup() {
  return useQuery({
    queryKey: ['clientes_lookup_import'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, codigo_identificador, valor_base');
      if (error) throw error;
      return (data || []) as ClienteLookup[];
    },
  });
}

export default function ImportarProcessos() {
  const { data: clientes = [] } = useClientesLookup();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<ProcessoImportRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      setFileName(file.name);
      setImportedCount(null);
      const rawRows = await parseFile(file);
      const mapped = mapRows(rawRows, clientes);
      setRows(mapped);
      const readyIds = new Set(mapped.filter(r => r.status === 'ready').map(r => r.rowIndex));
      setSelected(readyIds);
      toast.success(`${rawRows.length} linhas lidas de ${file.name}`);
    } catch (err: any) {
      toast.error('Erro ao ler arquivo: ' + err.message);
    }
  }, [clientes]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
  });

  const stats = useMemo(() => {
    const ready = rows.filter(r => r.status === 'ready').length;
    const noClient = rows.filter(r => r.status === 'no_client').length;
    return { ready, noClient, total: rows.length };
  }, [rows]);

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllReady = () => {
    const readyIds = rows.filter(r => r.status === 'ready').map(r => r.rowIndex);
    setSelected(prev => {
      if (readyIds.every(id => prev.has(id))) return new Set();
      return new Set(readyIds);
    });
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => selected.has(r.rowIndex) && r.clienteId && r.tipo);
    if (toImport.length === 0) {
      toast.error('Nenhuma linha válida selecionada');
      return;
    }

    setImporting(true);
    try {
      const hoje = new Date().toLocaleDateString('pt-BR');

      // Create processes
      const processos = toImport.map(r => ({
        cliente_id: r.clienteId!,
        razao_social: r.razaoSocial,
        tipo: r.tipo as any,
        etapa: 'recebidos',
        prioridade: 'normal',
        notas: `Importado via planilha em ${hoje}`,
      }));

      const { data: created, error: pErr } = await supabase
        .from('processos')
        .insert(processos)
        .select('id, cliente_id');
      if (pErr) throw pErr;

      // Fetch valor_base for each client
      const clienteMap = new Map<string, number>();
      clientes.forEach(c => clienteMap.set(c.id, c.valor_base || 0));

      // Create lancamentos
      const lancamentos = (created || []).map(p => {
        const valor = clienteMap.get(p.cliente_id) || 0;
        const venc = new Date();
        venc.setDate(venc.getDate() + 4);
        return {
          tipo: 'receber' as const,
          cliente_id: p.cliente_id,
          processo_id: p.id,
          descricao: 'Honorários do processo',
          valor,
          status: 'pendente' as const,
          etapa_financeiro: 'solicitacao_criada',
          data_vencimento: venc.toISOString().split('T')[0],
        };
      });

      if (lancamentos.length > 0) {
        const { error: lErr } = await supabase.from('lancamentos').insert(lancamentos as any);
        if (lErr) throw lErr;
      }

      setImportedCount(created?.length || 0);
      toast.success(`${created?.length || 0} processos importados com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });

      // Remove imported rows
      setRows(prev => prev.filter(r => !selected.has(r.rowIndex)));
      setSelected(new Set());
    } catch (err: any) {
      toast.error('Erro na importação: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const selectedReadyCount = rows.filter(r => selected.has(r.rowIndex) && r.status === 'ready' && r.tipo).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Importar Processos</h1>
        <p className="text-sm text-muted-foreground">Importe processos a partir de planilha Excel ou CSV</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              {isDragActive ? 'Solte o arquivo aqui...' : 'Arraste seu arquivo .xlsx ou .csv aqui'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
          </div>
          {fileName && (
            <Badge variant="secondary" className="gap-1.5">
              <FileSpreadsheet className="h-3 w-3" />
              {fileName}
            </Badge>
          )}
        </div>
      </div>

      {/* Import success */}
      {importedCount !== null && (
        <div className="rounded-lg bg-primary/10 border border-primary/20 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <p className="text-sm font-medium text-foreground">
            {importedCount} processo{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''} com sucesso!
          </p>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Preview ({stats.total} linhas)</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-primary flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {stats.ready} prontos
                </span>
                {stats.noClient > 0 && (
                  <span className="text-sm text-warning flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {stats.noClient} sem cliente
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={selectAllReady}>
                <Checkbox
                  checked={stats.ready > 0 && rows.filter(r => r.status === 'ready').every(r => selected.has(r.rowIndex))}
                  className="mr-2 pointer-events-none"
                />
                Selecionar todos prontos
              </Button>
              <Button
                size="sm"
                onClick={handleImport}
                disabled={importing || selectedReadyCount === 0}
              >
                {importing ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importando...</>
                ) : (
                  <>Importar {selectedReadyCount} Selecionados</>
                )}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Status</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Razão Social</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>UF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.rowIndex} className={r.status === 'no_client' ? 'opacity-60' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(r.rowIndex)}
                        onCheckedChange={() => toggleSelect(r.rowIndex)}
                        disabled={r.status === 'no_client' || !r.tipo}
                      />
                    </TableCell>
                    <TableCell>
                      {r.status === 'ready' ? (
                        <span className="text-primary flex items-center gap-1 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {r.clienteNome}
                        </span>
                      ) : (
                        <span className="text-warning flex items-center gap-1 text-xs font-medium">
                          <AlertTriangle className="h-3.5 w-3.5" /> ???
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.clienteNome || r.codigoCliente || r.nomeContabilidade || '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{r.razaoSocial}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.cnpj || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.tipoLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{r.uf || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
