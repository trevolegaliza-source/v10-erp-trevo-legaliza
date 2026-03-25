import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import type { ClienteDB } from '@/types/financial';
import { calcularDescontoProgressivo } from '@/hooks/useFinanceiro';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  cliente: ClienteDB;
  processosNoMes: number;
  filaLength: number;
  prioridade: 'normal' | 'urgente';
  metodoPreco: 'automatico' | 'manual';
  valorManual: string;
  boasVindas: boolean;
  boasVindasPct: string;
  mudancaUF: boolean;
  isAvulso: boolean;
}

export interface PreviewResult {
  valorFinal: number;
  slotNumero: number;
  descontoAplicado: number;
}

export function calcPreview(props: Props): PreviewResult {
  const { cliente, processosNoMes, filaLength, prioridade, metodoPreco, valorManual, boasVindas, boasVindasPct, mudancaUF, isAvulso } = props;

  if (isAvulso || metodoPreco === 'manual') {
    return {
      valorFinal: Number(valorManual) || 0,
      slotNumero: processosNoMes + filaLength + 1,
      descontoAplicado: 0,
    };
  }

  const valorBase = Number(cliente.valor_base ?? 0);
  const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
  const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;
  const slotOffset = processosNoMes + filaLength;

  if (mudancaUF && descontoPercent > 0) {
    const calc1 = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset, valorLimite);
    const calc2 = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset + 1, valorLimite);
    let total = calc1.valorFinal + calc2.valorFinal;
    if (prioridade === 'urgente') total *= 1.5;
    if (boasVindas) total *= (1 - Number(boasVindasPct) / 100);
    return { valorFinal: Math.round(total * 100) / 100, slotNumero: calc1.processoNumero, descontoAplicado: calc1.descontoAcumulado + calc2.descontoAcumulado };
  }

  const calc = calcularDescontoProgressivo(valorBase, descontoPercent, slotOffset, valorLimite);
  let final = mudancaUF ? calc.valorFinal * 2 : calc.valorFinal;
  if (prioridade === 'urgente') final *= 1.5;
  if (boasVindas) final *= (1 - Number(boasVindasPct) / 100);

  return {
    valorFinal: Math.round(final * 100) / 100,
    slotNumero: calc.processoNumero,
    descontoAplicado: calc.descontoAcumulado,
  };
}

export default function PreviewFinanceiro(props: Props) {
  const { cliente, processosNoMes, filaLength, prioridade, mudancaUF, boasVindas, boasVindasPct, isAvulso, metodoPreco } = props;
  const preview = calcPreview(props);
  const valorBase = Number(cliente.valor_base ?? 0);
  const isManual = metodoPreco === 'manual' || isAvulso;

  // Build progression line
  const descontoPercent = Number(cliente.desconto_progressivo ?? 0);
  const valorLimite = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;
  const progression: { slot: number; valor: number }[] = [];
  if (!isManual && descontoPercent > 0) {
    for (let i = 0; i <= processosNoMes + filaLength; i++) {
      const c = calcularDescontoProgressivo(valorBase, descontoPercent, i, valorLimite);
      progression.push({ slot: c.processoNumero, valor: c.valorFinal });
    }
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          Preview Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!isManual && (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Base</span>
              <span>{fmt(valorBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slot nº</span>
              <span className="font-bold text-primary">{preview.slotNumero}º</span>
            </div>
            {preview.descontoAplicado > 0 && (
              <div className="flex justify-between text-info">
                <span>Desc. Progressivo</span>
                <span>-{fmt(preview.descontoAplicado)}</span>
              </div>
            )}
          </>
        )}

        {prioridade === 'urgente' && (
          <div className="flex justify-between text-warning">
            <span>Urgência (+50%)</span>
            <span>incluído</span>
          </div>
        )}
        {mudancaUF && (
          <div className="flex justify-between text-warning">
            <span>Mudança de UF (2 slots)</span>
            <span>incluído</span>
          </div>
        )}
        {boasVindas && (
          <div className="flex justify-between text-success">
            <span>Boas-vindas (-{boasVindasPct}%)</span>
            <span>incluído</span>
          </div>
        )}

        <div className="h-px bg-border" />

        <div className="flex justify-between text-base font-bold">
          <span>VALOR FINAL</span>
          <span className="text-primary">{fmt(preview.valorFinal)}</span>
        </div>

        {progression.length > 1 && (
          <div className="pt-2">
            <p className="text-[10px] text-muted-foreground mb-1">Progressão:</p>
            <div className="flex flex-wrap gap-1">
              {progression.map((p, i) => (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    i === progression.length - 1
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {p.slot}º {fmt(p.valor)}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
