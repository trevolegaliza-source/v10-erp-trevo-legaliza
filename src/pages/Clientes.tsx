import { mockClients } from '@/data/mock-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Users, Mail, Phone } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function Clientes() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">{mockClients.length} contabilidades cadastradas</p>
        </div>
        <Button size="sm" className="h-9">
          <Plus className="h-4 w-4 mr-1" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{mockClients.length}</p><p className="text-xs text-muted-foreground">Total de Clientes</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-info/10 p-2.5"><Users className="h-5 w-5 text-info" /></div>
            <div><p className="text-2xl font-bold">{mockClients.filter(c => c.type === 'mensalista').length}</p><p className="text-xs text-muted-foreground">Mensalistas</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><Users className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{mockClients.filter(c => c.type === 'avulso').length}</p><p className="text-xs text-muted-foreground">Avulsos</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Listagem de Clientes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-center">Processos</TableHead>
                <TableHead className="text-center">Ativos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockClients.map((client) => (
                <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={client.type === 'mensalista' ? 'border-primary/30 text-primary' : 'border-warning/30 text-warning'}>
                      {client.type === 'mensalista' ? 'Mensalista' : 'Avulso'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs"><Mail className="h-3 w-3 text-muted-foreground" />{client.email}</div>
                      <div className="flex items-center gap-1.5 text-xs"><Phone className="h-3 w-3 text-muted-foreground" />{client.phone}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{client.total_processes}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-primary/10 text-primary border-0">{client.active_processes}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
