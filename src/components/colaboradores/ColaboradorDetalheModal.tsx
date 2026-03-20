import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Copy, TrendingUp, Calendar, FileText, AlertCircle, Wallet } from 'lucide-react';
import type { Colaborador } from '@/hooks/useColaboradores';
import { useUpdateColaborador } from '@/hooks/useColaboradores';
import { useLancamentos } from '@/hooks/useFinanceiro';
import { calcularCustoMensal, getBusinessDaysInMonth } from '@/lib/business-days';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';
import { toast } from 'sonner';

interface Props {
  colab: Colaborador | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ColaboradorDetalheModal({ colab, open, onOpenChange }: Props) {
  const { data: allLancamentos } = useLancamentos('pagar');
  const update = useUpdateColaborador();
  const [ocorrencia, setOcorrencia] = useState({ data: '', tipo: 'falta', desconto: true, obs: '' });

  if (!colab) return null;

  const diasUteis = getBusinessDaysInMonth();
  const custoMensal = calcularCustoMensal(Number(colab.salario_base), Number(colab.vt_diario), Number(colab.vr_diario), diasUteis);
  const custoAnual = custoMensal * 12;
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const lancamentos = (allLancamentos || []).filter(l => (l as any).colaborador_id === colab.id);
  const totalPago = lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
  const totalPendente = lancamentos.filter(l => l.status === 'pendente').reduce((s, l) => s + Number(l.valor), 0);

  const copyPix = () => {
    if (colab.pix_chave) {
      navigator.clipboard.writeText(colab.pix_chave);
      toast.success('Chave PIX copiada!');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
              {colab.nome.charAt(0)}
            </div>
            <div>
              <span>{colab.nome}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className={colab.regime === 'CLT' ? 'border-info/40 text-info text-[10px]' : 'border-warning/40 text-warning text-[10px]'}>
                  {colab.regime}
                </Badge>
                <Badge className={`border-0 text-[10px] ${colab.status === 'ativo' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {colab.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="dashboard" className="mt-2">
          <TabsList className="w-full grid grid-cols-5 h-9">
            <TabsTrigger value="dashboard" className="text-xs">Dashboard</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
            <TabsTrigger value="gestao" className="text-xs">Gestão</TabsTrigger>
            <TabsTrigger value="ocorrencias" className="text-xs">Ocorrências</TabsTrigger>
            <TabsTrigger value="bancario" className="text-xs">Dados Bancários</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Mensal</p>
                  <p className="text-xl font-bold text-primary">{fmt(custoMensal)}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Sal + (VT+VR) × {diasUteis} dias</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Custo Anual Estimado</p>
                  <p className="text-xl font-bold text-foreground">{fmt(custoAnual)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Pago</p>
                  <p className="text-lg font-semibold text-success">{fmt(totalPago)}</p>
                </CardContent>
              </Card>
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Pendente</p>
                  <p className="text-lg font-semibold text-warning">{fmt(totalPendente)}</p>
                </CardContent>
              </Card>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">Salário Base</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.salario_base))}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">VT Diário</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.vt_diario))}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground">VR Diário</p>
                <p className="font-semibold text-foreground">{fmt(Number(colab.vr_diario))}</p>
              </div>
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="historico" className="mt-4">
            <div className="rounded-lg border border-border/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-foreground">Descrição</TableHead>
                    <TableHead className="text-foreground">Vencimento</TableHead>
                    <TableHead className="text-right text-foreground">Valor</TableHead>
                    <TableHead className="text-center text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum lançamento encontrado</TableCell>
                    </TableRow>
                  ) : lancamentos.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-foreground text-sm">{l.descricao}</TableCell>
                      <TableCell className="text-foreground text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium text-foreground">{fmt(Number(l.valor))}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                          {STATUS_LABELS[l.status as StatusFinanceiro]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Gestão Profissional */}
          <TabsContent value="gestao" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Aumento Previsto</p>
                </div>
                {colab.aumento_previsto_valor && Number(colab.aumento_previsto_valor) > 0 ? (
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-sm text-foreground">
                      Novo salário: <strong className="text-primary">{fmt(Number(colab.aumento_previsto_valor))}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Programado para: {colab.aumento_previsto_data || '—'}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhum aumento programado.</p>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Regime</p>
                    <p className="font-semibold text-foreground">{colab.regime}</p>
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Adiantamento</p>
                    <p className="font-semibold text-foreground">
                      {colab.adiantamento_tipo === 'percentual'
                        ? `${colab.adiantamento_valor}% do salário`
                        : fmt(Number(colab.adiantamento_valor))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {Number(colab.valor_das) > 0 && (
              <Card className="border-border/60">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Guia DAS (MEI)</p>
                  <p className="text-lg font-semibold text-foreground">{fmt(Number(colab.valor_das))}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Ocorrências */}
          <TabsContent value="ocorrencias" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <p className="text-sm font-semibold text-foreground">Registrar Ocorrência</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Data</Label>
                    <Input type="date" className="h-8" value={ocorrencia.data}
                      onChange={e => setOcorrencia(o => ({ ...o, data: e.target.value }))} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-foreground">Tipo</Label>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                      value={ocorrencia.tipo}
                      onChange={e => setOcorrencia(o => ({ ...o, tipo: e.target.value }))}
                    >
                      <option value="falta">Falta</option>
                      <option value="suspensao">Suspensão</option>
                      <option value="observacao">Observação</option>
                    </select>
                  </div>
                </div>
                {(ocorrencia.tipo === 'falta' || ocorrencia.tipo === 'suspensao') && (
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={ocorrencia.desconto}
                      onChange={e => setOcorrencia(o => ({ ...o, desconto: e.target.checked }))}
                      className="rounded" />
                    Descontar VT/VR deste dia
                  </label>
                )}
                <Textarea placeholder="Observações..." className="min-h-[60px]" value={ocorrencia.obs}
                  onChange={e => setOcorrencia(o => ({ ...o, obs: e.target.value }))} />
                <Button size="sm" variant="outline" onClick={() => {
                  toast.info('Ocorrência registrada (funcionalidade em expansão).');
                  setOcorrencia({ data: '', tipo: 'falta', desconto: true, obs: '' });
                }}>
                  Registrar
                </Button>
              </CardContent>
            </Card>
            <p className="text-xs text-muted-foreground text-center">
              Histórico de ocorrências será expandido em breve.
            </p>
          </TabsContent>

          {/* Dados Bancários */}
          <TabsContent value="bancario" className="space-y-4 mt-4">
            <Card className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Chave PIX</p>
                </div>
                {colab.pix_chave ? (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">{colab.pix_tipo?.toUpperCase() || 'CHAVE'}</p>
                      <p className="font-mono text-sm text-foreground">{colab.pix_chave}</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-7" onClick={copyPix}>
                      <Copy className="h-3 w-3 mr-1" /> Copiar
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma chave PIX cadastrada.</p>
                )}
                {colab.email && (
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm text-foreground">{colab.email}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
