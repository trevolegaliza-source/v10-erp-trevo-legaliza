import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export interface ValorFormData {
  metodoPreco: 'automatico' | 'manual';
  valorManual: string;
  motivoManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  jaPago: boolean;
  observacoes: string;
}

interface Props {
  form: ValorFormData;
  onChange: (form: ValorFormData) => void;
  isFirstProcess: boolean;
  isAvulso: boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function StepValor({ form, onChange, isFirstProcess, isAvulso, onBack, onNext }: Props) {
  const update = (field: keyof ValorFormData, value: any) => onChange({ ...form, [field]: value });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Configuração Financeira</h2>
        <p className="text-sm text-muted-foreground">Defina como o valor será calculado</p>
      </div>

      {!isAvulso && (
        <div className="space-y-2">
          <Label>Método de precificação</Label>
          <RadioGroup
            value={form.metodoPreco}
            onValueChange={v => update('metodoPreco', v as 'automatico' | 'manual')}
            className="flex gap-6"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="automatico" id="preco-auto" />
              <Label htmlFor="preco-auto" className="font-normal cursor-pointer">Automático (desconto progressivo)</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="manual" id="preco-manual" />
              <Label htmlFor="preco-manual" className="font-normal cursor-pointer">Valor Manual</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {(form.metodoPreco === 'manual' || isAvulso) && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={form.valorManual}
              onChange={e => update('valorManual', e.target.value)}
            />
          </div>
          {!isAvulso && (
            <div className="space-y-2">
              <Label>Motivo do valor manual</Label>
              <Input
                placeholder="Ex: Negociação especial, cortesia..."
                value={form.motivoManual}
                onChange={e => update('motivoManual', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {isFirstProcess && !isAvulso && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-success">🎁 Desconto de Boas-vindas</Label>
              <p className="text-[10px] text-muted-foreground mt-0.5">Primeiro processo deste cliente</p>
            </div>
            <Switch checked={form.boasVindas} onCheckedChange={v => update('boasVindas', v)} />
          </div>
          {form.boasVindas && (
            <div className="space-y-1">
              <Label className="text-xs">Percentual (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                className="w-32"
                value={form.boasVindasPct}
                onChange={e => update('boasVindasPct', e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div>
          <Label className="text-sm font-medium">Já foi pago/liquidado?</Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {form.jaPago ? 'Entrará direto como Honorário Pago' : 'Seguirá o fluxo normal de cobrança'}
          </p>
        </div>
        <Switch checked={form.jaPago} onCheckedChange={v => update('jaPago', v)} />
      </div>

      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          placeholder="Protocolo, detalhes, etc."
          value={form.observacoes}
          onChange={e => update('observacoes', e.target.value)}
          rows={3}
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={onNext} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
