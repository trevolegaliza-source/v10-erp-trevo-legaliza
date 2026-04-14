import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Users, Loader2, UserPlus, MoreHorizontal, UserX, UserCheck, Shield, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { ROLES, MODULOS_DISPONIVEIS, GRUPOS_MODULOS, getRoleInfo, type RoleValue } from '@/constants/roles';

interface Profile {
  id: string;
  empresa_id: string;
  nome: string | null;
  email: string | null;
  role: string;
  ativo: boolean | null;
  ultimo_acesso: string | null;
  motivo_inativacao: string | null;
  convidado_em: string | null;
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

interface RoleTemplate {
  role: string;
  modulos_padrao: string[];
}

const PERM_LABELS = ['Ver', 'Criar', 'Editar', 'Excluir', 'Aprovar'];

function formatUltimoAcesso(date: string | null): string {
  if (!date) return 'Nunca';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return `Hoje ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `Há ${diffDays} dias`;
  if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
  return d.toLocaleDateString('pt-BR');
}

function getInitials(name: string | null, email: string | null): string {
  const src = name || email || '?';
  const parts = src.split(/[\s@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.substring(0, 2).toUpperCase();
}

export default function GestaoUsuarios() {
  const { user } = useAuth();
  const { isMaster } = usePermissions();
  const canEdit = isMaster();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roleTemplates, setRoleTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresaId, setEmpresaId] = useState('');

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState('operacional');
  const [editModulos, setEditModulos] = useState<Set<string>>(new Set());
  const [editPerms, setEditPerms] = useState<Record<string, boolean[]>>({});
  const [editNome, setEditNome] = useState('');
  const [saving, setSaving] = useState(false);

  // Deactivation state
  const [deactivateUser, setDeactivateUser] = useState<Profile | null>(null);
  const [deactivateMotivo, setDeactivateMotivo] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Profile | null>(null);

  const loadData = async () => {
    setLoading(true);
    const { data: myProfile } = await supabase
      .from('profiles').select('empresa_id').eq('id', user?.id ?? '').single() as any;
    if (!myProfile) { setLoading(false); return; }
    setEmpresaId(myProfile.empresa_id);

    const [profilesRes, permsRes, templatesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('empresa_id', myProfile.empresa_id) as any,
      supabase.from('user_permissions').select('*').eq('empresa_id', myProfile.empresa_id) as any,
      supabase.from('role_templates').select('role, modulos_padrao').order('ordem') as any,
    ]);

    setProfiles(profilesRes.data || []);
    setPermissions(permsRes.data || []);
    setRoleTemplates(templatesRes.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = profiles.length;
    const ativos = profiles.filter(p => p.ativo !== false).length;
    const pendentes = profiles.filter(p => p.ativo === false && !p.motivo_inativacao).length;
    const inativos = profiles.filter(p => p.ativo === false && !!p.motivo_inativacao).length;
    return { total, ativos, pendentes, inativos };
  }, [profiles]);

  const getTemplateModulos = (role: string): string[] => {
    return roleTemplates.find(t => t.role === role)?.modulos_padrao || [];
  };

  const openEdit = (profile: Profile) => {
    setEditUser(profile);
    setEditNome(profile.nome || '');
    setEditRole(profile.role);

    // Load current permissions
    const userPerms = permissions.filter(p => p.user_id === profile.id);
    const permsMap: Record<string, boolean[]> = {};
    const moduloSet = new Set<string>();

    if (userPerms.length > 0) {
      MODULOS_DISPONIVEIS.forEach(m => {
        const p = userPerms.find(up => up.modulo === m.value);
        permsMap[m.value] = p
          ? [p.pode_ver, p.pode_criar, p.pode_editar, p.pode_excluir, p.pode_aprovar]
          : [false, false, false, false, false];
        if (p?.pode_ver) moduloSet.add(m.value);
      });
    } else {
      // Use template defaults
      const templateMods = getTemplateModulos(profile.role);
      MODULOS_DISPONIVEIS.forEach(m => {
        const isInTemplate = templateMods.includes(m.value);
        permsMap[m.value] = isInTemplate
          ? [true, profile.role !== 'visualizador', profile.role !== 'visualizador', false, false]
          : [false, false, false, false, false];
        if (isInTemplate) moduloSet.add(m.value);
      });
    }

    setEditPerms(permsMap);
    setEditModulos(moduloSet);
    setEditModalOpen(true);
  };

  const handleRoleChange = (newRole: string) => {
    setEditRole(newRole);
    const templateMods = getTemplateModulos(newRole);
    const newModulos = new Set(templateMods);
    const newPerms: Record<string, boolean[]> = {};

    MODULOS_DISPONIVEIS.forEach(m => {
      const isInTemplate = templateMods.includes(m.value);
      newPerms[m.value] = isInTemplate
        ? [true, newRole !== 'visualizador', newRole !== 'visualizador', false, false]
        : [false, false, false, false, false];
    });

    setEditModulos(newModulos);
    setEditPerms(newPerms);
  };

  const toggleModulo = (modulo: string, checked: boolean) => {
    const next = new Set(editModulos);
    if (checked) {
      next.add(modulo);
      setEditPerms(prev => ({
        ...prev,
        [modulo]: [true, editRole !== 'visualizador', editRole !== 'visualizador', false, false],
      }));
    } else {
      next.delete(modulo);
      setEditPerms(prev => ({
        ...prev,
        [modulo]: [false, false, false, false, false],
      }));
    }
    setEditModulos(next);
  };

  const togglePerm = (modKey: string, idx: number, val: boolean) => {
    const curr = [...(editPerms[modKey] || [false, false, false, false, false])];
    curr[idx] = val;
    // If toggling "Ver" off, disable all
    if (idx === 0 && !val) {
      setEditPerms({ ...editPerms, [modKey]: [false, false, false, false, false] });
      setEditModulos(prev => { const n = new Set(prev); n.delete(modKey); return n; });
    } else {
      // If enabling any permission, ensure "Ver" is on
      if (val && idx > 0) curr[0] = true;
      setEditPerms({ ...editPerms, [modKey]: curr });
      if (curr[0]) setEditModulos(prev => new Set(prev).add(modKey));
    }
  };

  const handleSave = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      // Update profile — include empresa_id filter for security
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: editRole,
          nome: editNome || editUser.nome,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', editUser.id)
        .eq('empresa_id', empresaId);

      if (updateError) throw updateError;

      // Save permissions
      await supabase.from('user_permissions').delete().eq('user_id', editUser.id) as any;

      const inserts = MODULOS_DISPONIVEIS.map(m => ({
        user_id: editUser.id,
        empresa_id: empresaId,
        modulo: m.value,
        pode_ver: editPerms[m.value]?.[0] || false,
        pode_criar: editPerms[m.value]?.[1] || false,
        pode_editar: editPerms[m.value]?.[2] || false,
        pode_excluir: editPerms[m.value]?.[3] || false,
        pode_aprovar: editPerms[m.value]?.[4] || false,
      }));

      const { error: insError } = await supabase.from('user_permissions').insert(inserts as any);
      if (insError) throw insError;

      toast.success('Usuário atualizado!');
      setEditModalOpen(false);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: false,
          motivo_inativacao: deactivateMotivo || 'Desativado pelo administrador',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', deactivateUser.id)
        .eq('empresa_id', empresaId);

      toast.success('Usuário desativado');
      setDeactivateUser(null);
      setDeactivateMotivo('');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleReactivate = async (profile: Profile) => {
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: true,
          motivo_inativacao: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', profile.id)
        .eq('empresa_id', empresaId);

      toast.success('Usuário reativado');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleApprove = async (profile: Profile) => {
    try {
      await supabase
        .from('profiles')
        .update({
          ativo: true,
          role: 'operacional',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', profile.id)
        .eq('empresa_id', empresaId);

      toast.success('Usuário aprovado!');
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      // Soft delete: deactivate with deletion marker
      await supabase
        .from('profiles')
        .update({
          ativo: false,
          motivo_inativacao: 'Removido pelo administrador',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', deleteConfirm.id)
        .eq('empresa_id', empresaId);

      toast.success(`Usuário ${deleteConfirm.nome || deleteConfirm.email} removido`);
      setDeleteConfirm(null);
      await loadData();
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    }
  };

  const getStatus = (p: Profile) => {
    if (p.ativo === false && p.motivo_inativacao) return 'inativo';
    if (p.ativo === false) return 'pendente';
    return 'ativo';
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
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: kpis.total, color: 'text-foreground' },
          { label: 'Ativos', value: kpis.ativos, color: 'text-emerald-500' },
          { label: 'Pendentes', value: kpis.pendentes, color: 'text-amber-500' },
          { label: 'Inativos', value: kpis.inativos, color: 'text-muted-foreground' },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold">Usuários & Acesso</h2>
        </div>
        <Button size="sm" disabled className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Convidar Usuário
        </Button>
      </div>

      {/* User cards */}
      <div className="space-y-3">
        {profiles.map(p => {
          const status = getStatus(p);
          const roleInfo = getRoleInfo(p.role);
          const isMe = p.id === user?.id;

          return (
            <Card
              key={p.id}
              className={`border-border/60 ${status === 'inativo' ? 'opacity-60' : ''} ${status === 'pendente' ? 'border-amber-500/40' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white ${roleInfo.corDot}`}>
                    {getInitials(p.nome, p.email)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">{p.nome || p.email}</p>
                      {isMe && <span className="text-[10px] text-muted-foreground">(você)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge className={`${roleInfo.cor} border text-[10px] uppercase`}>
                        {roleInfo.label}
                      </Badge>
                      {status === 'ativo' && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Ativo
                        </span>
                      )}
                      {status === 'pendente' && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-500 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Pendente
                        </span>
                      )}
                      {status === 'inativo' && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" /> Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Último acesso: {formatUltimoAcesso(p.ultimo_acesso)}
                    </p>
                  </div>

                  {/* Actions */}
                  {!isMe && canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      {status === 'pendente' && (
                        <Button variant="default" size="sm" className="h-8 text-xs gap-1" onClick={() => handleApprove(p)}>
                          <UserCheck className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => openEdit(p)}>
                        <Shield className="h-3.5 w-3.5" /> Editar
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {status === 'ativo' && (
                            <DropdownMenuItem onClick={() => setDeactivateUser(p)}>
                              <UserX className="h-3.5 w-3.5 mr-2" /> Desativar
                            </DropdownMenuItem>
                          )}
                          {status === 'inativo' && (
                            <DropdownMenuItem onClick={() => handleReactivate(p)}>
                              <UserCheck className="h-3.5 w-3.5 mr-2" /> Reativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteConfirm(p)}>
                            <UserX className="h-3.5 w-3.5 mr-2" /> Remover
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  {/* Non-master can see but not edit */}
                  {!isMe && !canEdit && (
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1 shrink-0" disabled>
                      <Shield className="h-3.5 w-3.5" /> Editar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={o => !o && setEditModalOpen(false)}>
        <DialogContent
          className="sm:max-w-lg"
          style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-primary" />
              Editar Usuário — {editUser?.nome || editUser?.email}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Nome</Label>
              <Input value={editNome} onChange={e => setEditNome(e.target.value)} />
            </div>

            {/* Email (readonly) */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase">Email</Label>
              <Input value={editUser?.email || ''} disabled className="opacity-60" />
            </div>

            {/* Role selector - radio buttons */}
            <div className="space-y-2">
              <Label className="text-xs uppercase">Perfil</Label>
              <div className="space-y-1">
                {ROLES.map(r => (
                  <label
                    key={r.value}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                      editRole === r.value
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-transparent hover:bg-muted/30'
                    }`}
                    onClick={() => handleRoleChange(r.value)}
                  >
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      editRole === r.value ? 'border-primary' : 'border-muted-foreground/40'
                    }`}>
                      {editRole === r.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${r.corDot}`} />
                        <span className="text-sm font-medium">{r.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{r.descricao}</p>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Ao trocar o perfil, os módulos são atualizados automaticamente.
              </p>
            </div>

            {/* Module checkboxes with fine-grained permissions */}
            <div className="space-y-2">
              <Label className="text-xs uppercase">Módulos (ajuste fino)</Label>
              <div
                className="border rounded-lg border-border/40 overflow-y-auto"
                style={{ maxHeight: '300px' }}
              >
                <div className="p-3 space-y-4">
                  {GRUPOS_MODULOS.map(grupo => {
                    const modulosDoGrupo = MODULOS_DISPONIVEIS.filter(m => m.grupo === grupo);
                    return (
                      <div key={grupo}>
                        <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 border-b border-border pb-1">
                          {grupo}
                        </h4>
                        <div className="space-y-0.5">
                          {modulosDoGrupo.map(modulo => (
                            <div key={modulo.value} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/30">
                              <Checkbox
                                checked={editModulos.has(modulo.value)}
                                onCheckedChange={(checked) => toggleModulo(modulo.value, !!checked)}
                              />
                              <span className="text-sm flex-1 min-w-0">{modulo.label}</span>
                              {editModulos.has(modulo.value) && (
                                <div className="flex gap-2">
                                  {PERM_LABELS.slice(1).map((acao, idx) => (
                                    <label key={acao} className="flex flex-col items-center gap-0.5 cursor-pointer">
                                      <span className="text-[8px] text-muted-foreground">{acao}</span>
                                      <Checkbox
                                        className="h-3.5 w-3.5"
                                        checked={editPerms[modulo.value]?.[idx + 1] ?? false}
                                        onCheckedChange={(checked) => togglePerm(modulo.value, idx + 1, !!checked)}
                                      />
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivation Dialog */}
      <Dialog open={!!deactivateUser} onOpenChange={o => !o && setDeactivateUser(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Desativar {deactivateUser?.nome || deactivateUser?.email}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O usuário não conseguirá mais acessar o sistema. Você pode reativá-lo depois.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                value={deactivateMotivo}
                onChange={e => setDeactivateMotivo(e.target.value)}
                placeholder="Ex: Saiu da empresa"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateUser(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeactivate}>Desativar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover usuário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? <strong>{deleteConfirm?.nome || deleteConfirm?.email}</strong> será desativado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
