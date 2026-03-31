import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, Users, Webhook, DollarSign, UserCog, Loader2, CheckCircle2, Palette, Sun, Moon, Monitor } from 'lucide-react';
import GestaoUsuarios from '@/components/configuracoes/GestaoUsuarios';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';

export default function Configuracoes() {
  const { theme, setTheme } = useTheme();
  const [webhookNovo, setWebhookNovo] = useState('');
  const [webhookQsa, setWebhookQsa] = useState('');
  const [savingWebhooks, setSavingWebhooks] = useState(false);

  useEffect(() => {
    const loadWebhooks = async () => {
      const { data } = await supabase.from('webhook_configs').select('key, url') as any;
      if (data) {
        for (const row of data) {
          if (row.key === 'novo_processo') setWebhookNovo(row.url);
          if (row.key === 'atualizar_qsa') setWebhookQsa(row.url);
        }
      }
    };
    loadWebhooks();
  }, []);

  const handleSaveWebhooks = async () => {
    setSavingWebhooks(true);
    try {
      for (const { key, url } of [
        { key: 'novo_processo', url: webhookNovo },
        { key: 'atualizar_qsa', url: webhookQsa },
      ]) {
        if (!url.trim()) continue;
        const { data: existing } = await supabase.from('webhook_configs').select('id').eq('key', key).single() as any;
        if (existing) {
          await supabase.from('webhook_configs').update({ url: url.trim(), updated_at: new Date().toISOString() } as any).eq('key', key);
        } else {
          await supabase.from('webhook_configs').insert({ key, url: url.trim() } as any);
        }
      }
      toast.success('Webhooks salvos com sucesso!');
    } catch (e: any) {
      toast.error('Erro ao salvar: ' + e.message);
    } finally {
      setSavingWebhooks(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerenciamento do sistema</p>
      </div>

      <Tabs defaultValue="aparencia">
        <TabsList>
          <TabsTrigger value="aparencia" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Aparência</TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" />Preços</TabsTrigger>
          <TabsTrigger value="rbac" className="gap-1.5"><Shield className="h-3.5 w-3.5" />RBAC</TabsTrigger>
          <TabsTrigger value="colaboradores" className="gap-1.5"><UserCog className="h-3.5 w-3.5" />Colaboradores</TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-1.5"><Webhook className="h-3.5 w-3.5" />Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="aparencia">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Palette className="h-4 w-4 text-primary" />Aparência</CardTitle>
              <CardDescription>Tema e personalização visual do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tema do Sistema</Label>
                <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-3 gap-3">
                  <Label
                    htmlFor="theme-light"
                    className="flex flex-col items-center gap-2 rounded-lg border-2 border-border/40 p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="light" id="theme-light" className="sr-only" />
                    <Sun className="h-6 w-6 text-warning" />
                    <span className="text-sm font-medium">Claro</span>
                  </Label>
                  <Label
                    htmlFor="theme-dark"
                    className="flex flex-col items-center gap-2 rounded-lg border-2 border-border/40 p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
                    <Moon className="h-6 w-6 text-info" />
                    <span className="text-sm font-medium">Escuro</span>
                  </Label>
                  <Label
                    htmlFor="theme-system"
                    className="flex flex-col items-center gap-2 rounded-lg border-2 border-border/40 p-4 cursor-pointer hover:bg-muted/50 transition-colors [&:has(:checked)]:border-primary [&:has(:checked)]:bg-primary/5"
                  >
                    <RadioGroupItem value="system" id="theme-system" className="sr-only" />
                    <Monitor className="h-6 w-6 text-muted-foreground" />
                    <span className="text-sm font-medium">Automático</span>
                  </Label>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">O tema automático segue a preferência do seu sistema operacional.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4 text-primary" />Tiered Pricing</CardTitle>
              <CardDescription>Valores por competência mensal. Prioridade aplica ×1.5 automaticamente.</CardDescription>
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
              <p className="text-xs text-muted-foreground">Fórmula: Valor_Final = (Valor_Base × 1.5) + Σ Reembolsos (quando urgente)</p>
              <Button size="sm" className="mt-2">Salvar Preços</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rbac">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-primary" />Controle de Acesso (RBAC)</CardTitle>
              <CardDescription>Níveis de acesso do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { role: 'Master', desc: 'Acesso total a finanças, configurações e logs', color: 'bg-destructive/10 text-destructive' },
                { role: 'Colaborador', desc: 'Gestão operacional do Kanban e anexos', color: 'bg-info/10 text-info' },
                { role: 'Financeiro', desc: 'Acesso a contas a pagar/receber e relatórios', color: 'bg-warning/10 text-warning' },
                { role: 'Operacional', desc: 'Visualização e movimentação de processos', color: 'bg-primary/10 text-primary' },
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
        </TabsContent>

        <TabsContent value="colaboradores">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4 text-primary" />Colaboradores</CardTitle>
              <CardDescription>Gerencie funcionários e permissões</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { name: 'Ana Silva', role: 'Operacional', email: 'ana@trevo.com' },
                  { name: 'Carlos Oliveira', role: 'Financeiro', email: 'carlos@trevo.com' },
                  { name: 'Bruno Santos', role: 'Operacional', email: 'bruno@trevo.com' },
                ].map((colab) => (
                  <div key={colab.email} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{colab.name}</p>
                      <p className="text-xs text-muted-foreground">{colab.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{colab.role}</Badge>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">Editar</Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button size="sm"><Users className="h-4 w-4 mr-1" />Adicionar Colaborador</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Webhook className="h-4 w-4 text-primary" />Integração n8n (Webhooks)</CardTitle>
              <CardDescription>Endpoints para recebimento de dados externos. URLs são salvas automaticamente no banco.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label>Webhook URL (Novo Processo)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/novo-processo"
                  value={webhookNovo}
                  onChange={(e) => setWebhookNovo(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Webhook URL (Atualização QSA)</Label>
                <Input
                  placeholder="https://seu-n8n.com/webhook/atualizar-qsa"
                  value={webhookQsa}
                  onChange={(e) => setWebhookQsa(e.target.value)}
                />
              </div>
              <Button size="sm" className="mt-2" onClick={handleSaveWebhooks} disabled={savingWebhooks}>
                {savingWebhooks ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                Salvar Webhooks
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
