import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { calcularCustoMensal, calcularAdiantamento } from '@/lib/business-days';

export interface ColaboradorFormData {
  nome: string;
  email: string;
  regime: 'CLT' | 'PJ';
  salario_base: string;
  vt_diario: string;
  vr_diario: string;
  status: 'ativo' | 'inativo';
  adiantamento_tipo: 'percentual' | 'fixo';
  adiantamento_valor: string;
  pix_tipo: string;
  pix_chave: string;
  valor_das: string;
  aumento_previsto_valor: string;
  aumento_previsto_data: string;
}

export const EMPTY_FORM: ColaboradorFormData = {
  nome: '', email: '', regime: 'CLT', salario_base: '', vt_diario: '', vr_diario: '',
  status: 'ativo', adiantamento_tipo: 'percentual', adiantamento_valor: '',
  pix_tipo: '', pix_chave: '', valor_das: '',
  aumento_previsto_valor: '', aumento_previsto_data: '',
};

interface Props {
  form: ColaboradorFormData;
  setForm: React.Dispatch<React.SetStateAction<ColaboradorFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
  isEdit: boolean;
  diasUteis: number;
}

export default function ColaboradorForm({ form, setForm, onSubmit, isPending, isEdit, diasUteis }: Props) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const sal = Number(form.salario_base) || 0;
  const vt = Number(form.vt_diario) || 0;
  const vr = Number(form.vr_diario) || 0;
  const custoMensal = calcularCustoMensal(sal, vt, vr, diasUteis);
  const adiantamento = calcularAdiantamento(sal, form.adiantamento_tipo, Number(form.adiantamento_valor) || 0);

  return (
    <form onSubmit={onSubmit} className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
      <div className="grid gap-2">
        <Label className="text-foreground">Nome *</Label>
        <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
      </div>
      <div className="grid gap-2">
        <Label className="text-foreground">Email</Label>
        <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label className="text-foreground">Regime</Label>
          <Select value={form.regime} onValueChange={v => setForm(f => ({ ...f, regime: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CLT">CLT</SelectItem>
              <SelectItem value="PJ">PJ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground">Status</Label>
          <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-2">
          <Label className="text-foreground">Salário Base (R$)</Label>
          <Input type="number" step="0.01" min="0" value={form.salario_base} onChange={e => setForm(f => ({ ...f, salario_base: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground">VT Diário (R$)</Label>
          <Input type="number" step="0.01" min="0" value={form.vt_diario} onChange={e => setForm(f => ({ ...f, vt_diario: e.target.value }))} />
        </div>
        <div className="grid gap-2">
          <Label className="text-foreground">VR Diário (R$)</Label>
          <Input type="number" step="0.01" min="0" value={form.vr_diario} onChange={e => setForm(f => ({ ...f, vr_diario: e.target.value }))} />
        </div>
      </div>

      {/* Adiantamento */}
      <div className="rounded-lg border border-border/60 p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Adiantamento (Dia 20)</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Tipo</Label>
            <Select value={form.adiantamento_tipo} onValueChange={v => setForm(f => ({ ...f, adiantamento_tipo: v as any }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percentual">% do Salário</SelectItem>
                <SelectItem value="fixo">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">{form.adiantamento_tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
            <Input className="h-8" type="number" step="0.01" min="0" value={form.adiantamento_valor}
              onChange={e => setForm(f => ({ ...f, adiantamento_valor: e.target.value }))} />
          </div>
        </div>
        {adiantamento > 0 && (
          <p className="text-xs text-primary">Valor do adiantamento: {fmt(adiantamento)}</p>
        )}
      </div>

      {/* PIX */}
      <div className="rounded-lg border border-border/60 p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Dados PIX</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Tipo de Chave</Label>
            <Select value={form.pix_tipo || 'nenhum'} onValueChange={v => setForm(f => ({ ...f, pix_tipo: v === 'nenhum' ? '' : v }))}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="cpf">CPF</SelectItem>
                <SelectItem value="cnpj">CNPJ</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="telefone">Telefone</SelectItem>
                <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Chave PIX</Label>
            <Input className="h-8" value={form.pix_chave} onChange={e => setForm(f => ({ ...f, pix_chave: e.target.value }))}
              placeholder="Insira a chave PIX" />
          </div>
        </div>
      </div>

      {/* DAS (MEI) */}
      <div className="grid gap-2">
        <Label className="text-foreground">Guia DAS / MEI (R$)</Label>
        <Input type="number" step="0.01" min="0" value={form.valor_das}
          onChange={e => setForm(f => ({ ...f, valor_das: e.target.value }))} placeholder="0.00" />
      </div>

      {/* Aumento Previsto */}
      <div className="rounded-lg border border-border/60 p-3 space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Aumento Previsto</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Novo Salário (R$)</Label>
            <Input className="h-8" type="number" step="0.01" min="0" value={form.aumento_previsto_valor}
              onChange={e => setForm(f => ({ ...f, aumento_previsto_valor: e.target.value }))}
              placeholder="0.00" />
          </div>
          <div className="grid gap-2">
            <Label className="text-xs text-foreground">Mês/Ano (YYYY-MM)</Label>
            <Input className="h-8" type="month" value={form.aumento_previsto_data}
              onChange={e => setForm(f => ({ ...f, aumento_previsto_data: e.target.value }))} />
          </div>
        </div>
        {Number(form.aumento_previsto_valor) > 0 && form.aumento_previsto_data && (
          <p className="text-xs text-primary">
            Salário será atualizado para {fmt(Number(form.aumento_previsto_valor))} em {form.aumento_previsto_data}
          </p>
        )}
      </div>

      {/* Live cost preview */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <p className="text-xs text-muted-foreground mb-1">Custo Mensal Estimado ({diasUteis} dias úteis)</p>
        <p className="text-xl font-bold text-primary">{fmt(custoMensal)}</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Salário + (VT + VR) × {diasUteis} dias úteis
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isEdit ? 'Salvar' : 'Cadastrar'}
      </Button>
    </form>
  );
}
