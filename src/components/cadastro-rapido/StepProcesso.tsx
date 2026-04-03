import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { TIPO_PROCESSO_LABELS, type TipoProcesso } from '@/types/financial';
import type { ServiceNegotiation } from '@/hooks/useServiceNegotiations';

export interface ProcessoFormData {
  razaoSocial: string;
  tipo: string;
  responsavel: string;
  prioridade: 'normal' | 'urgente';
  mudancaUF: boolean;
  descricaoAvulso: string;
  dataEntrada: string;
  dentroDoPlano: boolean;
  valorAvulso: number;
  justificativaAvulso: string;
}

interface Props {
  form: ProcessoFormData;
  onChange: (form: ProcessoFormData) => void;
  negotiations: ServiceNegotiation[];
  colaboradores: { id: string; nome: string }[];
  clienteTipo?: string;
  onBack: () => void;
  onNext: () => void;
}

export default function StepProcesso({ form, onChange, negotiations, colaboradores, onBack, onNext }: Props) {
  const update = (field: keyof ProcessoFormData, value: any) => onChange({ ...form, [field]: value });
  const isAvulso = form.tipo === 'avulso';
  const isNeg = negotiations?.find(n => n.id === form.tipo);
  const canAdvance = form.razaoSocial.trim() && form.tipo && (!isAvulso || form.descricaoAvulso.trim());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Dados do Processo</h2>
        <p className="text-sm text-muted-foreground">Informações sobre o serviço a ser realizado</p>
      </div>

      <div className="space-y-2">
        <Label>Razão Social *</Label>
        <Input
          required
          placeholder="Nome da empresa"
          value={form.razaoSocial}
          onChange={e => update('razaoSocial', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Tipo de Processo *</Label>
        <Select
          value={form.tipo}
          onValueChange={v => {
            const neg = negotiations?.find(n => n.id === v);
            if (neg) {
              onChange({ ...form, tipo: v, descricaoAvulso: '' });
            } else {
              onChange({ ...form, tipo: v as TipoProcesso, descricaoAvulso: v === 'avulso' ? form.descricaoAvulso : '' });
            }
          }}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_PROCESSO_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
            {negotiations && negotiations.length > 0 && (
              <>
                <SelectItem disabled value="__header_neg" className="text-[10px] font-semibold text-muted-foreground">— Serviços Negociados —</SelectItem>
                {negotiations.map(n => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.service_name} — {Number(n.fixed_price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {isAvulso && (
        <div className="space-y-2">
          <Label>Descrição do Serviço Avulso *</Label>
          <Input
            placeholder="Ex: Inscrição Municipal, Certidão Negativa..."
            value={form.descricaoAvulso}
            onChange={e => update('descricaoAvulso', e.target.value)}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>Responsável</Label>
        <Select value={form.responsavel || '__none__'} onValueChange={v => update('responsavel', v === '__none__' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Selecionar (opcional)" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nenhum</SelectItem>
            {colaboradores.map(c => (
              <SelectItem key={c.id} value={c.nome}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Prioridade</Label>
        <RadioGroup
          value={form.prioridade}
          onValueChange={v => update('prioridade', v as 'normal' | 'urgente')}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="normal" id="prio-normal" />
            <Label htmlFor="prio-normal" className="font-normal cursor-pointer">Normal</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="urgente" id="prio-urgente" />
            <Label htmlFor="prio-urgente" className="font-normal cursor-pointer text-warning">Urgente (+50%)</Label>
          </div>
        </RadioGroup>
      </div>

      {(form.tipo === 'alteracao' || isNeg) && !isAvulso && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3">
          <Checkbox
            id="mudanca-uf"
            checked={form.mudancaUF}
            onCheckedChange={checked => update('mudancaUF', !!checked)}
          />
          <div>
            <Label htmlFor="mudanca-uf" className="text-sm cursor-pointer">Mudança de UF (2 slots)</Label>
            <p className="text-[10px] text-muted-foreground">Será tratado como 2 processos para faturamento</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Data de Entrada do Processo</Label>
        <Input
          type="date"
          value={form.dataEntrada}
          onChange={e => update('dataEntrada', e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">
          Padrão: hoje. Altere para cadastrar processos retroativos.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Button onClick={onNext} disabled={!canAdvance} className="gap-2">
          Próximo <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
