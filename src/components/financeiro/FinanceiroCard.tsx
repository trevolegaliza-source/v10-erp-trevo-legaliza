import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Paperclip, ExternalLink } from 'lucide-react';
import type { EtapaFinanceiro } from '@/types/financial';
import type { ProcessoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { useUpdateLancamentoFinanceiro } from '@/hooks/useProcessosFinanceiro';
import { cn } from '@/lib/utils';

interface FinanceiroCardProps {
  processo: ProcessoFinanceiro;
  onMoveRequest: (processo: ProcessoFinanceiro, targetEtapa: EtapaFinanceiro) => void;
}

export default function FinanceiroCard({ processo, onMoveRequest }: FinanceiroCardProps) {
  const updateLanc = useUpdateLancamentoFinanceiro();
  const lanc = processo.lancamento;

  const [extraValue, setExtraValue] = useState(String(lanc?.honorario_extra || 0));
  const [notes, setNotes] = useState(lanc?.observacoes_financeiro || '');

  const isOverdue = processo.etapa_financeiro === 'honorario_vencido';
  const baseValue = Number(lanc?.valor ?? processo.valor ?? 0);
  const extraNum = Number(lanc?.honorario_extra || 0);
  const totalValue = baseValue + extraNum;
  const clienteApelido = (processo.cliente as any)?.apelido || (processo.cliente as any)?.nome || '-';
  const vencimento = lanc?.data_vencimento;

  const mutateField = (updates: Record<string, any>) => {
    updateLanc.mutate({
      processoId: processo.id,
      lancamentoId: lanc?.id,
      clienteId: processo.cliente_id,
      valor: baseValue,
      updates,
    });
  };

  const handleExtraBlur = () => {
    const parsed = parseFloat(extraValue.replace(',', '.')) || 0;
    if (parsed !== extraNum) {
      mutateField({ honorario_extra: parsed });
    }
  };

  const handleCheckbox = (field: string, checked: boolean) => {
    mutateField({ [field]: checked });
  };

  const handleNotesBlur = () => {
    if (notes !== (lanc?.observacoes_financeiro || '')) {
      mutateField({ observacoes_financeiro: notes });
    }
  };

  const nextEtapaMap: Partial<Record<EtapaFinanceiro, EtapaFinanceiro>> = {
    solicitacao_criada: 'gerar_cobranca',
    gerar_cobranca: 'cobranca_gerada',
    cobranca_gerada: 'honorario_pago',
  };

  const nextEtapa = nextEtapaMap[processo.etapa_financeiro];
  const nextLabels: Record<string, string> = {
    gerar_cobranca: 'Gerar Cobrança →',
    cobranca_gerada: 'Cobrança Gerada →',
    honorario_pago: 'Marcar Pago ✓',
  };

  return (
    <Card className={cn(
      'border-l-4 transition-shadow hover:shadow-md',
      isOverdue ? 'border-l-destructive bg-destructive/5' : 'border-l-border',
    )}>
      <CardContent className="p-3 space-y-2.5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <p className="text-sm font-semibold truncate">{clienteApelido}</p>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{processo.razao_social}</p>
          </div>
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        {/* Due date */}
        {vencimento && (
          <Badge variant="outline" className={cn('text-[10px]', isOverdue && 'border-destructive text-destructive')}>
            Venc: {new Date(vencimento).toLocaleDateString('pt-BR')}
          </Badge>
        )}

        {/* Honorário Extra */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-muted-foreground whitespace-nowrap">Hon. Extra:</label>
          <Input
            type="text"
            value={extraValue}
            onChange={(e) => setExtraValue(e.target.value)}
            onBlur={handleExtraBlur}
            className="h-7 text-xs w-24"
            placeholder="0,00"
          />
        </div>

        {/* Checkboxes */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`enc-${processo.id}`}
              checked={!!lanc?.cobranca_encaminhada}
              onCheckedChange={(c) => handleCheckbox('cobranca_encaminhada', !!c)}
            />
            <label htmlFor={`enc-${processo.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Cobrança encaminhada ao cliente
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`rec-${processo.id}`}
              checked={!!lanc?.confirmado_recebimento}
              onCheckedChange={(c) => handleCheckbox('confirmado_recebimento', !!c)}
            />
            <label htmlFor={`rec-${processo.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Confirmado recebimento
            </label>
          </div>
        </div>

        {/* Attachment */}
        <div className="flex items-center gap-2">
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          {lanc?.boleto_url ? (
            <a href={lanc.boleto_url} target="_blank" rel="noreferrer" className="text-[11px] text-info underline flex items-center gap-1">
              Ver Boleto <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">Sem anexo</span>
          )}
        </div>

        {/* Notes */}
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          placeholder="Observações..."
          className="text-[11px] min-h-[40px] resize-none"
          rows={2}
        />

        {/* Move button */}
        {nextEtapa && (
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs h-7"
            onClick={() => onMoveRequest(processo, nextEtapa)}
          >
            {nextLabels[nextEtapa] || 'Avançar →'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
