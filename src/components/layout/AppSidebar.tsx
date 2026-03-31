import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Kanban, Users, DollarSign, FileText, Settings,
  ChevronLeft, ChevronRight, PlusCircle, ArrowUpCircle, LogOut, UsersRound, Receipt, MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebarCounts } from '@/hooks/useSidebarCounts';
import { usePermissions } from '@/hooks/usePermissions';
import logoTrevo from '@/assets/logo-trevo.png';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard, badgeKey: null, modulo: 'dashboard' },
  { path: '/cadastro-rapido', label: 'Cadastro Rápido', icon: PlusCircle, badgeKey: null, modulo: 'processos' },
  { path: '/processos', label: 'Processos', icon: Kanban, badgeKey: 'processosAtivos' as const, modulo: 'processos' },
  { path: '/clientes', label: 'Clientes', icon: Users, badgeKey: null, modulo: 'clientes' },
  { path: '/orcamentos', label: 'Orçamentos', icon: Receipt, badgeKey: 'orcamentosPendentes' as const, modulo: 'orcamentos' },
  { path: '/financeiro', label: 'Financeiro', icon: DollarSign, badgeKey: 'pendentesFinanceiro' as const, modulo: 'financeiro' },
  { path: '/contas-pagar', label: 'Contas a Pagar', icon: ArrowUpCircle, badgeKey: null, modulo: 'contas_pagar' },
  { path: '/colaboradores', label: 'Colaboradores', icon: UsersRound, badgeKey: null, modulo: 'colaboradores' },
  { path: '/documentos', label: 'Documentos', icon: FileText, badgeKey: 'docsPendentes' as const, modulo: 'documentos' },
  { path: '/inteligencia-geografica', label: 'Intel. Geográfica', icon: MapPin, badgeKey: null, modulo: 'intel_geografica' },
  { path: '/configuracoes', label: 'Configurações', icon: Settings, badgeKey: null, modulo: 'configuracoes' },
];

type BadgeVariant = 'default' | 'warning' | 'info';

const badgeVariants: Record<string, BadgeVariant> = {
  processosAtivos: 'default',
  orcamentosPendentes: 'info',
  pendentesFinanceiro: 'warning',
  docsPendentes: 'info',
};

const badgeColors: Record<BadgeVariant, string> = {
  default: 'bg-muted text-muted-foreground',
  warning: 'bg-amber-500/20 text-amber-500',
  info: 'bg-blue-500/20 text-blue-500',
};

export function AppSidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { signOut, user } = useAuth();
  const { data: counts } = useSidebarCounts();
  const { podeVer, loading: permsLoading } = usePermissions();

  const visibleItems = navItems.filter(item => podeVer(item.modulo));

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-sidebar-border bg-sidebar/80 glass text-sidebar-foreground transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-3">
        <img
          src={logoTrevo}
          alt="Trevo Legaliza"
          className={cn('shrink-0 logo-pulse transition-all', collapsed ? 'h-9 w-9 object-contain' : 'h-10 w-auto')}
        />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight truncate">Trevo Legaliza</span>
            <span className="text-[10px] text-sidebar-foreground/60">Controladoria & Gestão</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4 overflow-y-auto scrollbar-thin">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const badgeCount = item.badgeKey && counts ? counts[item.badgeKey] : 0;
          const variant = item.badgeKey ? badgeVariants[item.badgeKey] : 'default';

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'sidebar-item-active'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className={cn('h-4.5 w-4.5 shrink-0 transition-all', isActive && 'icon-glow text-primary')} />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeCount > 0 && (
                    <span className={cn(
                      'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                      badgeColors[variant]
                    )}>
                      {badgeCount}
                    </span>
                  )}
                </>
              )}
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
