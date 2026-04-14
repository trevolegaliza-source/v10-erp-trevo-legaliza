
-- Fix default role to lowest privilege
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'visualizador';

-- Fix the trigger to be secure
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role, ativo, empresa_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role_inicial', NEW.raw_user_meta_data->>'role', 'visualizador'),
    false,  -- ALWAYS false — admin must approve
    COALESCE(
      (NEW.raw_user_meta_data->>'empresa_id')::UUID,
      (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1),
      '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d'::UUID
    )
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, profiles.nome),
    empresa_id = COALESCE(EXCLUDED.empresa_id, profiles.empresa_id);
  
  RETURN NEW;
END;
$$;
