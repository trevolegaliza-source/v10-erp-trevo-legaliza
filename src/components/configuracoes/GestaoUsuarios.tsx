import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Users, Loader2, UserPlus, UserX, UserCheck } from 'lucide-react';
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
  // Operação
  { key: 'dashboard', label: 'Dashboard', grupo: 'Operação' },
  { key: 'processos', label: 'Processos', grupo: 'Operação' },
  { key: 'clientes', label: 'Clientes', grupo: 'Operação' },
  { key: 'importar', label: 'Importar Planilha', grupo: 'Operação' },

  // Comercial
  { key: 'orcamentos', label: 'Orçamentos', grupo: 'Comercial' },
  { key: 'catalogo', label: 'Portfólio & Preços', grupo: 'Comercial' },

  // Financeiro
  { key: 'financeiro', label: 'Financeiro (Cobranças)', grupo: 'Financeiro' },
  { key: 'contas_pagar', label: 'Contas a Pagar', grupo: 'Financeiro' },
  { key: 'relatorios_dre', label: 'Relatórios DRE', grupo: 'Financeiro' },
  { key: 'fluxo_caixa', label: 'Fluxo de Caixa', grupo: 'Financeiro' },

  // Gestão
  { key: 'colaboradores', label: 'Colaboradores', grupo: 'Gestão' },
  { key: 'intel_geografica', label: 'Inteligência Geográfica', grupo: 'Gestão' },

  // Sistema
  { key: 'configuracoes', label: 'Configurações', grupo: 'Sistema' },
];

const GRUPOS = ['Operação', 'Comercial', 'Financeiro', 'Gestão', 'Sistema'];

const ROLES = [
  { value: 'master', label: 'Master' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'operacional', label: 'Operacional' },
  { value: 'visualizador', label: 'Visualizador' },
  { value: 'usuario', label: 'Usuário' },
];

const ROLE_COLORS: Record<string, string> = {
  master: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  financeiro: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  operacional: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  visualizador: 'bg-gray-500/15 text-gray-500 border-gray-500/30',
  usuario: 'bg-purple-500/15 text-purple-500 border-purple-500/30',
};

const ROLE_PRESETS: Record<string, Record<string, boolean[]>> = {
  master: Object.fromEntries(
    MODULOS.map(m => [m.key, [true, true, true, true, true]])
  ),
  financeiro: {
    dashboard:        [true, false, false, false, false],
    processos:        [true, false, false, false, false],
    clientes:         [true, false, false, false, false],
    importar:         [false, false, false, false, false],
    orcamentos:       [true, false, false, false, false],
    catalogo:         [true, false, false, false, false],
    financeiro:       [true, true, true, false, true],
    contas_pagar:     [true, true, true, false, true],
    relatorios_dre:   [true, false, false, false, false],
    fluxo_caixa:      [true, false, false, false, false],
    colaboradores:    [true, false, false, false, false],
    intel_geografica: [false, false, false, false, false],
    configuracoes:    [false, false, false, false, false],
  },
  operacional: {
    dashboard:        [true, false, false, false, false],
    processos:        [true, true, true, false, false],
    clientes:         [true, true, true, false, false],
    importar:         [true, true, false, false, false],
    orcamentos:       [true, true, true, false, false],
    catalogo:         [true, false, false, false, false],
    financeiro:       [false, false, false, false, false],
    contas_pagar:     [false, false, false, false, false],
    relatorios_dre:   [false, false, false, false, false],
    fluxo_caixa:      [false, false, false, false, false],
    colaboradores:    [false, false, false, false, false],
    intel_geografica: [true, true, true, false, false],
    configuracoes:    [false, false, false, false, false],
  },
  visualizador: {
    dashboard:        [true, false, false, false, false],
    processos:        [true, false, false, false, false],
    clientes:         [true, false, false, false, false],
    importar:         [false, false, false, false, false],
    orcamentos:       [true, false, false, false, false],
    catalogo:         [true, false, false, false, false],
    financeiro:       [false, false, false, false, false],
    contas_pagar:     [false, false, false, false, false],
    relatorios_dre:   [false, false, false, false, false],
    fluxo_caixa:      [false, false, false, false, false],
    colaboradores:    [false, false, false, false, false],
    intel_geografica: [true, false, false, false, false],
    configuracoes:    [false, false, false, false, false],
  },
};

