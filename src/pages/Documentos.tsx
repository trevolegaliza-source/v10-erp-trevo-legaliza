import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const documents = [
  { id: '1', process: 'Padaria Trigo Bom LTDA', type: 'RG', status: 'aprovado' },
  { id: '2', process: 'Padaria Trigo Bom LTDA', type: 'CPF', status: 'aprovado' },
  { id: '3', process: 'Padaria Trigo Bom LTDA', type: 'IPTU', status: 'pendente' },
  { id: '4', process: 'Tech Solutions ME', type: 'Contrato Social', status: 'aprovado' },
  { id: '5', process: 'Tech Solutions ME', type: 'RG', status: 'pendente' },
  { id: '6', process: 'Auto Peças JP LTDA', type: 'CPF', status: 'aprovado' },
  { id: '7', process: 'Auto Peças JP LTDA', type: 'IPTU', status: 'aprovado' },
  { id: '8', process: 'Restaurante Sabor Caseiro', type: 'RG', status: 'pendente' },
  { id: '9', process: 'Farmácia Saúde Já', type: 'Contrato Social', status: 'pendente' },
  { id: '10', process: 'Farmácia Saúde Já', type: 'Alvará Anterior', status: 'pendente' },
];

export default function Documentos() {
  const approved = documents.filter(d => d.status === 'aprovado').length;
  const pending = documents.filter(d => d.status === 'pendente').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documentos</h1>
          <p className="text-sm text-muted-foreground">Validação de anexos dos processos</p>
        </div>
        <Button size="sm" className="h-9"><Upload className="h-4 w-4 mr-1" />Upload</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5"><FileText className="h-5 w-5 text-primary" /></div>
            <div><p className="text-2xl font-bold">{documents.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2.5"><CheckCircle2 className="h-5 w-5 text-success" /></div>
            <div><p className="text-2xl font-bold">{approved}</p><p className="text-xs text-muted-foreground">Aprovados</p></div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="rounded-lg bg-warning/10 p-2.5"><AlertCircle className="h-5 w-5 text-warning" /></div>
            <div><p className="text-2xl font-bold">{pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-3"><CardTitle className="text-base">Todos os Documentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Tipo de Documento</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.process}</TableCell>
                  <TableCell>{doc.type}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={`border-0 text-[10px] ${doc.status === 'aprovado' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                      {doc.status === 'aprovado' ? 'Aprovado' : 'Pendente'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {doc.status === 'pendente' && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Aprovar
                      </Button>
                    )}
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
