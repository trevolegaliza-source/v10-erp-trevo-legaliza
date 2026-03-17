import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Paperclip, ExternalLink } from 'lucide-react';
import type { Lancamento, EtapaFinanceiro } from '@/types/financial';
import { useUpdateLancamento } from '@/hooks/useFinanceiro';
import { cn } from '@/lib/utils';

interface FinanceiroCardProps {
  lancamento: Lancamento;
  onMoveRequest: (lancamento: Lancamento, targetEtapa: EtapaFinanceiro) => void;
}

export default function FinanceiroCard({ lancamento, onMoveRequest }: FinanceiroCardProps) {
  const updateLancamento = useUpdateLancamento();
  const [extraValue, setExtraValue] = useState(String(lancamento.honorario_extra || 0));
  const [notes, setNotes] = useState(lancamento.observacoes_financeiro || '');

  const isOverdue = lancamento.etapa_financeiro === 'honorario_vencido';
  const totalValue = Number(lancamento.valor) + Number(lancamento.honorario_extra || 0);
  const clienteApelido = (lancamento as any).cliente?.apelido || (lancamento as any).cliente?.nome || '-';

  const handleExtraBlur = () => {
    const parsed = parseFloat(extraValue.replace(',', '.')) || 0;
    if (parsed !== Number(lancamento.honorario_extra || 0)) {
      updateLancamento.mutate({ id: lancamento.id, honorario_extra: parsed } as any);
    }
  };

  const handleCheckbox = (field: 'cobranca_encaminhada' | 'confirmado_recebimento', checked: boolean) => {
    updateLancamento.mutate({ id: lancamento.id, [field]: checked } as any);
  };

  const handleNotesBlur = () => {
    if (notes !== (lancamento.observacoes_financeiro || '')) {
      updateLancamento.mutate({ id: lancamento.id, observacoes_financeiro: notes } as any);
    }
  };

  const nextEtapaMap: Partial<Record<EtapaFinanceiro, EtapaFinanceiro>> = {
    solicitacao_criada: 'gerar_cobranca',
    gerar_cobranca: 'cobranca_gerada',
    cobranca_gerada: 'honorario_pago',
  };

  const nextEtapa = nextEtapaMap[lancamento.etapa_financeiro as EtapaFinanceiro];

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
        {/* Header: apelido + value */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <p className="text-sm font-semibold truncate">{clienteApelido}</p>
            </div>
            <p className="text-[11px] text-muted-foreground truncate">{lancamento.descricao}</p>
          </div>
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        {/* Due date */}
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn('text-[10px]', isOverdue && 'border-destructive text-destructive')}>
            Venc: {new Date(lancamento.data_vencimento).toLocaleDateString('pt-BR')}
          </Badge>
        </div>

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
              id={`enc-${lancamento.id}`}
              checked={lancamento.cobranca_encaminhada}
              onCheckedChange={(c) => handleCheckbox('cobranca_encaminhada', !!c)}
            />
            <label htmlFor={`enc-${lancamento.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Cobrança encaminhada ao cliente
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`rec-${lancamento.id}`}
              checked={lancamento.confirmado_recebimento}
              onCheckedChange={(c) => handleCheckbox('confirmado_recebimento', !!c)}
            />
            <label htmlFor={`rec-${lancamento.id}`} className="text-[11px] text-muted-foreground cursor-pointer">
              Confirmado recebimento
            </label>
          </div>
        </div>

        {/* Attachment */}
        <div className="flex items-center gap-2">
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          {lancamento.boleto_url ? (
            <a href={lancamento.boleto_url} target="_blank" rel="noreferrer" className="text-[11px] text-info underline flex items-center gap-1">
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
            onClick={() => onMoveRequest(lancamento, nextEtapa)}
          >
            {nextLabels[nextEtapa] || 'Avançar →'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
