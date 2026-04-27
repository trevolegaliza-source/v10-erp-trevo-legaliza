import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Login from '@/pages/Login';
import { MfaChallenge } from '@/components/auth/MfaChallenge';
import { MfaEnroll } from '@/components/auth/MfaEnroll';
import { Loader2, Clock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoTrevo from '@/assets/logo-trevo.png';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, signOut } = useAuth();
  const [profileStatus, setProfileStatus] = useState<'loading' | 'ativo' | 'inativo' | 'sem_profile'>('loading');
  const [mfaStatus, setMfaStatus] = useState<'loading' | 'none' | 'needs_verify' | 'needs_enroll' | 'verified'>('loading');
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setProfileStatus('loading');
      setMfaStatus('loading');
      return;
    }

    // audit fix #7 — race condition removida via flag de cancelamento.
    // Antes: setInterval(check, 10000) deixava callback em voo após unmount,
    // permitindo render brevíssimo do child com auth stale.
    let cancelled = false;

    const check = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('ativo, role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile) {
        setProfileStatus('sem_profile');
      } else if (profile.ativo === false) {
        setProfileStatus('inativo');
      } else {
        setProfileStatus('ativo');
        setUserRole(profile.role);
      }

      // Check MFA status
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      const totpFactors = factors?.totp || [];
      const verifiedFactors = totpFactors.filter((f: any) => f.status === 'verified');

      if (verifiedFactors.length > 0) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        if (aal?.currentLevel === 'aal2') {
          setMfaStatus('verified');
        } else {
          setMfaStatus('needs_verify');
        }
      } else if (profile?.role === 'master' && profile?.ativo !== false) {
        setMfaStatus('needs_enroll');
      } else {
        setMfaStatus('none');
      }
    };

    check();

    // audit fix #8 — refetch via Realtime quando perfil muda no banco (admin
    // aprovou usuário, mudou role, etc). Antes: precisava F5 manual ou aguardar
    // setInterval(10s). Agora: instantâneo.
    const channel = supabase
      .channel(`profile-watch-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${session.user.id}`,
        },
        () => {
          if (!cancelled) check();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
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

  if (profileStatus === 'loading' || mfaStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // MFA challenge needed
  if (mfaStatus === 'needs_verify') {
    return (
      <MfaChallenge
        onVerified={() => setMfaStatus('verified')}
        onCancel={signOut}
      />
    );
  }

  // Master needs to enroll MFA
  if (mfaStatus === 'needs_enroll' && profileStatus === 'ativo') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <MfaEnroll
          open={true}
          onOpenChange={() => {}}
          forceSetup
          onSuccess={() => setMfaStatus('verified')}
        />
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
