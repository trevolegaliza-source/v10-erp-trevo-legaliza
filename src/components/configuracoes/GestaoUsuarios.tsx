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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield, Users, Pencil, Loader2, UserPlus, Eye, FilePlus, Edit, Trash2, CheckSquare, Check, X } from 'lucide-react';
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
  { key: 'intel_geografica', label: 'Intel. Geográfica' },
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
    ['financeiro', 'contas_pagar'].includes(m.key) ? [true, true, true, false, true] :
    ['colaboradores'].includes(m.key) ? [true, false, false, false, false] :
    ['dashboard', 'processos', 'clientes', 'orcamentos'].includes(m.key) ? [true, false, false, false, false] :
    [false, false, false, false, false]
  ])),
  operacional: Object.fromEntries(MODULOS.map(m => [m.key,
    ['processos', 'clientes', 'documentos'].includes(m.key) ? [true, true, true, false, false] :
    ['dashboard'].includes(m.key) ? [true, false, false, false, false] :
    [false, false, false, false, false]
  ])),
  visualizador: Object.fromEntries(MODULOS.map(m => [m.key,
    ['financeiro', 'contas_pagar', 'colaboradores', 'configuracoes'].includes(m.key) ? [false, false, false, false, false] :
    [true, false, false, false, false]
  ])),
};

const PERM_LABELS = ['VER', 'CRIAR', 'EDITAR', 'EXCLUIR', 'APROVAR'];
const PERM_ICONS = [Eye, FilePlus, Edit, Trash2, CheckSquare];

