import { useState } from 'react';
import { Bell, FileText, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'new_process' | 'overdue' | 'urgent';
  title: string;
  description: string;
  link: string;
  time: string;
}

export function NotificationPopover() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const items: Notification[] = [];
      const today = new Date().toISOString().split('T')[0];

      // Overdue lancamentos
      const { data: overdue } = await supabase
        .from('lancamentos')
        .select('id, descricao, data_vencimento, cliente:clientes(nome)')
        .eq('tipo', 'receber')
        .eq('status', 'pendente')
        .lt('data_vencimento', today)
        .limit(5);

      (overdue || []).forEach((l: any) => {
        items.push({
          id: `overdue-${l.id}`,
          type: 'overdue',
          title: 'Pagamento em Atraso',
          description: `${l.descricao} - ${l.cliente?.nome || 'Cliente'}`,
          link: '/contas-receber',
          time: new Date(l.data_vencimento).toLocaleDateString('pt-BR'),
        });
      });

      // Urgent processes
      const { data: urgent } = await supabase
        .from('processos')
        .select('id, razao_social, cliente:clientes(nome)')
        .eq('prioridade', 'urgente')
        .not('etapa', 'in', '("finalizados","arquivo")')
        .limit(5);

      (urgent || []).forEach((p: any) => {
        items.push({
          id: `urgent-${p.id}`,
          type: 'urgent',
          title: 'Processo Urgente',
          description: `${p.razao_social} - ${p.cliente?.nome || ''}`,
          link: '/processos',
          time: '',
        });
      });

      // Recent processes (last 24h)
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { data: recent } = await supabase
        .from('processos')
        .select('id, razao_social, created_at, cliente:clientes(nome)')
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(5);

      (recent || []).forEach((p: any) => {
        items.push({
          id: `new-${p.id}`,
          type: 'new_process',
          title: 'Novo Processo',
          description: `${p.razao_social} - ${p.cliente?.nome || ''}`,
          link: '/processos',
          time: new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      });

      return items;
    },
    refetchInterval: 30000,
  });

  const iconMap = {
    new_process: FileText,
    overdue: AlertTriangle,
    urgent: Clock,
  };

  const colorMap = {
    new_process: 'text-info',
    overdue: 'text-destructive',
    urgent: 'text-warning',
  };

  const bgMap = {
    new_process: 'bg-info/10',
    overdue: 'bg-destructive/10',
    urgent: 'bg-warning/10',
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4.5 w-4.5" />
          {notifications.length > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 h-4.5 min-w-[18px] rounded-full px-1 text-[10px] bg-destructive text-destructive-foreground border-0">
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b">
          <h4 className="text-sm font-semibold">Notificações</h4>
          <p className="text-xs text-muted-foreground">{notifications.length} alertas ativos</p>
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const Icon = iconMap[n.type];
                return (
                  <button
                    key={n.id}
                    className="flex items-start gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      navigate(n.link);
                      setOpen(false);
                    }}
                  >
                    <div className={`rounded-lg p-1.5 mt-0.5 ${bgMap[n.type]}`}>
                      <Icon className={`h-3.5 w-3.5 ${colorMap[n.type]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{n.description}</p>
                      {n.time && <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 mt-1 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
