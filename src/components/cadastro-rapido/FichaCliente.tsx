import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, User } from 'lucide-react';
import type { ClienteDB } from '@/types/financial';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  cliente: ClienteDB;
  processosNoMes: number;
  nextSlot: number;
}

export default function FichaCliente({ cliente, processosNoMes, nextSlot }: Props) {
  const valorBase = Number(cliente.valor_base ?? 0);
  const desconto = Number(cliente.desconto_progressivo ?? 0);
  const piso = cliente.valor_limite_desconto != null ? Number(cliente.valor_limite_desconto) : null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4 text-primary" />
          Ficha do Cliente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-semibold text-foreground">{cliente.apelido || cliente.nome}</p>
          {cliente.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {cliente.cnpj}</p>}
          <Badge variant="outline" className="mt-1 text-[10px]">
            {cliente.tipo === 'MENSALISTA' ? 'Mensalista' : 'Avulso'}
          </Badge>
        </div>

        {(cliente.telefone || cliente.email) && (
          <div className="text-xs text-muted-foreground space-y-0.5">
            {cliente.telefone && <p>📱 {cliente.telefone}</p>}
            {cliente.email && <p>✉️ {cliente.email}</p>}
          </div>
        )}

        <div className="h-px bg-border" />

        <div className="space-y-1 text-xs">
          <p className="font-medium text-muted-foreground">Configuração Financeira</p>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-muted-foreground">Valor Base:</span>
            <span className="font-medium">{fmt(valorBase)}</span>
            <span className="text-muted-foreground">Desc. Progr.:</span>
            <span className="font-medium">{desconto}%</span>
            {piso != null && (
              <>
                <span className="text-muted-foreground">Valor Piso:</span>
                <span className="font-medium">{fmt(piso)}</span>
              </>
            )}
            <span className="text-muted-foreground">Dia Cobrança:</span>
            <span className="font-medium">{cliente.dia_cobranca ?? 3} dias</span>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="text-xs space-y-1">
          <p>Processos este mês: <span className="font-bold text-foreground">{processosNoMes}</span></p>
          <p>Próximo slot: <span className="font-bold text-primary">{nextSlot}º</span>
            {desconto > 0 && <span className="text-muted-foreground"> ({desconto}% acumulado)</span>}
          </p>
        </div>

        <a
          href={`/clientes/${cliente.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          Editar Cliente <ExternalLink className="h-3 w-3" />
        </a>
      </CardContent>
    </Card>
  );
}
