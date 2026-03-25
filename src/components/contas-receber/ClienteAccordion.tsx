import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Phone, Building2 } from 'lucide-react';
import type { LancamentoReceber, ValorAdicionalSimple } from '@/hooks/useContasReceber';
import { diasAtraso } from '@/hooks/useContasReceber';

interface ClienteGroup {
  clienteId: string;
  clienteNome: string;
  lancamentos: LancamentoReceber[];
}

interface Props {
  groups: ClienteGroup[];
  taxasPorProcesso: Record<string, ValorAdicionalSimple[]>;
  onMarcarPago: (l: LancamentoReceber) => void;
  onCobrar: (l: LancamentoReceber) => void;
}

function StatusBadge({ status, dataVencimento }: { status: string; dataVencimento: string }) {
  const dias = diasAtraso(dataVencimento, status);
  if (status === 'pago') return <Badge className="bg-success/15 text-success border-0 text-[10px]">Pago ✅</Badge>;
  if (dias > 0) return <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">Vencido 🔴</Badge>;
  return <Badge className="bg-warning/15 text-warning border-0 text-[10px]">Pendente ⏳</Badge>;
}

function DiasAtrasoBadge({ dataVencimento, status }: { dataVencimento: string; status: string }) {
  if (status === 'pago') return <span className="text-xs text-muted-foreground">—</span>;
  const dias = diasAtraso(dataVencimento, status);
  if (dias === 0) return <span className="text-xs text-success">em dia</span>;
  return <span className="text-xs text-destructive font-medium">-{dias}d</span>;
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ClienteAccordion({ groups, taxasPorProcesso, onMarcarPago, onCobrar }: Props) {
  // Sort: vencidos first, then pendentes, then pagos
  const sorted = [...groups].sort((a, b) => {
    const hoje = new Date().toISOString().split('T')[0];
    const aVencido = a.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    const bVencido = b.lancamentos.some(l => l.status === 'pendente' && l.data_vencimento < hoje);
    if (aVencido && !bVencido) return -1;
    if (!aVencido && bVencido) return 1;
    const aPendente = a.lancamentos.some(l => l.status === 'pendente');
    const bPendente = b.lancamentos.some(l => l.status === 'pendente');
    if (aPendente && !bPendente) return -1;
    if (!aPendente && bPendente) return 1;
    return a.clienteNome.localeCompare(b.clienteNome);
  });

  return (
    <Accordion type="multiple" className="space-y-2">
      {sorted.map(g => {
        const hoje = new Date().toISOString().split('T')[0];
        const faturado = g.lancamentos.reduce((s, l) => s + Number(l.valor), 0);
        const recebido = g.lancamentos.filter(l => l.status === 'pago').reduce((s, l) => s + Number(l.valor), 0);
        const saldo = faturado - recebido;
        const vencidos = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento < hoje);
        const pendentes = g.lancamentos.filter(l => l.status === 'pendente' && l.data_vencimento >= hoje);
        const hasVencido = vencidos.length > 0;
        const hasPendente = pendentes.length > 0;
        const borderColor = hasVencido ? 'border-l-destructive' : hasPendente ? 'border-l-warning' : 'border-l-success';

        return (
          <AccordionItem key={g.clienteId} value={g.clienteId} className={`border rounded-lg overflow-hidden border-l-4 ${borderColor}`}>
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex-1 text-left space-y-1">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-sm">{g.clienteNome}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Faturado: {fmt(faturado)}</span>
                  <span>Recebido: {fmt(recebido)}</span>
                  <span>Saldo: {fmt(saldo)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {hasVencido && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">{vencidos.length} vencido{vencidos.length > 1 ? 's' : ''} ({fmt(vencidos.reduce((s, l) => s + Number(l.valor), 0))})</Badge>}
                  {hasPendente && <Badge className="bg-warning/15 text-warning border-0 text-[10px]">{pendentes.length} pendente{pendentes.length > 1 ? 's' : ''}</Badge>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Taxas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead className="text-center">Atraso</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {g.lancamentos.map(l => {
                    const taxas = l.processo_id ? (taxasPorProcesso[l.processo_id] || []) : [];
                    const taxaTotal = taxas.reduce((s, t) => s + Number(t.valor), 0);
                    const total = Number(l.valor) + taxaTotal;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{l.descricao}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(Number(l.valor))}</TableCell>
                        <TableCell className="text-right text-sm">{taxaTotal > 0 ? fmt(taxaTotal) : '-'}</TableCell>
                        <TableCell className="text-right font-medium text-sm text-primary">{fmt(total)}</TableCell>
                        <TableCell className="text-sm">{new Date(l.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-center"><DiasAtrasoBadge dataVencimento={l.data_vencimento} status={l.status} /></TableCell>
                        <TableCell className="text-center"><StatusBadge status={l.status} dataVencimento={l.data_vencimento} /></TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {l.status === 'pendente' && (
                              <>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-success" onClick={() => onMarcarPago(l)}>
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-warning" onClick={() => onCobrar(l)}>
                                  <Phone className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
                <span>Subtotal {g.clienteNome}</span>
                <span>Faturado {fmt(faturado)} | Recebido {fmt(recebido)} | Em Aberto {fmt(saldo)}</span>
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
