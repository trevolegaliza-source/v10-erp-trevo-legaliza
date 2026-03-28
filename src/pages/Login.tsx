import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { LogIn, Loader2 } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) toast.error(error.message);
      else toast.success('Conta criada! Você já está logado.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a1a0f] via-[#0d2818] to-[#0a1a0f]">
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, #22c55e 1px, transparent 1px), radial-gradient(circle at 75% 75%, #22c55e 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      <Card className="relative w-full max-w-md border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl shadow-primary/5">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <img
              src={logoTrevo}
              alt="Trevo Legaliza"
              className="h-16 w-auto logo-pulse"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {isSignUp ? 'Crie sua conta' : 'Sistema de Gestão Societária'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              {isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>
            <Button type="button" variant="link" className="w-full text-xs" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Já tem conta? Faça login' : 'Primeiro acesso? Crie sua conta'}
            </Button>
          </form>
          <p className="text-[10px] text-muted-foreground text-center mt-6">
            Trevo Engine v10 · © {new Date().getFullYear()} Trevo Legaliza
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
