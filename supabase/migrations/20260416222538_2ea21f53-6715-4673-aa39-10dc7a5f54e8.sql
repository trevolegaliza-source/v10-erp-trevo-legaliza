-- Trigger function: keep processos.data_deferimento in sync with etapa changes
CREATE OR REPLACE FUNCTION public.sync_deferimento_on_etapa_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_etapas_pos_deferimento TEXT[] := ARRAY[
    'registro','mat','inscricao_me','alvaras',
    'conselho','finalizados','arquivo'
  ];
BEGIN
  -- Etapa moveu para pós-deferimento e ainda não há data → preencher
  IF NEW.etapa = ANY(v_etapas_pos_deferimento)
     AND OLD.etapa IS DISTINCT FROM NEW.etapa
     AND NEW.data_deferimento IS NULL THEN
    NEW.data_deferimento := CURRENT_DATE;
  END IF;

  -- Etapa voltou para pré-deferimento → limpar data
  IF NOT (NEW.etapa = ANY(v_etapas_pos_deferimento))
     AND OLD.etapa IS DISTINCT FROM NEW.etapa
     AND NEW.data_deferimento IS NOT NULL THEN
    NEW.data_deferimento := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_deferimento ON public.processos;

CREATE TRIGGER trg_sync_deferimento
  BEFORE UPDATE ON public.processos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_deferimento_on_etapa_change();