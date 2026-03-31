import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Users, Plus, Pencil, Loader2, UserPlus, Mail, Eye, FilePlus, Edit, Trash2, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Profile {
  id: string;
  empresa_id: string;
  nome: string | null;
  email: string | null;
  role: string;
  ativo: boolean | null;
}

interface Permission {
  id: string;
  user_id: string;
  empresa_id: string;
  modulo: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  pode_aprovar: boolean;
}

const MODULOS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'processos', label: 'Processos' },
  { key: 'clientes', label: 'Clientes' },
  { key: 'orcamentos', label: 'Orçamentos' },
  { key: 'financeiro', label: 'Financeiro' },
  { key: 'contas_pagar', label: 'Contas a Pagar' },
  { key: 'colaboradores', label: 'Colaboradores' },
  { key: 'documentos', label: 'Documentos' },
  { key: 'intel_geografica', label: 'Inteligência Geográfica' },
  { key: 'configuracoes', label: 'Configurações' },
];

const ROLES = [
  { value: 'master', label: 'Master', color: 'bg-destructive/10 text-destructive' },
  { value: 'financeiro', label: 'Financeiro', color: 'bg-warning/10 text-warning' },
  { value: 'operacional', label: 'Operacional', color: 'bg-primary/10 text-primary' },
  { value: 'visualizador', label: 'Visualizador', color: 'bg-muted text-muted-foreground' },
];

const ROLE_PRESETS: Record<string, Record<string, boolean[]>> = {
  master: Object.fromEntries(MODULOS.map(m => [m.key, [true, true, true, true, true]])),
  financeiro: Object.fromEntries(MODULOS.map(m => [m.key,
    ['dashboard', 'financeiro', 'contas_pagar', 'clientes'].includes(m.key)
      ? [true, true, true, true, true]
      : [true, false, false, false, false]
  ])),
  operacional: Object.fromEntries(MODULOS.map(m => [m.key,
    ['dashboard', 'processos', 'clientes', 'documentos'].includes(m.key)
      ? [true, true, true, false, false]
      : m.key === 'configuracoes' ? [false, false, false, false, false] : [true, false, false, false, false]
  ])),
  visualizador: Object.fromEntries(MODULOS.map(m => [m.key, [true, false, false, false, false]])),
};

