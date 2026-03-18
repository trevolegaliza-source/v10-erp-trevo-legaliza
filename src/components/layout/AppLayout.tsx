import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { NotificationPopover } from '@/components/NotificationPopover';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background dark">
      <AppSidebar />
      <div className="ml-60 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-card/80 glass px-6">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar processos, clientes..." className="pl-9 bg-muted/50 border-0" />
          </div>
          <div className="flex items-center gap-3">
            <NotificationPopover />
            <div className="flex items-center gap-2.5">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  ML
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col">
                <span className="text-sm font-medium">Master</span>
                <span className="text-[11px] text-muted-foreground">Administrador</span>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
