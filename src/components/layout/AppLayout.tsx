import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { Search, Moon, Sun } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NotificationPopover } from '@/components/NotificationPopover';
import { CommandPalette } from '@/components/CommandPalette';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme } from 'next-themes';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9 relative"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const { role } = usePermissions();
  const [profileName, setProfileName] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('nome').eq('id', user.id).single().then(({ data }) => {
      if (data?.nome) setProfileName(data.nome);
    });
  }, [user]);
  const displayName = profileName || (user?.email
    ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1).replace(/[._-]/g, ' ')
    : 'Usuário');

  const initials = (displayName || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const roleLabel = role === 'master' ? 'Administrador' : role === 'financeiro' ? 'Financeiro' : role === 'operacional' ? 'Operacional' : role === 'visualizador' ? 'Visualizador' : '';

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <CommandPalette />
      <div className="ml-60 flex min-h-screen flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-sm px-4">
          <div
            className="relative w-72 cursor-pointer"
            onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <div className="pl-9 h-9 bg-muted/50 rounded-md flex items-center text-sm text-muted-foreground">
              Buscar processos, clientes...
            </div>
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border hidden md:inline">
              ⌘K
            </kbd>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationPopover />
            <div className="flex items-center gap-2 ml-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:flex flex-col">
                <span className="text-xs font-medium leading-none">{displayName}</span>
                <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
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