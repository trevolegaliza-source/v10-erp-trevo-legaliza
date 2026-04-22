CREATE OR REPLACE FUNCTION public._cobranca_preenche_expiracao()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.data_expiracao IS NULL THEN
    IF NEW.data_vencimento IS NOT NULL THEN
      NEW.data_expiracao := (NEW.data_vencimento + INTERVAL '60 days')::TIMESTAMPTZ;
    ELSE
      NEW.data_expiracao := COALESCE(NEW.created_at, NOW()) + INTERVAL '90 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;