export default function GestaoUsuarios() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean[]>>({});
  const [form, setForm] = useState({ nome: '', email: '', password: '', confirmPassword: '', role: 'operacional' });
  const [saving, setSaving] = useState(false);
  const [empresaId, setEmpresaId] = useState<string>('');

  const loadData = async () => {
    setLoading(true);
    const { data: myProfile } = await supabase
      .from('profiles').select('empresa_id').eq('id', user?.id ?? '').single() as any;
    if (!myProfile) { setLoading(false); return; }
    setEmpresaId(myProfile.empresa_id);

    const { data: allProfiles } = await supabase
      .from('profiles').select('*').eq('empresa_id', myProfile.empresa_id) as any;
    const { data: allPerms } = await supabase
      .from('user_permissions').select('*').eq('empresa_id', myProfile.empresa_id) as any;

    setProfiles(allProfiles || []);
    setPermissions(allPerms || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const getRoleColor = (role: string) => ROLES.find(r => r.value === role)?.color || 'bg-muted text-muted-foreground';
  const getRoleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

  const openCreate = () => {
    setEditUser(null);
    setForm({ nome: '', email: '', password: '', confirmPassword: '', role: 'operacional' });
    setEditPerms(ROLE_PRESETS.operacional);
    setModalOpen(true);
  };

  const openEdit = (profile: Profile) => {
    const userPerms = permissions.filter(p => p.user_id === profile.id);
    const permsMap: Record<string, boolean[]> = {};
    MODULOS.forEach(m => {
      const p = userPerms.find(up => up.modulo === m.key);
      permsMap[m.key] = p ? [p.pode_ver, p.pode_criar, p.pode_editar, p.pode_excluir, p.pode_aprovar] : [false, false, false, false, false];
    });
    setEditPerms(permsMap);
    setEditUser(profile);
    setForm({ nome: profile.nome || '', email: profile.email || '', password: '', confirmPassword: '', role: profile.role });
    setModalOpen(true);
  };

  const handleRoleChange = (role: string) => {
    setForm(f => ({ ...f, role }));
    const preset = ROLE_PRESETS[role];
    if (preset) setEditPerms({ ...preset });
  };

  const markAll = (val: boolean) => {
    const newPerms: Record<string, boolean[]> = {};
    MODULOS.forEach(m => { newPerms[m.key] = [val, val, val, val, val]; });
    setEditPerms(newPerms);
  };

  const savePermissions = async (userId: string) => {
    for (const mod of MODULOS) {
      const vals = editPerms[mod.key] || [false, false, false, false, false];
      const existing = permissions.find(p => p.user_id === userId && p.modulo === mod.key);
      const payload = { pode_ver: vals[0], pode_criar: vals[1], pode_editar: vals[2], pode_excluir: vals[3], pode_aprovar: vals[4] };
      if (existing) {
        await supabase.from('user_permissions').update(payload as any).eq('id', existing.id);
      } else {
        await supabase.from('user_permissions').insert({ user_id: userId, empresa_id: empresaId, modulo: mod.key, ...payload } as any);
      }
    }
  };

  const handleSave = async () => {
    if (editUser) {
      // Edit mode
      setSaving(true);
      try {
        await supabase.from('profiles').update({ role: form.role, ativo: editUser.ativo, updated_at: new Date().toISOString() } as any).eq('id', editUser.id);
        await savePermissions(editUser.id);
        toast.success('Usuário atualizado com sucesso!');
        setModalOpen(false);
        loadData();
      } catch (e: any) { toast.error('Erro: ' + e.message); }
      finally { setSaving(false); }
    } else {
      // Create mode
      if (!form.email.trim() || !form.password.trim()) { toast.error('E-mail e senha são obrigatórios'); return; }
      if (form.password !== form.confirmPassword) { toast.error('As senhas não coincidem'); return; }
      if (form.password.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }

      setSaving(true);
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session?.session?.access_token;

        const res = await supabase.functions.invoke('create-user', {
          body: { email: form.email.trim(), password: form.password, nome: form.nome || form.email, role: form.role },
        });

        if (res.error) throw new Error(res.error.message || 'Erro ao criar usuário');
        const newUserId = res.data?.user?.id;
        if (!newUserId) throw new Error('ID do usuário não retornado');

        // Save permissions
        const permsToInsert = MODULOS.map(m => ({
          user_id: newUserId,
          empresa_id: empresaId,
          modulo: m.key,
          pode_ver: editPerms[m.key]?.[0] ?? false,
          pode_criar: editPerms[m.key]?.[1] ?? false,
          pode_editar: editPerms[m.key]?.[2] ?? false,
          pode_excluir: editPerms[m.key]?.[3] ?? false,
          pode_aprovar: editPerms[m.key]?.[4] ?? false,
        }));
        await supabase.from('user_permissions').insert(permsToInsert as any);

        toast.success(`Usuário criado com sucesso! Credenciais: ${form.email}`);
        setModalOpen(false);
        loadData();
      } catch (e: any) { toast.error('Erro: ' + e.message); }
      finally { setSaving(false); }
    }
  };

  if (loading) {
    return <Card className="border-border/60"><CardContent className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  }

  return (
    <>
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />USUÁRIOS & ACESSO</CardTitle>
              <CardDescription>Gerencie quem acessa o sistema e o que cada um pode fazer.</CardDescription>
            </div>
            <Button size="sm" onClick={openCreate}><UserPlus className="h-4 w-4 mr-1" />+ NOVO USUÁRIO</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase">Nome</TableHead>
                <TableHead className="text-xs uppercase">E-mail</TableHead>
                <TableHead className="text-xs uppercase">Perfil</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {(p.nome || p.email || '?')[0].toUpperCase()}
                      </div>
                      {p.nome || p.email}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    <Badge className={`${getRoleColor(p.role)} border-0 text-[10px] uppercase`}>
                      {getRoleLabel(p.role)}{p.id === user?.id ? ' (você)' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.ativo !== false
                      ? <Badge className="bg-primary/10 text-primary border-0 text-[10px]">ATIVO</Badge>
                      : <Badge variant="outline" className="text-[10px] text-destructive">INATIVO</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    {p.id !== user?.id ? (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>
                        <Pencil className="h-3 w-3 mr-1" />Editar
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL: Criar/Editar Usuário */}
      <Dialog open={modalOpen} onOpenChange={(o) => !o && setModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 uppercase text-sm">
              <Shield className="h-4 w-4 text-primary" />
              {editUser ? `Editar — ${editUser.nome || editUser.email}` : 'Novo Usuário'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Form fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase">Nome *</Label>
                <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" disabled={!!editUser} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs uppercase">E-mail *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com" disabled={!!editUser} />
              </div>
            </div>

            {!editUser && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Senha *</Label>
                  <Input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase">Confirmar Senha *</Label>
                  <Input type="password" value={form.confirmPassword} onChange={(e) => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repetir senha" />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs uppercase">Perfil Base *</Label>
                <Select value={form.role} onValueChange={handleRoleChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.filter(r => editUser ? true : r.value !== 'master').map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editUser && (
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={editUser.ativo ?? true} onCheckedChange={(v) => setEditUser({ ...editUser, ativo: v })} />
                  <Label className="text-xs uppercase">Ativo</Label>
                </div>
              )}
            </div>

            {/* Permissions Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs uppercase">Permissões por Módulo</Label>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => markAll(true)}>
                    <Check className="h-3 w-3 mr-1" />Marcar Todos
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px]" onClick={() => markAll(false)}>
                    <X className="h-3 w-3 mr-1" />Desmarcar Todos
                  </Button>
                </div>
              </div>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <div className="grid grid-cols-[1fr_repeat(5,60px)] gap-0 bg-muted/50 px-3 py-2">
                  <span className="text-[10px] uppercase text-muted-foreground font-medium">Módulo</span>
                  {PERM_LABELS.map((label, i) => {
                    const Icon = PERM_ICONS[i];
                    return (
                      <span key={label} className="text-center text-[10px] uppercase text-muted-foreground font-medium flex flex-col items-center gap-0.5">
                        <Icon className="h-3 w-3" />
                        {label}
                      </span>
                    );
                  })}
                </div>
                {MODULOS.map((mod) => (
                  <div key={mod.key} className="grid grid-cols-[1fr_repeat(5,60px)] gap-0 px-3 py-2 border-t border-border/20 hover:bg-muted/20">
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>CANCELAR</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editUser ? 'SALVAR PERMISSÕES' : 'SALVAR USUÁRIO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
