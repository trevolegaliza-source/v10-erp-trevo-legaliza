import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { DollarSign, TrendingUp, CreditCard, Receipt, Search, CheckCircle } from 'lucide-react';
import { useLancamentos, useUpdateLancamento, useClientes } from '@/hooks/useFinanceiro';
import { STATUS_LABELS, STATUS_STYLES } from '@/types/financial';
import type { StatusFinanceiro } from '@/types/financial';

export default function ContasReceber() {
  const { data: lancamentos, isLoading } = useLancamentos('receber');
  const updateLancamento = useUpdateLancamento();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = (lancamentos || []).filter(l => {
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    if (search && !l.descricao.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalByStatus = (status: StatusFinanceiro) =>
    (lancamentos || []).filter(l => l.status === status).reduce((s, l) => s + Number(l.valor), 0);

  const totalGeral = (lancamentos || []).reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contas a Receber</h1>
          <p className="text-sm text-muted-foreground">{(lancamentos || []).length} lançamentos</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Total', value: totalGeral, icon: DollarSign, color: 'primary' },
          { label: 'Recebido', value: totalByStatus('pago'), icon: TrendingUp, color: 'success' },
          { label: 'Pendente', value: totalByStatus('pendente'), icon: CreditCard, color: 'warning' },
          { label: 'Atrasado', value: totalByStatus('atrasado'), icon: Receipt, color: 'destructive' },
        ].map(stat => (
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

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar lançamento..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="pago">Pago</SelectItem>
            <SelectItem value="atrasado">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Taxa Reemb.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(l => {
                  const taxa = l.is_taxa_reembolsavel ? Number(l.valor) : 0;
                  const valorBase = Number(l.valor);
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {l.descricao}
                          {l.is_taxa_reembolsavel && (
                            <Badge className="bg-info/10 text-info border-0 text-[10px]">Reembolsável</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{(l as any).cliente?.nome || '-'}</TableCell>
                      <TableCell className="text-sm">{new Date(l.data_vencimento).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium">
                        {valorBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {taxa > 0
                          ? taxa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {(valorBase + (l.is_taxa_reembolsavel ? 0 : taxa)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`${STATUS_STYLES[l.status as StatusFinanceiro]} border-0 text-[10px]`}>
                          {STATUS_LABELS[l.status as StatusFinanceiro]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {l.status === 'pendente' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-success hover:text-success"
                            onClick={() => updateLancamento.mutate({ id: l.id, status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })}
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Confirmar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum lançamento encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        💡 Taxas reembolsáveis agora são adicionadas individualmente na edição de cada processo.
      </p>
    </div>
  );
}
