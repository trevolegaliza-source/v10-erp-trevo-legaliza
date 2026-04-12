import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);

      if (session?.user) {
        // Check if profile exists — use setTimeout to avoid Supabase deadlock on auth state change
        setTimeout(async () => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              // Find master's empresa_id to link new user
              const { data: masterProfile } = await supabase
                .from('profiles')
                .select('empresa_id')
                .eq('role', 'master')
                .limit(1)
                .single();

              const empresaId = masterProfile?.empresa_id || '';

              // Create inactive profile
              await supabase.from('profiles').insert({
                id: session.user.id,
                email: session.user.email,
                nome: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Novo Usuário',
                role: 'usuario',
                ativo: false,
                empresa_id: empresaId,
              } as any);

              // Notify admin
              await supabase.from('notificacoes').insert({
                tipo: 'aprovacao',
                titulo: '👤 NOVO USUÁRIO AGUARDANDO APROVAÇÃO',
                mensagem: `${session.user.email} solicitou acesso ao sistema. Vá em Configurações → Usuários para aprovar.`,
                empresa_id: empresaId || null,
              } as any);
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

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
