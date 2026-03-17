import { useState, useCallback } from 'react';
import { KANBAN_STAGES, PROCESS_TYPE_LABELS, type KanbanStage } from '@/types/process';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Filter, GripVertical, LayoutGrid, List, MoreHorizontal, Receipt, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useProcessosDB, useUpdateProcessoEtapa, useDeleteProcesso, type ProcessoDB } from '@/hooks/useProcessos';
import { Skeleton } from '@/components/ui/skeleton';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { toast } from 'sonner';

type ViewMode = 'kanban' | 'list';

function QuickActionsMenu({ process, onDelete }: { process: ProcessoDB; onDelete: (id: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => toast.info('Adicionar honorário extra')}>
          <Receipt className="h-3.5 w-3.5 mr-2" /> Honorário Extra
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => toast.info('Processo ocultado')}>
          <EyeOff className="h-3.5 w-3.5 mr-2" /> Ocultar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(process.id)} className="text-destructive">
          <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProcessCard({ process, index, onDelete }: { process: ProcessoDB; index: number; onDelete: (id: string) => void }) {
  const clientName = process.cliente?.nome || 'Cliente';
  const typeLabel = PROCESS_TYPE_LABELS[process.tipo] || process.tipo;

  return (
    <Draggable draggableId={process.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "group rounded-lg border border-border/50 bg-card p-3 shadow-sm transition-shadow hover:shadow-md",
            snapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold truncate leading-tight">{process.razao_social}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName}</p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <QuickActionsMenu process={process} onDelete={onDelete} />
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] border-primary/30 text-primary font-medium">
              {typeLabel}
            </Badge>
            {process.prioridade === 'urgente' && (
              <Badge className="text-[9px] px-1.5 py-0 h-[18px] bg-destructive/10 text-destructive border-0 font-medium">
                Urgente
              </Badge>
            )}
          </div>
          {process.responsavel && (
            <div className="mt-2 flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-[9px] font-semibold text-primary">{process.responsavel[0]}</span>
              </div>
              <span className="text-[11px] text-muted-foreground">{process.responsavel}</span>
            </div>
          )}
          {process.valor && (
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {Number(process.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          )}
        </div>
      )}
    </Draggable>
  );
}

export default function Processos() {
  const { data: processos, isLoading } = useProcessosDB();
  const updateEtapa = useUpdateProcessoEtapa();
  const deleteProcesso = useDeleteProcesso();
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [contextMenuProc, setContextMenuProc] = useState<ProcessoDB | null>(null);

  const handleDelete = useCallback((id: string) => {
    deleteProcesso.mutate(id);
  }, [deleteProcesso]);

  const filtered = filterType === 'all'
    ? (processos || [])
    : (processos || []).filter((p) => p.tipo === filterType);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    const newEtapa = result.destination.droppableId as KanbanStage;
    const procId = result.draggableId;
    updateEtapa.mutate({ id: procId, etapa: newEtapa });
  }, [updateEtapa]);

  const handleListDblClick = (proc: ProcessoDB) => {
    setContextMenuProc(proc);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processos</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? '...' : `${filtered.length} processos no pipeline`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-border/60 p-0.5">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" /> Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode('list')}
            >
              <List className="h-3.5 w-3.5 mr-1" /> Lista
            </Button>
          </div>

          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <Filter className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue placeholder="Filtrar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="abertura">Abertura</SelectItem>
              <SelectItem value="alteracao">Alteração</SelectItem>
              <SelectItem value="transformacao">Transformação</SelectItem>
              <SelectItem value="baixa">Baixa</SelectItem>
              <SelectItem value="avulso">Avulso</SelectItem>
              <SelectItem value="orcamento">Orçamento</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-9" asChild>
            <a href="/cadastro-rapido">
              <Plus className="h-4 w-4 mr-1" />
              Novo Processo
            </a>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="w-[230px] h-[300px] shrink-0 rounded-xl" />
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        /* ── KANBAN VIEW with Drag & Drop ── */
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto scrollbar-thin pb-4 -mx-6 px-6">
            <div className="flex gap-3" style={{ minWidth: KANBAN_STAGES.length * 240 }}>
              {KANBAN_STAGES.map((stage) => {
                const stageProcesses = filtered.filter((p) => p.etapa === stage.key);
                return (
                  <Droppable droppableId={stage.key} key={stage.key}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "w-[230px] shrink-0 rounded-xl bg-muted/40 border border-border/40 transition-colors",
                          snapshot.isDraggingOver && "border-primary/40 bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/30">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold">{stage.label}</span>
                            <span className={cn(
                              "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                              stageProcesses.length > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {stageProcesses.length}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2 p-2 min-h-[120px]">
                          {stageProcesses.map((proc, idx) => (
                            <ProcessCard key={proc.id} process={proc} index={idx} onDelete={handleDelete} />
                          ))}
                          {provided.placeholder}
                          {stageProcesses.length === 0 && (
                            <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/30">
                              <span className="text-[11px] text-muted-foreground/50">Vazio</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </DragDropContext>
      ) : (
        /* ── LIST VIEW ── */
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Razão Social</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((proc) => (
                <TableRow
                  key={proc.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onDoubleClick={() => handleListDblClick(proc)}
                >
                  <TableCell className="font-medium">{proc.razao_social}</TableCell>
                  <TableCell className="text-sm">{proc.cliente?.nome || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                      {PROCESS_TYPE_LABELS[proc.tipo] || proc.tipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{KANBAN_STAGES.find(s => s.key === proc.etapa)?.label || proc.etapa}</TableCell>
                  <TableCell>
                    {proc.prioridade === 'urgente' ? (
                      <Badge className="text-[10px] bg-destructive/10 text-destructive border-0">Urgente</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Normal</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {proc.valor ? Number(proc.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    <QuickActionsMenu process={proc} />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum processo encontrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-[11px] text-muted-foreground px-4 py-2 border-t border-border/30">
            💡 Dê um duplo-clique em qualquer linha para ações rápidas
          </p>
        </div>
      )}
    </div>
  );
}
