import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

const SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  // Track user activity for session timeout
  useEffect(() => {
    const updateActivity = () => { lastActivityRef.current = Date.now(); };
    const events = ['click', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach(e => window.addEventListener(e, updateActivity, { passive: true }));

    const interval = setInterval(() => {
      if (session && (Date.now() - lastActivityRef.current) > SESSION_TIMEOUT_MS) {
        signOut();
        // Toast will show after redirect
      }
    }, 60_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, updateActivity));
      clearInterval(interval);
    };
  }, [session, signOut]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session?.user) {
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              const { data: masterProfile } = await supabase
                .from('profiles')
                .select('empresa_id')
                .eq('role', 'master')
                .limit(1)
                .single();

              const empresaId = masterProfile?.empresa_id || '';

              await supabase.from('profiles').insert({
                id: session.user.id,
                email: session.user.email,
                nome: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Novo Usuário',
                role: 'usuario',
                ativo: false,
                empresa_id: empresaId,
              } as any);

              await supabase.from('notificacoes').insert({
                tipo: 'aprovacao',
                titulo: '👤 NOVO USUÁRIO AGUARDANDO APROVAÇÃO',
                mensagem: `${session.user.email} solicitou acesso ao sistema. Vá em Configurações → Usuários para aprovar.`,
                empresa_id: empresaId || null,
              } as any);
            } else if (event === 'SIGNED_IN') {
              await supabase
                .from('profiles')
                .update({ ultimo_acesso: new Date().toISOString() } as any)
                .eq('id', session.user.id);
            }
          } catch (err) {
            console.error('Error checking/creating profile:', err);
          }
        }, 0);
      }

      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
