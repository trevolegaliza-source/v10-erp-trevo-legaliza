import { useState } from 'react';
import { KANBAN_STAGES, PROCESS_TYPE_LABELS, type KanbanStage } from '@/types/process';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Filter, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProcessosDB, useUpdateProcessoEtapa, type ProcessoDB } from '@/hooks/useProcessos';
import { Skeleton } from '@/components/ui/skeleton';

function ProcessCard({ process }: { process: ProcessoDB }) {
  const clientName = process.cliente?.nome || 'Cliente';
  const typeLabel = PROCESS_TYPE_LABELS[process.tipo] || process.tipo;

  return (
    <div className="group rounded-lg border border-border/50 bg-card p-3 shadow-sm transition-shadow hover:shadow-md cursor-grab">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate leading-tight">{process.razao_social}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{clientName}</p>
        </div>
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
  );
}

export default function Processos() {
  const { data: processos, isLoading } = useProcessosDB();
  const [filterType, setFilterType] = useState<string>('all');

  const filtered = filterType === 'all'
    ? (processos || [])
    : (processos || []).filter((p) => p.tipo === filterType);

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
      ) : (
        <div className="overflow-x-auto scrollbar-thin pb-4 -mx-6 px-6">
          <div className="flex gap-3" style={{ minWidth: KANBAN_STAGES.length * 240 }}>
            {KANBAN_STAGES.map((stage) => {
              const stageProcesses = filtered.filter((p) => p.etapa === stage.key);
              return (
                <div key={stage.key} className="w-[230px] shrink-0 rounded-xl bg-muted/40 border border-border/40">
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
                    {stageProcesses.map((proc) => (
                      <ProcessCard key={proc.id} process={proc} />
                    ))}
                    {stageProcesses.length === 0 && (
                      <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/30">
                        <span className="text-[11px] text-muted-foreground/50">Vazio</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
