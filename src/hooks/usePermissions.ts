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
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [perms, setPerms] = useState<PermissionsMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, empresa_id')
        .eq('id', user.id)
        .single() as any;

      if (profile) {
        setRole(profile.role);

        if (profile.role === 'master') {
          setLoading(false);
          return;
        }

        const { data: permissions } = await supabase
          .from('user_permissions')
          .select('modulo, pode_ver, pode_criar, pode_editar, pode_excluir, pode_aprovar')
          .eq('user_id', user.id) as any;

        if (permissions) {
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
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const isMaster = () => role === 'master';

  const podeVer = (modulo: string) => isMaster() || (perms[modulo]?.pode_ver ?? false);
  const podeCriar = (modulo: string) => isMaster() || (perms[modulo]?.pode_criar ?? false);
  const podeEditar = (modulo: string) => isMaster() || (perms[modulo]?.pode_editar ?? false);
  const podeExcluir = (modulo: string) => isMaster() || (perms[modulo]?.pode_excluir ?? false);
  const podeAprovar = (modulo: string) => isMaster() || (perms[modulo]?.pode_aprovar ?? false);
  const podeVerValores = () => isMaster() || role === 'financeiro';

  return { loading, role, podeVer, podeCriar, podeEditar, podeExcluir, podeAprovar, podeVerValores, isMaster };
}