const PERM_LABELS = ['Ver', 'Criar', 'Editar', 'Excluir', 'Aprovar'];

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

  const getRoleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

  const getPermCount = (profileId: string) => {
    const userPerms = permissions.filter(p => p.user_id === profileId);
    return userPerms.filter(p => p.pode_ver).length;
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ nome: '', email: '', password: '', confirmPassword: '', role: 'operacional' });
    setEditPerms({ ...ROLE_PRESETS.operacional });
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

  const applyPreset = (role: string) => {
    const preset = ROLE_PRESETS[role];
    if (preset) setEditPerms({ ...preset });
  };

  const togglePerm = (modKey: string, idx: number, val: boolean) => {
    const curr = [...(editPerms[modKey] || [false, false, false, false, false])];
    curr[idx] = val;
    setEditPerms({ ...editPerms, [modKey]: curr });
  };

  const savePermissions = async (userId: string, empId: string) => {
    // Delete all existing permissions for this user
    await supabase.from('user_permissions').delete().eq('user_id', userId) as any;

    // Insert new permissions for all 13 modules
    const inserts = MODULOS.map(m => ({
      user_id: userId,
      empresa_id: empId,
      modulo: m.key,
      pode_ver: editPerms[m.key]?.[0] || false,
      pode_criar: editPerms[m.key]?.[1] || false,
      pode_editar: editPerms[m.key]?.[2] || false,
      pode_excluir: editPerms[m.key]?.[3] || false,
      pode_aprovar: editPerms[m.key]?.[4] || false,
    }));

    await supabase.from('user_permissions').insert(inserts as any);
  };

  const handleSave = async () => {
    if (editUser) {
      setSaving(true);
      try {
        await supabase.from('profiles').update({ role: form.role, ativo: editUser.ativo, updated_at: new Date().toISOString() } as any).eq('id', editUser.id);
        await savePermissions(editUser.id, empresaId);
        toast.success('Usuário atualizado com sucesso!');
        setModalOpen(false);
        loadData();
      } catch (e: any) { toast.error('Erro: ' + e.message); }
      finally { setSaving(false); }
    } else {
      if (!form.email.trim() || !form.password.trim()) { toast.error('E-mail e senha são obrigatórios'); return; }
      if (form.password !== form.confirmPassword) { toast.error('As senhas não coincidem'); return; }
      if (form.password.length < 6) { toast.error('Senha deve ter no mínimo 6 caracteres'); return; }

      setSaving(true);
      try {
        const res = await supabase.functions.invoke('create-user', {
          body: { email: form.email.trim(), password: form.password, nome: form.nome || form.email, role: form.role },
        });

        if (res.error) throw new Error(res.error.message || 'Erro ao criar usuário');
        const newUserId = res.data?.user?.id;
        if (!newUserId) throw new Error('ID do usuário não retornado');

        await savePermissions(newUserId, empresaId);

        toast.success(`Usuário criado com sucesso! Credenciais: ${form.email}`);
        setModalOpen(false);
        loadData();
      } catch (e: any) { toast.error('Erro: ' + e.message); }
      finally { setSaving(false); }
    }
  };

  const toggleAtivo = async (profile: Profile) => {
    const newAtivo = !(profile.ativo ?? true);
    await supabase.from('profiles').update({ ativo: newAtivo, updated_at: new Date().toISOString() } as any).eq('id', profile.id);
    toast.success(newAtivo ? 'Usuário ativado' : 'Usuário desativado');
    loadData();
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
            <Button size="sm" onClick={openCreate}><UserPlus className="h-4 w-4 mr-1" />Novo Usuário</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase">Usuário</TableHead>
                <TableHead className="text-xs uppercase">Perfil</TableHead>
                <TableHead className="text-xs uppercase">Status</TableHead>
                <TableHead className="text-xs uppercase">Acesso</TableHead>
                <TableHead className="text-xs uppercase text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                        {(p.nome || p.email || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{p.nome || p.email}</p>
                        <p className="text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${ROLE_COLORS[p.role] || 'bg-muted text-muted-foreground'} border text-[10px] uppercase`}>
                      {getRoleLabel(p.role)}{p.id === user?.id ? ' (você)' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${p.ativo !== false ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500 animate-pulse'}`}>
                      {p.ativo !== false ? 'ATIVO' : '⏳ AGUARDANDO APROVAÇÃO'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {p.role === 'master' ? '13 módulos' : `${getPermCount(p.id)} módulos com acesso`}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {p.id !== user?.id ? (
                      <div className="flex justify-end gap-1">
                        {p.ativo === false && (
                          <Button variant="default" size="sm" className="h-7 text-xs" onClick={() => toggleAtivo(p)}>
                            <UserCheck className="h-3 w-3 mr-1" />Aprovar
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(p)}>
                          <Shield className="h-3 w-3 mr-1" />Permissões
                        </Button>
                        {p.ativo !== false && (
                          <Button variant="ghost" size="sm" className="h-7" onClick={() => toggleAtivo(p)}>
                            <UserX className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              {editUser ? `Permissões — ${editUser.nome || editUser.email}` : 'Novo Usuário'}
            </DialogTitle>
            {editUser && (
              <DialogDescription>
                Role: <Badge className={`${ROLE_COLORS[form.role] || ''} border text-[10px] uppercase ml-1`}>{getRoleLabel(form.role)}</Badge>
                <span className="ml-2">· Defina o acesso a cada módulo do sistema.</span>
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 flex flex-col">
            {/* Form fields for new user */}
            {!editUser && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase">Nome *</Label>
                    <Input value={form.nome} onChange={(e) => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase">E-mail *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="usuario@empresa.com" />
                  </div>
                </div>
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
              </>
            )}

            {/* Role selector */}
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

            {/* Preset buttons */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Aplicar preset:</span>
              {ROLES.map(r => (
                <Button key={r.value} variant="outline" size="sm" className="h-6 text-[10px] capitalize" onClick={() => applyPreset(r.value)}>
                  {r.label}
                </Button>
              ))}
            </div>

            {/* Permissions Grid grouped by section */}
            <ScrollArea className="flex-1 border rounded-lg border-border/40">
              <div className="p-3 space-y-5">
                {GRUPOS.map(grupo => {
                  const modulosDoGrupo = MODULOS.filter(m => m.grupo === grupo);
                  return (
                    <div key={grupo}>
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 border-b border-border pb-1">
                        {grupo}
                      </h4>
                      <div className="space-y-1">
                        {modulosDoGrupo.map(modulo => (
                          <div key={modulo.key} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/30">
                            <span className="text-sm font-medium flex-1 min-w-[160px]">{modulo.label}</span>
                            <div className="flex gap-4">
                              {PERM_LABELS.map((acao, idx) => (
                                <label key={acao} className="flex flex-col items-center gap-1 cursor-pointer">
                                  <span className="text-[10px] text-muted-foreground">{acao}</span>
                                  <Checkbox
                                    checked={editPerms[modulo.key]?.[idx] ?? false}
                                    onCheckedChange={(checked) => togglePerm(modulo.key, idx, !!checked)}
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editUser ? 'Salvar Permissões' : 'Salvar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
