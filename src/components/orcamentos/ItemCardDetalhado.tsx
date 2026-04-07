import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { type OrcamentoItem, type OrcamentoSecao } from './types';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  item: OrcamentoItem;
  idx: number;
  secoes: OrcamentoSecao[];
  onChange: (idx: number, field: keyof OrcamentoItem, value: any) => void;
  onRemove: (idx: number) => void;
  onAddSecao: () => void;
}

export function ItemCardDetalhado({ item, idx, secoes, onChange, onRemove, onAddSecao }: Props) {
  const totalMin = item.honorario * item.quantidade + item.taxa_min;
  const totalMax = item.honorario * item.quantidade + item.taxa_max;

  return (
    <div className="p-4 rounded-lg border bg-card space-y-3">
      {/* Top row: seção + ordem */}
      <div className="flex gap-3 items-end">
        <div className="w-48">
          <Label className="text-xs">Seção</Label>
          <Select value={item.secao} onValueChange={v => {
            if (v === '__new__') { onAddSecao(); return; }
            onChange(idx, 'secao', v);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {secoes.map(s => (
                <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
              ))}
              <SelectItem value="__new__">+ Nova Seção</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-20">
          <Label className="text-xs">Ordem</Label>
          <Input
            type="number"
            value={item.ordem || ''}
            onChange={e => onChange(idx, 'ordem', parseInt(e.target.value) || 0)}
            min={1}
            className="text-center"
          />
        </div>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => onRemove(idx)} className="text-destructive shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Serviço */}
      <div>
        <Label className="text-xs">Serviço *</Label>
        <Input
          value={item.descricao}
          onChange={e => onChange(idx, 'descricao', e.target.value)}
          placeholder="Ex: Licença Bombeiros (CBMSC)"
          className="font-medium"
        />
      </div>

      {/* Detalhes */}
      <div>
        <Label className="text-xs">Detalhes / Escopo</Label>
        <Textarea
          value={item.detalhes}
          onChange={e => onChange(idx, 'detalhes', e.target.value)}
          placeholder="Inclui adequações, questionário, vistorias..."
          rows={2}
          className="text-sm"
        />
      </div>

      {/* Valores */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Honorário R$</Label>
          <Input
            type="number"
            value={item.honorario || ''}
            onChange={e => onChange(idx, 'honorario', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Taxa Min R$</Label>
          <Input
            type="number"
            value={item.taxa_min || ''}
            onChange={e => onChange(idx, 'taxa_min', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
        <div>
          <Label className="text-xs">Taxa Max R$</Label>
          <Input
            type="number"
            value={item.taxa_max || ''}
            onChange={e => onChange(idx, 'taxa_max', parseFloat(e.target.value) || 0)}
            placeholder="0,00"
            className="text-right"
          />
        </div>
      </div>

      {/* Prazo + Docs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Prazo</Label>
          <Input
            value={item.prazo}
            onChange={e => onChange(idx, 'prazo', e.target.value)}
            placeholder="15-45 dias"
          />
        </div>
        <div>
          <Label className="text-xs">Docs Necessários</Label>
          <Input
            value={item.docs_necessarios}
            onChange={e => onChange(idx, 'docs_necessarios', e.target.value)}
            placeholder="CNPJ, planta, ART..."
          />
        </div>
      </div>

      {/* Subtotal */}
      <div className="text-right text-sm">
        <span className="font-bold text-primary">
          Honorário: {fmt(item.honorario * item.quantidade)}
        </span>
        {(item.taxa_min > 0 || item.taxa_max > 0) && (
          <span className="text-muted-foreground ml-3">
            Taxas: {fmt(item.taxa_min)} a {fmt(item.taxa_max)}
          </span>
        )}
        {(item.taxa_min > 0 || item.taxa_max > 0) && (
          <span className="ml-3 font-semibold">
            Total: {fmt(totalMin)} a {fmt(totalMax)}
          </span>
        )}
      </div>
    </div>
  );
}
