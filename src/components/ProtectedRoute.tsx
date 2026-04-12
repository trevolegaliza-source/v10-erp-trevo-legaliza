import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Login from '@/pages/Login';
import { Loader2, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoTrevo from '@/assets/logo-trevo.png';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ativo' | 'inativo' | 'sem_profile'>('loading');

  useEffect(() => {
    if (!session?.user) {
      setProfileStatus('loading');
      return;
    }

    const check = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('ativo')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!profile) {
        setProfileStatus('sem_profile');
      } else if (profile.ativo === false) {
        setProfileStatus('inativo');
      } else {
        setProfileStatus('ativo');
      }
    };

    check();

    // Poll every 10s to check if approved
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [session?.user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (profileStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profileStatus === 'inativo' || profileStatus === 'sem_profile') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center max-w-md space-y-6">
          <img src={logoTrevo} alt="Trevo Legaliza" className="h-16 mx-auto" />
          <div className="space-y-2">
            <Clock className="h-12 w-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Aguardando Aprovação</h2>
            <p className="text-sm text-muted-foreground">
              Seu acesso foi solicitado com sucesso! O administrador será notificado e aprovará seu acesso em breve.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Logado como: {session.user.email}
            </p>
            <p className="text-xs text-muted-foreground/60">
              Esta página atualiza automaticamente. Quando seu acesso for aprovado, o sistema carregará.
            </p>
          </div>
          <Button variant="outline" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
