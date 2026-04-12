
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
      (SELECT empresa_id FROM public.profiles WHERE role = 'master' LIMIT 1),
      '2fa6a9bc-86f9-4831-9e76-c1fcd03f966d'::UUID
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
