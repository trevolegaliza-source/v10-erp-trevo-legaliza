import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, CreditCard, Receipt } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const invoices = [
  { id: '1', client: 'Contabilidade Souza', description: 'Abertura - Padaria Trigo Bom', value: 1200, status: 'pago', due: '2025-03-15' },
  { id: '2', client: 'Escritório Lima', description: 'Alteração - Auto Peças JP', value: 850, status: 'pendente', due: '2025-03-20' },
  { id: '3', client: 'Contabilidade Master', description: 'Abertura - Farmácia Saúde Já + Reembolso', value: 1680, status: 'pendente', due: '2025-03-22' },
  { id: '4', client: 'ACR Contábil', description: 'Transformação - Clínica Bem Estar', value: 1500, status: 'pago', due: '2025-03-10' },
  { id: '5', client: 'Contabilidade Souza', description: 'Abertura - Gráfica Express Print', value: 1600, status: 'atrasado', due: '2025-03-05' },
  { id: '6', client: 'Escritório Lima', description: 'Baixa - Papelaria Criativa', value: 600, status: 'pago', due: '2025-02-28' },
];

const statusStyles: Record<string, string> = {
  pago: 'bg-success/10 text-success',
  pendente: 'bg-warning/10 text-warning',
  atrasado: 'bg-destructive/10 text-destructive',
};

export default function Financeiro() {
  const totalPaid = invoices.filter(i => i.status === 'pago').reduce((s, i) => s + i.value, 0);
  const totalPending = invoices.filter(i => i.status === 'pendente').reduce((s, i) => s + i.value, 0);
  const totalOverdue = invoices.filter(i => i.status === 'atrasado').reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Controladoria e faturamento</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Faturamento Total', value: totalPaid + totalPending + totalOverdue, icon: DollarSign, color: 'primary' },
          { label: 'Recebido', value: totalPaid, icon: TrendingUp, color: 'success' },
          { label: 'A Receber', value: totalPending, icon: CreditCard, color: 'warning' },
          { label: 'Em Atraso', value: totalOverdue, icon: Receipt, color: 'destructive' },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-5">
              <div className={`rounded-lg bg-${stat.color}/10 p-2 w-fit`}>
                <stat.icon className={`h-4.5 w-4.5 text-${stat.color}`} />
              </div>
              <p className="text-2xl font-bold mt-3">
                {stat.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="pendente">Pendentes</TabsTrigger>
          <TabsTrigger value="pago">Pagos</TabsTrigger>
          <TabsTrigger value="atrasado">Atrasados</TabsTrigger>
        </TabsList>

        {['all', 'pendente', 'pago', 'atrasado'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Lançamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices
                      .filter((i) => tab === 'all' || i.status === tab)
                      .map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.client}</TableCell>
                          <TableCell className="text-sm">{inv.description}</TableCell>
                          <TableCell className="text-sm">{new Date(inv.due).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right font-medium">
                            {inv.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={`${statusStyles[inv.status]} border-0 text-[10px]`}>
                              {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
