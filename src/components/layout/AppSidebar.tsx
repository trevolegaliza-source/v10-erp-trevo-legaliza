import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Kanban,
  Users,
  DollarSign,
  FileText,
  Settings,
  Clover,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut,
  UsersRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/cadastro-rapido', label: 'Cadastro Rápido', icon: PlusCircle },
  { path: '/processos', label: 'Processos', icon: Kanban },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign },
  { path: '/contas-receber', label: 'Contas a Receber', icon: ArrowDownCircle },
  { path: '/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle },
  { path: '/colaboradores', label: 'Colaboradores', icon: UsersRound },
  { path: '/documentos', label: 'Documentos', icon: FileText },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar/80 glass text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary neon-pulse">
          <Clover className="h-5 w-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">Trevo Legaliza 🍀</span>
            <span className="text-[10px] text-sidebar-foreground/60">Controladoria & Gestão</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/20 text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5 shrink-0 transition-all', isActive && 'icon-glow text-primary')} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User & Actions */}
      <div className="border-t border-sidebar-border p-2 space-y-1">
        {!collapsed && user && (
          <p className="text-[10px] text-sidebar-foreground/50 px-3 truncate">{user.email}</p>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start gap-2 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-xs">Sair</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
