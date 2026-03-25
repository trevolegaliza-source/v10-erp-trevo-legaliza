import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X } from 'lucide-react';
import { useCreateCliente } from '@/hooks/useFinanceiro';
import { maskCNPJ, isValidCNPJ } from '@/lib/cnpj';
import { toast } from 'sonner';
import type { TipoCliente } from '@/types/financial';
import { UFS_BRASIL } from '@/constants/estados-brasil';

interface Props {
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function NovoClienteInline({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    codigo_identificador: '',
    nome: '',
    apelido: '',
    cnpj: '',
    nome_contador: '',
    email: '',
    telefone: '',
    tipo: 'AVULSO_4D' as TipoCliente,
    valor_base: '',
    desconto_progressivo: '',
    valor_limite_desconto: '',
    observacoes: '',
    estado: '',
    cidade: '',
  });
  const [codigoManual, setCodigoManual] = useState(false);
  const createCliente = useCreateCliente();

  const handleCnpjChange = (value: string) => {
    const masked = maskCNPJ(value);
    const digits = masked.replace(/\D/g, '');
    const newCodigo = !codigoManual && digits.length >= 6
      ? `${digits.slice(0, 3)}.${digits.slice(3, 6)}`
      : !codigoManual ? digits.slice(0, digits.length) : form.codigo_identificador;
    setForm(f => ({ ...f, cnpj: masked, codigo_identificador: newCodigo }));
  };

  const handleCodigoChange = (value: string) => {
    setCodigoManual(true);
    setForm(f => ({ ...f, codigo_identificador: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cnpjDigits = form.cnpj.replace(/\D/g, '');
    if (cnpjDigits.length > 0 && !isValidCNPJ(form.cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }
    if (!form.codigo_identificador.trim()) {
      toast.error('Preencha o Código do Cliente (ou digite o CNPJ)');
      return;
    }

    createCliente.mutate(
      {
        codigo_identificador: form.codigo_identificador.trim(),
        nome: form.nome,
        apelido: form.apelido || null,
        cnpj: cnpjDigits || null,
        nome_contador: form.nome_contador || null,
        tipo: form.tipo,
        email: form.email || null,
        telefone: form.telefone || null,
        valor_base: form.valor_base ? Number(form.valor_base) : null,
        desconto_progressivo: form.desconto_progressivo ? Number(form.desconto_progressivo) : null,
        valor_limite_desconto: form.valor_limite_desconto ? Number(form.valor_limite_desconto) : null,
        observacoes: form.observacoes || null,
        estado: form.estado || null,
        cidade: form.cidade || null,
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
          {/* Nome + Apelido */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input required value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome da contabilidade" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Apelido</Label>
              <Input value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} placeholder="Ex: Athena" />
            </div>
          </div>

          {/* CNPJ + Código */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CNPJ</Label>
              <Input value={form.cnpj} onChange={e => handleCnpjChange(e.target.value)} placeholder="00.000.000/0000-00" maxLength={18} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Código do Cliente *</Label>
              <Input required value={form.codigo_identificador} onChange={e => handleCodigoChange(e.target.value)} placeholder="Preencha o CNPJ" />
            </div>
          </div>

          {/* Nome do Contador */}
          <div className="space-y-1">
            <Label className="text-xs">Nome do Contador</Label>
            <Input value={form.nome_contador} onChange={e => setForm(f => ({ ...f, nome_contador: e.target.value }))} placeholder="Nome do contador responsável" />
          </div>

          {/* Email + Telefone */}
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

          {/* Estado + Cidade */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Estado (UF)</Label>
              <Select value={form.estado} onValueChange={v => setForm(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {UFS_BRASIL.map(uf => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} placeholder="Ex: São Paulo" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as TipoCliente }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AVULSO_4D">Avulso</SelectItem>
                  <SelectItem value="MENSALISTA">Mensalista</SelectItem>
                  <SelectItem value="PRE_PAGO">Pré-Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor Base (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_base} onChange={e => setForm(f => ({ ...f, valor_base: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desc. Progr. (%)</Label>
              <Input type="number" step="0.1" value={form.desconto_progressivo} onChange={e => setForm(f => ({ ...f, desconto_progressivo: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Limite/Piso (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_limite_desconto} onChange={e => setForm(f => ({ ...f, valor_limite_desconto: e.target.value }))} />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Notas sobre o cliente..." />
          </div>

          <Button type="submit" size="sm" disabled={createCliente.isPending} className="w-fit">
            {createCliente.isPending ? 'Criando...' : 'Cadastrar e Selecionar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
