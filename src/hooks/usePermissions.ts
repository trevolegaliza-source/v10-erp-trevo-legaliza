import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PermissionsMap {
  [modulo: string]: {
    pode_ver: boolean;
    pode_criar: boolean;
    pode_editar: boolean;
    pode_excluir: boolean;
    pode_aprovar: boolean;
  };
}

interface UsePermissionsReturn {
  loading: boolean;
  role: string | null;
  podeVer: (modulo: string) => boolean;
  podeCriar: (modulo: string) => boolean;
  podeEditar: (modulo: string) => boolean;
  podeExcluir: (modulo: string) => boolean;
  podeAprovar: (modulo: string) => boolean;
  podeVerValores: () => boolean;
  isMaster: () => boolean;
  isGerente: () => boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermissionsMap>({});
  const [templateModulos, setTemplateModulos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, empresa_id, ativo')
        .eq('id', user.id)
        .single() as any;

      if (profile && profile.ativo === false) {
        setRole('inativo');
        setLoading(false);
        return;
      }

      if (profile) {
        setRole(profile.role);

        if (profile.role === 'master') {
          setLoading(false);
          return;
        }

        // Fetch role template defaults
        const { data: template } = await supabase
          .from('role_templates')
          .select('modulos_padrao')
          .eq('role', profile.role)
          .single() as any;

        if (template?.modulos_padrao) {
          setTemplateModulos(template.modulos_padrao);
        }

        // Fetch user-specific permissions (override)
        const { data: permissions } = await supabase
          .from('user_permissions')
          .select('modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_aprovar')
          .eq('user_id', user.id) as any;

        if (permissions && permissions.length > 0) {
          const map: PermissionsMap = {};
          for (const p of permissions) {
            map[p.modulo] = {
              pode_ver: p.pode_ver ?? false,
              pode_criar: p.pode_criar ?? false,
              pode_editar: p.pode_editar ?? false,
              pode_excluir: p.pode_excluir ?? false,
              pode_aprovar: p.pode_aprovar ?? false,
            };
          }
          setPerms(map);
        }
        // If no user_permissions exist, templateModulos will be used as fallback
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const isMaster = () => role === 'master';
  const isGerente = () => role === 'gerente';

  const podeVer = (modulo: string) => {
    if (isMaster()) return true;
    // If user has specific permissions, use those
    if (Object.keys(perms).length > 0) {
      return perms[modulo]?.pode_ver ?? false;
    }
    // Fallback to role template
    return templateModulos.includes(modulo);
  };

  const podeCriar = (modulo: string) => {
    if (isMaster()) return true;
    if (role === 'visualizador') return false;
    if (Object.keys(perms).length > 0) {
      return perms[modulo]?.pode_criar ?? false;
    }
    // Template-based: non-visualizador can create in their modules
    return templateModulos.includes(modulo);
  };

  const podeEditar = (modulo: string) => {
    if (isMaster()) return true;
    if (role === 'visualizador') return false;
    if (Object.keys(perms).length > 0) {
      return perms[modulo]?.pode_editar ?? false;
    }
    return templateModulos.includes(modulo);
  };

  const podeExcluir = (modulo: string) => {
    if (isMaster()) return true;
    if (Object.keys(perms).length > 0) {
      return perms[modulo]?.pode_excluir ?? false;
    }
    return false;
  };

  const podeAprovar = (modulo: string) => {
    if (isMaster()) return true;
    if (Object.keys(perms).length > 0) {
      return perms[modulo]?.pode_aprovar ?? false;
    }
    return false;
  };

  const podeVerValores = () => isMaster() || role === 'financeiro' || role === 'gerente';

  return { loading, role, podeVer, podeCriar, podeEditar, podeExcluir, podeAprovar, podeVerValores, isMaster, isGerente };
}
