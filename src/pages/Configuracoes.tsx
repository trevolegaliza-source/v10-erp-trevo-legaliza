import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Webhook, DollarSign } from 'lucide-react';

export default function Configuracoes() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
      </div>

      {/* Pricing Tiers */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4 text-primary" />Tiered Pricing</CardTitle>
          <CardDescription>Valores por competência mensal (quanto mais processos, menor o valor unitário)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { range: '1-5 processos', value: 'R$ 1.200' },
            { range: '6-10 processos', value: 'R$ 1.050' },
            { range: '11-20 processos', value: 'R$ 900' },
            { range: '21+ processos', value: 'R$ 750' },
          ].map((tier) => (
            <div key={tier.range} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
              <span className="text-sm">{tier.range}</span>
              <div className="flex items-center gap-2">
                <Input defaultValue={tier.value} className="w-28 h-8 text-sm text-right" />
                <span className="text-xs text-muted-foreground">/proc</span>
              </div>
            </div>
          ))}
          <Button size="sm" className="mt-2">Salvar Preços</Button>
        </CardContent>
      </Card>

      {/* RBAC */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Controle de Acesso (RBAC)</CardTitle>
          <CardDescription>Níveis de acesso do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { role: 'Master', desc: 'Acesso total a finanças e configurações', color: 'bg-destructive/10 text-destructive' },
            { role: 'Colaborador', desc: 'Gestão operacional do Kanban e anexos', color: 'bg-info/10 text-info' },
            { role: 'Cliente', desc: 'Visualiza apenas seus processos e relatórios', color: 'bg-success/10 text-success' },
          ].map((item) => (
            <div key={item.role} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <Badge className={`${item.color} border-0`}>{item.role}</Badge>
                <span className="text-sm text-muted-foreground">{item.desc}</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Webhooks */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4 text-primary" />Integração n8n (Webhooks)</CardTitle>
          <CardDescription>Endpoints para recebimento de dados externos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <Label>Webhook URL (Novo Processo)</Label>
            <Input placeholder="https://seu-n8n.com/webhook/novo-processo" />
          </div>
          <div className="grid gap-2">
            <Label>Webhook URL (Atualização QSA)</Label>
            <Input placeholder="https://seu-n8n.com/webhook/atualizar-qsa" />
          </div>
          <Button size="sm" className="mt-2">Salvar Webhooks</Button>
        </CardContent>
      </Card>

      {/* Users */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />Usuários</CardTitle>
        </CardHeader>
        <CardContent>
          <Button size="sm"><Users className="h-4 w-4 mr-1" />Gerenciar Usuários</Button>
        </CardContent>
      </Card>
    </div>
  );
}
