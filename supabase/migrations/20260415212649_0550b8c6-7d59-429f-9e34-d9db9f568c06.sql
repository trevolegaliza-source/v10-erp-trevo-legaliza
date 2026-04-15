
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Tentar pegar empresa_id dos metadados
  v_empresa_id := (NEW.raw_user_meta_data->>'empresa_id')::UUID;
  
  -- Fallback: pegar do master existente
  IF v_empresa_id IS NULL THEN
    SELECT empresa_id INTO v_empresa_id
    FROM public.profiles WHERE role = 'master' LIMIT 1;
  END IF;
  
  -- Se ainda null, rejeitar — não criar profile órfão
  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa encontrada para associar novo usuário. Contate o administrador.';
  END IF;

  INSERT INTO public.profiles (id, email, nome, role, ativo, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role_inicial', NEW.raw_user_meta_data->>'role', 'visualizador'),
    false,
    v_empresa_id
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    empresa_id = COALESCE(EXCLUDED.empresa_id, profiles.empresa_id);
  
  RETURN NEW;
END;
$$;