export default function GestaoUsuarios() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean[]>>({});
  const [inviteForm, setInviteForm] = useState({ email: '', nome: '', role: 'operacional' });
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('empresa_id')
      .eq('id', user?.id ?? '')
      .single() as any;

    if (!myProfile) { setLoading(false); return; }

    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('*')
      .eq('empresa_id', myProfile.empresa_id) as any;

    const { data: allPerms } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('empresa_id', myProfile.empresa_id) as any;

    setProfiles(allProfiles || []);
    setPermissions(allPerms || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const getRoleColor = (role: string) => ROLES.find(r => r.value === role)?.color || 'bg-muted text-muted-foreground';

  const getUserPerms = (userId: string) => permissions.filter(p => p.user_id === userId);

  const openEditUser = (profile: Profile) => {
    const userPerms = getUserPerms(profile.id);
    const permsMap: Record<string, boolean[]> = {};
    MODULOS.forEach(m => {
      const p = userPerms.find(up => up.modulo === m.key);
      permsMap[m.key] = p
        ? [p.pode_ver, p.pode_criar, p.pode_editar, p.pode_excluir, p.pode_aprovar]
        : [false, false, false, false, false];
    });
    setEditPerms(permsMap);
    setEditUser(profile);
  };

  const handleRoleChange = (role: string) => {
    if (editUser) {
      setEditUser({ ...editUser, role });
      const preset = ROLE_PRESETS[role];
      if (preset) setEditPerms(preset);
    }
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ role: editUser.role, ativo: editUser.ativo, updated_at: new Date().toISOString() } as any)
        .eq('id', editUser.id);

      for (const mod of MODULOS) {
        const vals = editPerms[mod.key] || [false, false, false, false, false];
        const existing = permissions.find(p => p.user_id === editUser.id && p.modulo === mod.key);
        const payload = {
          pode_ver: vals[0],
          pode_criar: vals[1],
          pode_editar: vals[2],
          pode_excluir: vals[3],
          pode_aprovar: vals[4],
        };
        if (existing) {
          await supabase.from('user_permissions').update(payload as any).eq('id', existing.id);
        } else {
          await supabase.from('user_permissions').insert({
            user_id: editUser.id,
            empresa_id: editUser.empresa_id,
            modulo: mod.key,
            ...payload,
          } as any);
        }
      }

      toast.success('Usuário atualizado com sucesso!');
      setEditUser(null);
      loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteForm.email.trim()) { toast.error('E-mail obrigatório'); return; }
    setSaving(true);
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('empresa_id')
        .eq('id', user?.id ?? '')
        .single() as any;

      if (!myProfile) throw new Error('Profile não encontrado');

      const { data, error } = await supabase.auth.signUp({
        email: inviteForm.email.trim(),
        password: crypto.randomUUID().slice(0, 16) + 'A1!',
        options: {
          data: {
            nome: inviteForm.nome || inviteForm.email,
            empresa_id: myProfile.empresa_id,
            role: inviteForm.role,
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        const preset = ROLE_PRESETS[inviteForm.role] || ROLE_PRESETS.visualizador;
        const permsToInsert = MODULOS.map(m => ({
          user_id: data.user!.id,
          empresa_id: myProfile.empresa_id,
          modulo: m.key,
          pode_ver: preset[m.key][0],
          pode_criar: preset[m.key][1],
          pode_editar: preset[m.key][2],
          pode_excluir: preset[m.key][3],
          pode_aprovar: preset[m.key][4],
        }));
        await supabase.from('user_permissions').insert(permsToInsert as any);
      }

      toast.success(`Convite enviado para ${inviteForm.email}`);
      setInviteOpen(false);
      setInviteForm({ email: '', nome: '', role: 'operacional' });
      loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" />GESTÃO DE USUÁRIOS
              </CardTitle>
              <CardDescription>{profiles.length} usuário(s) na empresa</CardDescription>
            </div>
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" />CONVIDAR USUÁRIO
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {(p.nome || p.email || '?')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{p.nome || p.email}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${getRoleColor(p.role)} border-0 text-[10px] uppercase`}>{p.role}</Badge>
                {p.ativo === false && <Badge variant="outline" className="text-[10px] text-destructive">INATIVO</Badge>}
                {p.id !== user?.id && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditUser(p)}>
                    <Pencil className="h-3 w-3 mr-1" />Editar
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* MODAL: Convidar Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase text-sm">
              <UserPlus className="h-4 w-4 text-primary" />Convidar Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">E-mail *</Label>
              <Input
                type="email"
                placeholder="usuario@empresa.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Nome</Label>
              <Input
                placeholder="Nome do colaborador"
                value={inviteForm.nome}
                onChange={(e) => setInviteForm({ ...inviteForm, nome: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Perfil de acesso</Label>
              <Select value={inviteForm.role} onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.filter(r => r.value !== 'master').map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>CANCELAR</Button>
            <Button onClick={handleInvite} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              <Mail className="h-4 w-4 mr-1" />ENVIAR CONVITE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar Permissões */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase text-sm">
              <Shield className="h-4 w-4 text-primary" />Editar — {editUser?.nome || editUser?.email}
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="space-y-1.5 flex-1">
                  <Label className="text-xs uppercase">Perfil</Label>
                  <Select value={editUser.role} onValueChange={handleRoleChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={editUser.ativo ?? true} onCheckedChange={(v) => setEditUser({ ...editUser, ativo: v })} />
                  <Label className="text-xs">ATIVO</Label>
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase mb-2 block">Permissões por módulo</Label>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="grid grid-cols-[1fr_50px_50px_50px_50px_50px] gap-0 bg-muted/50 px-3 py-2 text-[10px] uppercase text-muted-foreground font-medium">
                    <span>Módulo</span>
                    <span className="text-center"><Eye className="h-3 w-3 mx-auto" /></span>
                    <span className="text-center"><FilePlus className="h-3 w-3 mx-auto" /></span>
                    <span className="text-center"><Edit className="h-3 w-3 mx-auto" /></span>
                    <span className="text-center"><Trash2 className="h-3 w-3 mx-auto" /></span>
                    <span className="text-center"><CheckSquare className="h-3 w-3 mx-auto" /></span>
                  </div>
                  {MODULOS.map((mod) => (
                    <div key={mod.key} className="grid grid-cols-[1fr_50px_50px_50px_50px_50px] gap-0 px-3 py-2 border-t border-border/20 hover:bg-muted/20">
                      <span className="text-xs font-medium">{mod.label}</span>
                      {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="flex justify-center">
                          <Checkbox
                            checked={editPerms[mod.key]?.[i] ?? false}
                            onCheckedChange={(v) => {
                              const curr = [...(editPerms[mod.key] || [false, false, false, false, false])];
                              curr[i] = !!v;
                              setEditPerms({ ...editPerms, [mod.key]: curr });
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>CANCELAR</Button>
            <Button onClick={handleSaveUser} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              SALVAR PERMISSÕES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
