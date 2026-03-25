import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { useCreateCliente } from '@/hooks/useFinanceiro';
import { maskCNPJ, isValidCNPJ } from '@/lib/cnpj';
import { toast } from 'sonner';
import type { TipoCliente } from '@/types/financial';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function NovoClienteInline({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    codigo_identificador: `CLI-${Date.now()}`,
    nome: '',
    cnpj: '',
    email: '',
    telefone: '',
    tipo: 'AVULSO_4D' as TipoCliente,
    valor_base: '',
    desconto_progressivo: '',
  });
  const createCliente = useCreateCliente();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && !isValidCNPJ(form.cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }

    createCliente.mutate(
      {
        codigo_identificador: cnpjDigits.slice(0, 6) || '000000',
        nome: form.nome,
        cnpj: cnpjDigits || null,
        tipo: form.tipo,
        email: form.email || null,
        telefone: form.telefone || null,
        valor_base: form.valor_base ? Number(form.valor_base) : null,
        desconto_progressivo: form.desconto_progressivo ? Number(form.desconto_progressivo) : null,
      } as any,
      {
        onSuccess: (data: any) => {
          const id = data?.id || data?.[0]?.id;
          if (id) onCreated(id);
        },
      }
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm">Novo Cliente (Rápido)</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da contabilidade" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: maskCNPJ(e.target.value) }))} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoCliente }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                  <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Base (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desc. Progressivo (%)</Label>
              <Input type="number" step="0.1" value={form.desconto_progressivo} onChange={e => setForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
            </div>
          </div>
          <Button type="submit" size="sm" disabled={createCliente.isPending} className="w-fit">
            {createCliente.isPending ? 'Criando...' : 'Cadastrar e Selecionar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
