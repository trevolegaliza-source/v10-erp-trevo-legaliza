
-- Drop and recreate check constraint to include 'usuario'
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['master','financeiro','operacional','visualizador','usuario']));

-- Fix handle_new_user trigger to default to 'usuario' and ativo=false
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
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'usuario'),
    false,
    COALESCE(
      (NEW.raw_user_meta_data->>'empresa_id')::UUID,
      (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
