import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { toast } from 'sonner';
import { LogIn, Loader2 } from 'lucide-react';
import logoTrevo from '@/assets/logo-trevo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) toast.error(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[#0a1a0f] via-[#0d2818] to-[#0a1a0f] relative overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, #22c55e 1px, transparent 1px), radial-gradient(circle at 75% 75%, #22c55e 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Ambient glow blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-emerald-500/[0.08] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={logoTrevo}
            alt="Trevo Legaliza"
            className="h-20 mx-auto logo-pulse"
          />
        </div>

        {/* Glass card */}
        <div className="glass-card-wrapper">
          <div className="glass-card-inner" style={{ padding: '32px' }}>
            <p className="text-sm text-muted-foreground text-center mb-6">
              Sistema de Gestão Societária
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground/70">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-foreground/5 border-foreground/10 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground/70">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-foreground/5 border-foreground/10 text-foreground placeholder:text-muted-foreground/50"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                Entrar
              </Button>
            </form>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-6">
              Trevo Engine v10 · © {new Date().getFullYear()} Trevo Legaliza
            </p>
          </div>
          <div className="glass-card-glow" style={{ background: 'rgba(34, 197, 94, 0.15)' }} />
          <div className="glass-card-shine" />
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-8">
          Trevo Legaliza · Assessoria Societária Nacional
        </p>
      </div>
    </div>
  );
}
