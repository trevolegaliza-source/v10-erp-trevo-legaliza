
-- Update get_empresa_id helper (rename from get_user_empresa_id to also have this alias)
CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Update trigger to handle empresa_id from metadata and default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  v_empresa_id := COALESCE(
    (NEW.raw_user_meta_data->>'empresa_id')::UUID,
    gen_random_uuid()
  );

  INSERT INTO public.profiles (id, empresa_id, nome, email, role)
  VALUES (
    NEW.id,
    v_empresa_id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'master')
  );
  RETURN NEW;
END;
$$;

-- Recreate trigger (DROP + CREATE since OR REPLACE not supported for triggers)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
